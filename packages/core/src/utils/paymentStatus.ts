/**
 * Payment status utilities for NovaConnect
 *
 * This module provides helper functions to check and manage payment status
 * for students, including document access control based on payment rules.
 *
 * @module paymentStatus
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentBlockingConfig } from '../schemas/schoolSettings';

export type PaymentStatus = 'ok' | 'warning' | 'blocked';

/**
 * Student balance information
 */
export interface StudentBalance {
  total_due: number;
  total_paid: number;
  total_remaining: number;
  total_overdue: number;
  payment_status: PaymentStatus;
}

/**
 * Payment summary for a student
 */
export interface PaymentSummary extends StudentBalance {
  student_id: string;
  academic_year_id: string;
  fee_schedules_count: number;
  exemptions_count: number;
}

/**
 * Check the payment status for a student
 *
 * Uses the Supabase function `calculate_student_balance` to retrieve
 * real-time payment status based on the school's payment blocking configuration.
 *
 * @param studentId - The UUID of the student to check
 * @param academicYearId - The UUID of the academic year
 * @param supabase - Supabase client instance
 * @returns Promise resolving to the payment status
 *
 * @example
 * ```typescript
 * const status = await checkPaymentStatus('student-uuid', 'year-uuid', supabase);
 * console.log(status); // 'ok' | 'warning' | 'blocked'
 * ```
 */
export async function checkPaymentStatus(
  studentId: string,
  academicYearId: string,
  supabase: SupabaseClient
): Promise<PaymentStatus> {
  try {
    const { data, error } = await supabase.rpc('calculate_student_balance', {
      p_student_id: studentId,
      p_academic_year_id: academicYearId
    });

    if (error || !data) {
      console.error('Error checking payment status:', error);
      // Fallback to 'ok' on error to prevent blocking legitimate access
      return 'ok';
    }

    // Return the payment status from the database function
    return data.payment_status as PaymentStatus;
  } catch (error) {
    console.error('Exception checking payment status:', error);
    // Fallback to 'ok' on error
    return 'ok';
  }
}

/**
 * Calculate payment status from balance and configuration
 *
 * Determines the payment status based on the school's blocking rules
 * and the student's outstanding balance.
 *
 * @param totalDue - Total amount due
 * @param totalPaid - Total amount paid
 * @param totalOverdue - Total overdue amount
 * @param config - Payment blocking configuration from school settings
 * @returns The calculated payment status
 *
 * @example
 * ```typescript
 * const status = calculatePaymentStatusFromBalance(
 *   1000,
 *   500,
 *   200,
 *   { mode: 'BLOCKED', blockBulletins: true }
 * );
 * console.log(status); // 'blocked'
 * ```
 */
export function calculatePaymentStatusFromBalance(
  _totalDue: number,
  _totalPaid: number,
  totalOverdue: number,
  config?: PaymentBlockingConfig
): PaymentStatus {
  // If no configuration or mode is OK, always return OK
  if (!config || config.mode === 'OK') {
    return 'ok';
  }

  // If there are overdue payments, apply blocking rules
  if (totalOverdue > 0) {
    if (config.mode === 'BLOCKED') {
      return 'blocked';
    } else if (config.mode === 'WARNING') {
      return 'warning';
    }
  }

  // Default to OK if no overdue payments
  return 'ok';
}

/**
 * Get comprehensive payment summary for a student
 *
 * @param studentId - The UUID of the student
 * @param academicYearId - The UUID of the academic year
 * @param supabase - Supabase client instance
 * @returns Promise resolving to payment summary
 *
 * @example
 * ```typescript
 * const summary = await getPaymentSummary('student-uuid', 'year-uuid', supabase);
 * console.log(summary.payment_status); // 'ok' | 'warning' | 'blocked'
 * console.log(summary.total_overdue); // 250.00
 * ```
 */
export async function getPaymentSummary(
  studentId: string,
  academicYearId: string,
  supabase: SupabaseClient
): Promise<PaymentSummary | null> {
  try {
    // Get balance from Supabase function
    const { data: balanceData, error: balanceError } = await supabase.rpc('calculate_student_balance', {
      p_student_id: studentId,
      p_academic_year_id: academicYearId
    });

    if (balanceError || !balanceData) {
      console.error('Error getting payment balance:', balanceError);
      return null;
    }

    // Get counts
    const { count: feeSchedulesCount } = await supabase
      .from('fee_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .neq('status', 'cancelled');

    const { count: exemptionsCount } = await supabase
      .from('payment_exemptions')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('is_active', true);

    return {
      student_id: studentId,
      academic_year_id: academicYearId,
      total_due: balanceData.total_due,
      total_paid: balanceData.total_paid,
      total_remaining: balanceData.total_remaining,
      total_overdue: balanceData.total_overdue,
      payment_status: balanceData.payment_status,
      fee_schedules_count: feeSchedulesCount || 0,
      exemptions_count: exemptionsCount || 0,
    };
  } catch (error) {
    console.error('Exception getting payment summary:', error);
    return null;
  }
}

/**
 * Determine if a document can be accessed based on payment status
 *
 * @param paymentStatus - The current payment status
 * @param paymentStatusOverride - Whether an admin has overridden the block
 * @returns true if document can be accessed, false otherwise
 *
 * @example
 * ```typescript
 * const canAccess = canAccessDocument('blocked', true);
 * console.log(canAccess); // true (because of override)
 *
 * const canAccess2 = canAccessDocument('blocked', false);
 * console.log(canAccess2); // false (blocked without override)
 * ```
 */
export function canAccessDocument(
  paymentStatus: PaymentStatus,
  paymentStatusOverride: boolean
): boolean {
  // Admin override always grants access
  if (paymentStatusOverride) return true;

  // 'blocked' status prevents access
  return paymentStatus !== 'blocked';
}

/**
 * Get a human-readable label for payment status
 *
 * @param status - The payment status
 * @returns Localized label for the status
 *
 * @example
 * ```typescript
 * console.log(getPaymentStatusLabel('ok')); // 'OK'
 * console.log(getPaymentStatusLabel('blocked')); // 'Bloqué'
 * ```
 */
export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    ok: 'OK',
    warning: 'Attention',
    blocked: 'Bloqué',
  };
  return labels[status];
}

/**
 * Get the CSS class for payment status badge
 *
 * @param status - The payment status
 * @returns Tailwind CSS class name for styling
 *
 * @example
 * ```typescript
 * const className = getPaymentStatusBadgeClass('blocked');
 * console.log(className); // 'bg-red-100 text-red-800'
 * ```
 */
export function getPaymentStatusBadgeClass(status: PaymentStatus): string {
  const classes: Record<PaymentStatus, string> = {
    ok: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    blocked: 'bg-red-100 text-red-800',
  };
  return classes[status];
}

/**
 * Validate if an override reason is sufficient
 *
 * @param reason - The override reason text
 * @returns true if reason is valid (min 10 characters)
 *
 * @example
 * ```typescript
 * console.log(validateOverrideReason('Short')); // false
 * console.log(validateOverrideReason('This is a valid reason with enough details')); // true
 * ```
 */
export function validateOverrideReason(reason: string): boolean {
  return reason.trim().length >= 10;
}
