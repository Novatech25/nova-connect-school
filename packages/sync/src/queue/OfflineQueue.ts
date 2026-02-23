import { StorageAdapter } from '../storage/types';

export type OfflineOperation = {
  id: string;
  timestamp: number;
  type: "create" | "update" | "delete";
  table: string;
  data: Record<string, unknown>;
  synced: boolean;
  retryCount: number;
  priority?: 'high' | 'normal' | 'low';
  metadata?: {
    userId?: string;
    deviceId?: string;
    schoolId?: string;
    [key: string]: any;
  };
  error?: string;
};

export type QueueStats = {
  total: number;
  synced: number;
  unsynced: number;
  retryable: number;
  failed: number;
  byTable: Record<string, number>;
};

export class OfflineQueue {
  private storage: StorageAdapter;
  private maxRetries = 3;
  private initialized = false;

  constructor(storage: StorageAdapter, maxRetries: number = 3) {
    this.storage = storage;
    this.maxRetries = maxRetries;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('OfflineQueue not initialized. Call init() first.');
    }
  }

  async init(): Promise<void> {
    await this.storage.init();
    this.initialized = true;
  }

  /**
   * Get the underlying storage adapter
   */
  getStorage(): StorageAdapter {
    return this.storage;
  }

  // Add operation to queue
  async add(operation: Omit<OfflineOperation, "id" | "timestamp" | "synced" | "retryCount">): Promise<string> {
    this.ensureInitialized();

    const newOperation: OfflineOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      synced: false,
      retryCount: 0,
      priority: operation.priority || 'normal',
    };

    await this.storage.set(newOperation.id, newOperation, 'queue');
    return newOperation.id;
  }

  // Add multiple operations in batch
  async addBatch(operations: Omit<OfflineOperation, "id" | "timestamp" | "synced" | "retryCount">[]): Promise<string[]> {
    this.ensureInitialized();

    const newOperations = operations.map(op => ({
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      synced: false,
      retryCount: 0,
      priority: op.priority || 'normal',
    }));

    await this.storage.transaction(['queue'], async () => {
      for (const operation of newOperations) {
        await this.storage.set(operation.id, operation, 'queue');
      }
    });

    return newOperations.map(op => op.id);
  }

  // Get all unsynced operations
  async getUnsynced(): Promise<OfflineOperation[]> {
    this.ensureInitialized();

    const all = await this.storage.getAll<OfflineOperation>('queue');
    return all.filter(op => !op.synced).sort(this.sortByPriorityAndTimestamp);
  }

  // Get all operations
  async getAll(): Promise<OfflineOperation[]> {
    this.ensureInitialized();

    const all = await this.storage.getAll<OfflineOperation>('queue');
    return all.sort(this.sortByPriorityAndTimestamp);
  }

  // Get operation by ID
  async getById(id: string): Promise<OfflineOperation | null> {
    this.ensureInitialized();

    return await this.storage.get<OfflineOperation>(id);
  }

  // Get operations by table
  async getByTable(table: string): Promise<OfflineOperation[]> {
    this.ensureInitialized();

    const all = await this.storage.getAll<OfflineOperation>('queue');
    return all
      .filter(op => op.table === table)
      .sort(this.sortByPriorityAndTimestamp);
  }

  // Get operations by date range
  async getByDateRange(start: Date, end: Date): Promise<OfflineOperation[]> {
    this.ensureInitialized();

    const all = await this.storage.getAll<OfflineOperation>('queue');
    const startTime = start.getTime();
    const endTime = end.getTime();

    return all
      .filter(op => op.timestamp >= startTime && op.timestamp <= endTime)
      .sort(this.sortByPriorityAndTimestamp);
  }

  // Get operations in batch with pagination
  async getBatch(limit: number = 50, offset: number = 0): Promise<OfflineOperation[]> {
    this.ensureInitialized();

    const all = await this.storage.getAll<OfflineOperation>('queue');
    return all
      .sort(this.sortByPriorityAndTimestamp)
      .slice(offset, offset + limit);
  }

  // Sort by priority (high > normal > low) then by timestamp
  private sortByPriorityAndTimestamp(a: OfflineOperation, b: OfflineOperation): number {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    const priorityA = priorityOrder[a.priority || 'normal'];
    const priorityB = priorityOrder[b.priority || 'normal'];

    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Higher priority first
    }

    return a.timestamp - b.timestamp; // Earlier timestamp first
  }

  // Reorder queue by priority
  async reorder(): Promise<void> {
    this.ensureInitialized();

    // This method is mainly for triggering re-sorting
    // The actual sorting happens in the get methods
    const all = await this.getAll();
    await this.storage.transaction(['queue'], async () => {
      for (const operation of all) {
        await this.storage.set(operation.id, operation, 'queue');
      }
    });
  }

  // Mark operation as synced
  async markAsSynced(id: string): Promise<void> {
    this.ensureInitialized();

    const operation = await this.getById(id);
    if (operation) {
      operation.synced = true;
      await this.storage.set(id, operation, 'queue');
    }
  }

  // Update operation retry count
  async incrementRetryCount(id: string, error?: string): Promise<void> {
    this.ensureInitialized();

    const operation = await this.getById(id);
    if (operation) {
      operation.retryCount += 1;
      if (error) {
        operation.error = error;
      }
      await this.storage.set(id, operation, 'queue');
    }
  }

  // Remove operation from queue
  async remove(id: string): Promise<void> {
    this.ensureInitialized();

    await this.storage.remove(id, 'queue');
  }

  // Clear all synced operations
  async clearSynced(): Promise<void> {
    this.ensureInitialized();

    const all = await this.getAll();
    const synced = all.filter(op => op.synced);

    await this.storage.transaction(['queue'], async () => {
      for (const operation of synced) {
        await this.storage.remove(operation.id, 'queue');
      }
    });
  }

  // Clear all operations
  async clear(): Promise<void> {
    this.ensureInitialized();

    await this.storage.clear('queue');
  }

  // Get operations that need retry
  async getRetryable(maxRetries?: number): Promise<OfflineOperation[]> {
    this.ensureInitialized();

    const all = await this.storage.getAll<OfflineOperation>('queue');
    const max = maxRetries || this.maxRetries;

    return all
      .filter(op => !op.synced && op.retryCount < max)
      .sort(this.sortByPriorityAndTimestamp);
  }

  // Get failed operations
  async getFailed(): Promise<OfflineOperation[]> {
    this.ensureInitialized();

    const all = await this.storage.getAll<OfflineOperation>('queue');
    return all.filter(op => !op.synced && op.retryCount >= this.maxRetries);
  }

  // Get queue stats
  async getStats(): Promise<QueueStats> {
    this.ensureInitialized();

    const all = await this.getAll();
    const synced = all.filter(op => op.synced);
    const unsynced = all.filter(op => !op.synced);
    const retryable = await this.getRetryable();
    const failed = await this.getFailed();

    // Group by table
    const byTable: Record<string, number> = {};
    all.forEach(op => {
      byTable[op.table] = (byTable[op.table] || 0) + 1;
    });

    return {
      total: all.length,
      synced: synced.length,
      unsynced: unsynced.length,
      retryable: retryable.length,
      failed: failed.length,
      byTable,
    };
  }

  // Get stats by table
  async getStatsByTable(): Promise<Record<string, QueueStats>> {
    this.ensureInitialized();

    const all = await this.getAll();
    const byTable: Record<string, OfflineOperation[]> = {};

    all.forEach(op => {
      if (!byTable[op.table]) {
        byTable[op.table] = [];
      }
      byTable[op.table].push(op);
    });

    const stats: Record<string, QueueStats> = {};

    for (const [table, operations] of Object.entries(byTable)) {
      const synced = operations.filter(op => op.synced);
      const unsynced = operations.filter(op => !op.synced);
      const retryable = unsynced.filter(op => op.retryCount < this.maxRetries);
      const failed = unsynced.filter(op => op.retryCount >= this.maxRetries);

      stats[table] = {
        total: operations.length,
        synced: synced.length,
        unsynced: unsynced.length,
        retryable: retryable.length,
        failed: failed.length,
        byTable: {},
      };
    }

    return stats;
  }

  // Update operation data
  async update(id: string, updates: Partial<OfflineOperation>): Promise<void> {
    this.ensureInitialized();

    const operation = await this.getById(id);
    if (operation) {
      const updated = { ...operation, ...updates };
      await this.storage.set(id, updated, 'queue');
    }
  }

  // Check if queue is empty
  async isEmpty(): Promise<boolean> {
    this.ensureInitialized();

    const all = await this.getAll();
    return all.length === 0;
  }

  // Get queue size
  async size(): Promise<number> {
    this.ensureInitialized();

    const all = await this.getAll();
    return all.length;
  }
}
