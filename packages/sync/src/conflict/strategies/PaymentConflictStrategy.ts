import { ConflictStrategy, ConflictRecord, ConflictResolution } from '../types';

/**
 * Payment conflict resolution strategy (append-only)
 *
 * Payments are never deleted, only added. In case of conflict:
 * - Keep both records (local + server)
 * - Detect duplicates by 'reference' or 'receipt_number'
 * - If duplicate detected, mark as 'duplicate' and notify admin
 */
export class PaymentConflictStrategy implements ConflictStrategy {
  async resolve(conflict: ConflictRecord): Promise<ConflictResolution> {
    const { localData, serverData } = conflict;

    // Check if these are duplicate payments
    if (this.isDuplicate(localData, serverData)) {
      return {
        action: 'manual',
        reason: 'duplicate_payment_detected',
        data: {
          localData,
          serverData,
          suggestion: 'keep_both_mark_duplicate',
        },
        requiresAdminIntervention: true,
        message: 'Duplicate payment detected. Admin should decide which record to keep.',
      };
    }

    // Not duplicates - keep both (append-only)
    return {
      action: 'keep_both',
      reason: 'append_only_strategy',
      data: {
        localData,
        serverData,
      },
      requiresAdminIntervention: false,
      message: 'Both payment records preserved (append-only strategy).',
    };
  }

  /**
   * Check if two payment records are duplicates
   */
  private isDuplicate(local: any, server: any): boolean {
    // Check by reference number
    if (local.reference && server.reference) {
      return local.reference === server.reference;
    }

    // Check by receipt number
    if (local.receipt_number && server.receipt_number) {
      return local.receipt_number === server.receipt_number;
    }

    // Check by combination of student, amount, and date (within 1 minute)
    if (
      local.student_id === server.student_id &&
      local.amount === server.amount &&
      local.payment_date &&
      server.payment_date
    ) {
      const localDate = new Date(local.payment_date);
      const serverDate = new Date(server.payment_date);
      const diff = Math.abs(localDate.getTime() - serverDate.getTime());
      return diff < 60000; // 1 minute in milliseconds
    }

    return false;
  }

  /**
   * Get conflict description for UI
   */
  getDescription(conflict: ConflictRecord): string {
    const { localData, serverData } = conflict;
    const isDuplicate = this.isDuplicate(localData, serverData);

    if (isDuplicate) {
      return `Duplicate payment: ${localData.amount} from student ${localData.student_id}`;
    }

    return `Payment conflict: local (${localData.amount}) vs server (${serverData.amount})`;
  }

  /**
   * Get suggested resolution for admin
   */
  getSuggestions(conflict: ConflictRecord): Array<{
    action: string;
    description: string;
    data?: any;
  }> {
    const { localData, serverData } = conflict;
    const isDuplicate = this.isDuplicate(localData, serverData);

    if (isDuplicate) {
      return [
        {
          action: 'keep_local',
          description: 'Keep local payment record, mark server as duplicate',
          data: { keepId: localData.id, duplicateId: serverData.id },
        },
        {
          action: 'keep_server',
          description: 'Keep server payment record, mark local as duplicate',
          data: { keepId: serverData.id, duplicateId: localData.id },
        },
        {
          action: 'merge',
          description: 'Merge both records (e.g., combine payment notes)',
          data: { localData, serverData },
        },
      ];
    }

    return [
      {
        action: 'keep_both',
        description: 'Keep both payment records (recommended for append-only)',
      },
    ];
  }
}
