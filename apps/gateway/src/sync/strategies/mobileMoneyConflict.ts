// ============================================================================
// Mobile Money Conflict Resolution Strategy
// ============================================================================
// Handles conflicts when syncing offline Mobile Money transactions to cloud
// Ensures data integrity and prevents duplicate payments
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';

export interface PendingTransaction {
  id: string;
  user_id: string;
  school_id: string;
  student_id: string;
  fee_schedule_id?: string;
  amount: number;
  phone_number: string;
  provider_code: string;
  status: string;
  created_at: string;
  sync_attempts: number;
}

export interface CloudTransaction {
  transaction_id: string;
  status: string;
  amount: number;
  provider_code: string;
  phone_number: string;
  external_transaction_id?: string;
  initiated_at: string;
}

export interface ConflictResolution {
  resolved: boolean;
  action: 'use_cloud' | 'use_local' | 'manual' | 'skip';
  reason?: string;
  merged_data?: any;
}

export class MobileMoneyConflictStrategy {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Resolve conflict between local pending transaction and cloud state
   */
  async resolve(
    pendingTx: PendingTransaction,
    cloudResponse: any
  ): Promise<ConflictResolution> {
    // Case 1: Cloud transaction was successful
    if (cloudResponse.success && cloudResponse.transaction_id) {
      // Verify amount and provider match
      if (
        cloudResponse.amount === pendingTx.amount &&
        cloudResponse.provider_code === pendingTx.provider_code
      ) {
        // Cloud version is authoritative - it's been processed by provider
        return {
          resolved: true,
          action: 'use_cloud',
          reason: 'Cloud transaction already processed successfully by provider'
        };
      } else {
        // Amount or provider mismatch - requires manual review
        return {
          resolved: false,
          action: 'manual',
          reason: `Amount/provider mismatch: pending ${pendingTx.amount}/${pendingTx.provider_code} vs cloud ${cloudResponse.amount}/${cloudResponse.provider_code}`
        };
      }
    }

    // Case 2: Cloud transaction failed
    if (!cloudResponse.success) {
      // Check if it's a temporary failure or permanent
      if (this.isRetryableError(cloudResponse.error_code)) {
        // Temporary failure - keep pending for retry
        return {
          resolved: false,
          action: 'skip',
          reason: `Temporary error: ${cloudResponse.error}. Will retry on next sync.`
        };
      } else {
        // Permanent failure - mark local transaction as failed
        return {
          resolved: true,
          action: 'use_local',
          reason: `Permanent failure from cloud: ${cloudResponse.error}`,
          merged_data: {
            ...pendingTx,
            status: 'failed',
            error_code: cloudResponse.error_code,
            error_message: cloudResponse.error,
            failed_at: new Date().toISOString()
          }
        };
      }
    }

    // Case 3: Check for duplicate transactions (same payment initiated multiple times)
    const duplicateCheck = await this.checkForDuplicate(pendingTx);
    if (duplicateCheck.isDuplicate) {
      return {
        resolved: true,
        action: 'use_cloud',
        reason: `Duplicate transaction found: ${duplicateCheck.existing_transaction_id}`,
        merged_data: {
          duplicate_of: duplicateCheck.existing_transaction_id
        }
      };
    }

    // Case 4: No conflict - cloud response is for new successful transaction
    return {
      resolved: true,
      action: 'use_cloud',
      reason: 'New transaction successfully created in cloud'
    };
  }

  /**
   * Check if error is retryable (temporary) or permanent
   */
  private isRetryableError(errorCode?: string): boolean {
    const retryableErrors = [
      'TIMEOUT',
      'NETWORK_ERROR',
      'PROVIDER_UNAVAILABLE',
      'RATE_LIMIT_EXCEEDED'
    ];

    return !errorCode || retryableErrors.includes(errorCode);
  }

  /**
   * Check for duplicate transactions (same student, amount, provider, recent time)
   */
  private async checkForDuplicate(
    pendingTx: PendingTransaction
  ): Promise<{ isDuplicate: boolean; existing_transaction_id?: string }> {
    // Look for transactions with same student, amount, provider in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: existingTransactions } = await this.supabase
      .from('mobile_money_transactions')
      .select('id, initiated_at, status')
      .eq('student_id', pendingTx.student_id)
      .eq('amount', pendingTx.amount)
      .eq('provider_id', pendingTx.provider_code)
      .gte('initiated_at', oneHourAgo)
      .in('status', ['initiated', 'pending', 'success'])
      .limit(5);

    if (existingTransactions && existingTransactions.length > 0) {
      // Found potential duplicate - return most recent successful one
      const successfulTx = existingTransactions.find(t => t.status === 'success');
      if (successfulTx) {
        return {
          isDuplicate: true,
          existing_transaction_id: successfulTx.id
        };
      }

      // If no successful but have pending/initiated, might be duplicate attempt
      if (existingTransactions.length > 0) {
        return {
          isDuplicate: true,
          existing_transaction_id: existingTransactions[0].id
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Merge local and cloud transaction data
   * Used when both have valuable information
   */
  async merge(
    pendingTx: PendingTransaction,
    cloudTx: any
  ): Promise<any> {
    return {
      // Use cloud as base (it has provider response)
      ...cloudTx,

      // Preserve local metadata
      metadata: {
        ...(cloudTx.metadata || {}),
        offline_initiated: true,
        offline_initiated_at: pendingTx.created_at,
        synced_at: new Date().toISOString(),
        sync_attempts: pendingTx.sync_attempts + 1
      }
    };
  }

  /**
   * Check if transaction is stale (too old to sync)
   */
  isStaleTransaction(pendingTx: PendingTransaction, maxAgeHours = 24): boolean {
    const createdTime = new Date(pendingTx.created_at).getTime();
    const now = Date.now();
    const ageHours = (now - createdTime) / (1000 * 60 * 60);

    return ageHours > maxAgeHours;
  }

  /**
   * Get recommended action for stale transaction
   */
  getStaleTransactionAction(pendingTx: PendingTransaction): ConflictResolution {
    return {
      resolved: true,
      action: 'use_local',
      reason: 'Transaction is too old to sync (>24 hours). Marked as expired.',
      merged_data: {
        ...pendingTx,
        status: 'expired',
        error_message: 'Transaction expired - too old to sync to cloud',
        expired_at: new Date().toISOString()
      }
    };
  }
}
