import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import {
  feeTypeQueries,
  feeScheduleQueries,
  paymentQueries,
  paymentExemptionQueries,
  balanceQueries,
  paymentEdgeFunctions,
} from '../queries/payments';
import type {
  CreateFeeTypeInput,
  UpdateFeeTypeInput,
  CreateFeeScheduleInput,
  UpdateFeeScheduleInput,
  RecordPaymentInput,
  ApplyExemptionInput,
  PaymentFilters,
  StudentBalance,
  PaymentStats,
} from '@core/schemas/payments';

// ============================================================================
// FEE TYPES HOOKS
// ============================================================================

/**
 * Hook to fetch all fee types for a school
 */
export function useFeeTypes(schoolId: string) {
  return useQuery({
    queryKey: ['feeTypes', schoolId],
    queryFn: () => feeTypeQueries.getAll(schoolId),
    enabled: !!schoolId,
  });
}

/**
 * Hook to fetch a single fee type
 */
export function useFeeType(id: string) {
  return useQuery({
    queryKey: ['feeType', id],
    queryFn: () => feeTypeQueries.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a fee type
 */
export function useCreateFeeType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFeeTypeInput & { schoolId: string }) =>
      feeTypeQueries.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeTypes'] });
    },
  });
}

/**
 * Hook to update a fee type
 */
export function useUpdateFeeType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFeeTypeInput }) =>
      feeTypeQueries.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeTypes'] });
    },
  });
}

/**
 * Hook to delete a fee type
 */
export function useDeleteFeeType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => feeTypeQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeTypes'] });
    },
  });
}

// ============================================================================
// FEE SCHEDULES HOOKS
// ============================================================================

/**
 * Hook to fetch all fee schedules with filters
 */
export function useFeeSchedules(filters: PaymentFilters) {
  return useQuery({
    queryKey: ['feeSchedules', filters],
    queryFn: () => feeScheduleQueries.getAll(filters),
    enabled: !!filters.schoolId,
  });
}

/**
 * Hook to fetch fee schedules for a student
 */
export function useStudentFeeSchedules(studentId: string, academicYearId: string) {
  return useQuery({
    queryKey: ['studentFeeSchedules', studentId, academicYearId],
    queryFn: () => feeScheduleQueries.getByStudent(studentId, academicYearId),
    enabled: !!studentId && !!academicYearId,
  });
}

/**
 * Hook to fetch a single fee schedule
 */
export function useFeeSchedule(id: string) {
  return useQuery({
    queryKey: ['feeSchedule', id],
    queryFn: () => feeScheduleQueries.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a fee schedule
 */
export function useCreateFeeSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFeeScheduleInput) =>
      feeScheduleQueries.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['studentFeeSchedules'] });
    },
  });
}

/**
 * Hook to update a fee schedule
 */
export function useUpdateFeeSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFeeScheduleInput }) =>
      feeScheduleQueries.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['studentFeeSchedules'] });
    },
  });
}

// ============================================================================
// PAYMENTS HOOKS
// ============================================================================

/**
 * Hook to fetch all payments with filters
 */
export function usePayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => paymentQueries.getAll(filters),
    enabled: !!filters.schoolId,
  });
}

/**
 * Hook to fetch payments for a student
 */
export function useStudentPayments(studentId: string, academicYearId?: string) {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['studentPayments', studentId, academicYearId],
    queryFn: () => paymentQueries.getByStudent(studentId, academicYearId),
    enabled: !!studentId,
  });
}

/**
 * Hook to fetch a single payment
 */
export function usePayment(id: string) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentQueries.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to record a payment
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordPaymentInput & { schoolId: string; receivedBy: string; autoGenerateReceipt?: boolean }) =>
      paymentQueries.create(input),
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['studentPayments'] });
      queryClient.invalidateQueries({ queryKey: ['feeSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['studentFeeSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['studentBalance'] });
    },
  });
}

// ============================================================================
// PAYMENT EXEMPTIONS HOOKS
// ============================================================================

/**
 * Hook to fetch all payment exemptions
 */
export function usePaymentExemptions(schoolId: string, studentId?: string) {
  return useQuery({
    queryKey: ['paymentExemptions', schoolId, studentId],
    queryFn: () => paymentExemptionQueries.getAll(schoolId, studentId),
    enabled: !!schoolId,
  });
}

/**
 * Hook to fetch a single payment exemption
 */
export function usePaymentExemption(id: string) {
  return useQuery({
    queryKey: ['paymentExemption', id],
    queryFn: () => paymentExemptionQueries.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to apply a payment exemption
 */
export function useApplyExemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplyExemptionInput & { schoolId: string; approvedBy: string }) =>
      paymentExemptionQueries.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentExemptions'] });
      queryClient.invalidateQueries({ queryKey: ['feeSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['studentFeeSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['studentBalance'] });
    },
  });
}

/**
 * Hook to revoke a payment exemption
 */
export function useRevokeExemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentExemptionQueries.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentExemptions'] });
      queryClient.invalidateQueries({ queryKey: ['feeSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['studentBalance'] });
    },
  });
}

// ============================================================================
// BALANCE & STATS HOOKS
// ============================================================================

/**
 * Hook to fetch student balance
 */
export function useStudentBalance(studentId: string, academicYearId: string): UseQueryResult<StudentBalance | null, Error> {
  return useQuery({
    queryKey: ['studentBalance', studentId, academicYearId],
    queryFn: () => balanceQueries.getStudentBalance(studentId, academicYearId),
    enabled: !!studentId && !!academicYearId,
  });
}

/**
 * Hook to fetch payment statistics for a school
 */
export function usePaymentStats(schoolId: string, academicYearId: string) {
  return useQuery({
    queryKey: ['paymentStats', schoolId, academicYearId],
    queryFn: () => balanceQueries.getPaymentStats(schoolId, academicYearId),
    enabled: !!schoolId && !!academicYearId,
  });
}

// ============================================================================
// EDGE FUNCTION HOOKS
// ============================================================================

/**
 * Hook to generate a payment receipt
 */
export function useGenerateReceipt() {
  return useMutation({
    mutationFn: (paymentId: string) => paymentEdgeFunctions.generateReceipt(paymentId),
  });
}

/**
 * Hook to send payment reminders
 */
export function useSendReminders() {
  return useMutation({
    mutationFn: (input: {
      schoolId?: string;
      studentIds?: string[];
      reminderType?: 'first' | 'second' | 'final' | 'custom';
      dryRun?: boolean;
    }) => paymentEdgeFunctions.sendReminders(input),
  });
}

/**
 * Hook to apply exemption via Edge Function
 */
export function useApplyExemptionEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplyExemptionInput) =>
      paymentEdgeFunctions.applyExemption(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentExemptions'] });
      queryClient.invalidateQueries({ queryKey: ['feeSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['studentBalance'] });
    },
  });
}

// ============================================================================
// COMPOSITE HOOKS
// ============================================================================

/**
 * Hook for payment dashboard (accountant view)
 */
export function usePaymentDashboard(schoolId: string, academicYearId: string) {
  const feeTypes = useFeeTypes(schoolId);
  const stats = usePaymentStats(schoolId, academicYearId);

  return {
    feeTypes: feeTypes.data,
    stats: stats.data,
    isLoading: feeTypes.isLoading || stats.isLoading,
    error: feeTypes.error || stats.error,
  };
}

/**
 * Hook for student payment view (parent/student view)
 */
export function useStudentPaymentsView(studentId: string, academicYearId: string) {
  const balance = useStudentBalance(studentId, academicYearId);
  const schedules = useStudentFeeSchedules(studentId, academicYearId);
  const payments = useStudentPayments(studentId, academicYearId);
  const exemptions = usePaymentExemptions('', studentId);

  return {
    balance: balance.data,
    schedules: schedules.data,
    payments: payments.data,
    exemptions: exemptions.data,
    isLoading: balance.isLoading || schedules.isLoading || payments.isLoading || exemptions.isLoading,
    error: balance.error || schedules.error || payments.error || exemptions.error,
  };
}
