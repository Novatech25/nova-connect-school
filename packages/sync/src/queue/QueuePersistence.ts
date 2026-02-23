import { OfflineQueue } from './OfflineQueue';
import { OfflineOperation } from './OfflineQueue';

export type QueueBackup = {
  version: string;
  timestamp: number;
  operations: OfflineOperation[];
};

export class QueuePersistence {
  private queue: OfflineQueue;

  constructor(queue: OfflineQueue) {
    this.queue = queue;
  }

  /**
   * Export the queue to a JSON string for backup
   */
  async export(): Promise<string> {
    const operations = await this.queue.getAll();

    const backup: QueueBackup = {
      version: '1.0',
      timestamp: Date.now(),
      operations,
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import queue from a backup JSON string
   */
  async restore(backupData: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const backup: QueueBackup = JSON.parse(backupData);

      // Validate backup structure
      if (!backup.operations || !Array.isArray(backup.operations)) {
        throw new Error('Invalid backup format: missing operations array');
      }

      if (backup.version !== '1.0') {
        errors.push(`Warning: Backup version ${backup.version} may not be compatible`);
      }

      // Clear existing queue
      await this.queue.clear();

      // Import operations
      const operationsToImport = backup.operations.map(op => ({
        type: op.type,
        table: op.table,
        data: op.data,
        synced: op.synced,
        retryCount: op.retryCount,
        priority: op.priority,
        metadata: op.metadata,
        error: op.error,
      }));

      const ids = await this.queue.addBatch(operationsToImport);
      imported = ids.length;

      if (backup.timestamp) {
        const backupDate = new Date(backup.timestamp);
        console.log(`Restored backup from ${backupDate.toISOString()}`);
      }

    } catch (error) {
      errors.push(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { imported, errors };
  }

  /**
   * Remove old synced operations (older than specified days)
   */
  async compact(daysToKeep: number = 7): Promise<{ removed: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffTimestamp = cutoffDate.getTime();

    const allOperations = await this.queue.getAll();
    const toRemove = allOperations.filter(
      op => op.synced && op.timestamp < cutoffTimestamp
    );

    for (const operation of toRemove) {
      await this.queue.remove(operation.id);
    }

    console.log(`Compacted queue: removed ${toRemove.length} old operations`);
    return { removed: toRemove.length };
  }

  /**
   * Validate the integrity of the queue
   */
  async validate(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    stats: {
      total: number;
      corrupt: number;
      missingFields: number;
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const stats = {
      total: 0,
      corrupt: 0,
      missingFields: 0,
    };

    try {
      const allOperations = await this.queue.getAll();
      stats.total = allOperations.length;

      for (const operation of allOperations) {
        // Check required fields
        if (!operation.id) {
          errors.push(`Operation missing id at timestamp ${operation.timestamp}`);
          stats.corrupt++;
          continue;
        }

        if (!operation.type || !['create', 'update', 'delete'].includes(operation.type)) {
          errors.push(`Operation ${operation.id} has invalid type: ${operation.type}`);
          stats.missingFields++;
        }

        if (!operation.table) {
          errors.push(`Operation ${operation.id} missing table`);
          stats.missingFields++;
        }

        if (!operation.data || typeof operation.data !== 'object') {
          warnings.push(`Operation ${operation.id} has invalid data`);
          stats.missingFields++;
        }

        // Check for invalid timestamps
        if (operation.timestamp <= 0 || operation.timestamp > Date.now() + 86400000) {
          warnings.push(`Operation ${operation.id} has suspicious timestamp: ${operation.timestamp}`);
        }

        // Check for excessive retry counts
        if (operation.retryCount > 100) {
          warnings.push(`Operation ${operation.id} has excessive retry count: ${operation.retryCount}`);
        }
      }

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats,
    };
  }

  /**
   * Get diagnostic information about the queue
   */
  async getDiagnostics(): Promise<{
    queueSize: number;
    oldestOperation?: Date;
    newestOperation?: Date;
    sizeByTable: Record<string, number>;
    statusByTable: Record<string, { synced: number; pending: number; failed: number }>;
    totalRetries: number;
  }> {
    const allOperations = await this.queue.getAll();
    const sizeByTable: Record<string, number> = {};
    const statusByTable: Record<string, { synced: number; pending: number; failed: number }> = {};
    let totalRetries = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = -Infinity;

    for (const operation of allOperations) {
      // Count by table
      sizeByTable[operation.table] = (sizeByTable[operation.table] || 0) + 1;

      // Status by table
      if (!statusByTable[operation.table]) {
        statusByTable[operation.table] = { synced: 0, pending: 0, failed: 0 };
      }

      if (operation.synced) {
        statusByTable[operation.table].synced++;
      } else if (operation.retryCount >= 3) {
        statusByTable[operation.table].failed++;
      } else {
        statusByTable[operation.table].pending++;
      }

      // Total retries
      totalRetries += operation.retryCount;

      // Timestamp range
      if (operation.timestamp < oldestTimestamp) {
        oldestTimestamp = operation.timestamp;
      }
      if (operation.timestamp > newestTimestamp) {
        newestTimestamp = operation.timestamp;
      }
    }

    return {
      queueSize: allOperations.length,
      oldestOperation: oldestTimestamp !== Infinity ? new Date(oldestTimestamp) : undefined,
      newestOperation: newestTimestamp !== -Infinity ? new Date(newestTimestamp) : undefined,
      sizeByTable,
      statusByTable,
      totalRetries,
    };
  }

  /**
   * Repair common issues in the queue
   */
  async repair(): Promise<{ repaired: number; errors: string[] }> {
    const errors: string[] = [];
    let repaired = 0;

    try {
      const allOperations = await this.queue.getAll();

      for (const operation of allOperations) {
        let needsUpdate = false;
        const updates: Partial<OfflineOperation> = {};

        // Fix missing IDs (generate new ones)
        if (!operation.id) {
          updates.id = crypto.randomUUID();
          needsUpdate = true;
        }

        // Fix invalid types (default to 'create')
        if (!operation.type || !['create', 'update', 'delete'].includes(operation.type)) {
          updates.type = 'create';
          needsUpdate = true;
        }

        // Fix missing tables (mark as 'unknown')
        if (!operation.table) {
          updates.table = 'unknown';
          needsUpdate = true;
        }

        // Fix missing data
        if (!operation.data) {
          updates.data = {};
          needsUpdate = true;
        }

        // Fix invalid timestamps
        if (operation.timestamp <= 0 || operation.timestamp > Date.now() + 86400000) {
          updates.timestamp = Date.now();
          needsUpdate = true;
        }

        // Apply repairs
        if (needsUpdate && operation.id) {
          await this.queue.update(operation.id, updates);
          repaired++;
        }
      }

    } catch (error) {
      errors.push(`Repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { repaired, errors };
  }
}
