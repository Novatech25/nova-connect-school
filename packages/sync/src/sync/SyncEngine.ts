import { OfflineQueue, type OfflineOperation } from "../queue/OfflineQueue";
import { ConflictResolver } from '../conflict/ConflictResolution';
import { PullSyncManager, PullSyncResult } from './PullSyncManager';
import { RetryManager } from './RetryManager';
import { GatewayDetector } from '../gateway/GatewayDetector';
import { GatewaySwitch } from '../gateway/GatewaySwitch';
import { getSupabaseClient } from "@novaconnect/data/client";

export type SyncStatus = "idle" | "syncing" | "error";
export type SyncMode = "gateway" | "cloud" | "offline";

export type SyncResult = {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ operationId: string; error: string }>;
};

export type BidirectionalSyncResult = SyncResult & {
  pullResults?: PullSyncResult[];
  mode: SyncMode;
};

export class SyncEngine {
  private queue: OfflineQueue;
  private supabase: any;
  private status: SyncStatus = "idle";
  private mode: SyncMode = "cloud";
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private modeListeners: Set<(mode: SyncMode) => void> = new Set();
  private retryManager: RetryManager;
  private pullSyncManager: PullSyncManager;
  private conflictResolver: ConflictResolver;
  private gatewayDetector?: GatewayDetector;
  private gatewaySwitch: GatewaySwitch;

  constructor(
    queue: OfflineQueue,
    gatewayDetector?: GatewayDetector
  ) {
    this.queue = queue;
    this.supabase = getSupabaseClient();
    this.retryManager = new RetryManager();
    this.conflictResolver = new ConflictResolver(queue.getStorage());
    this.pullSyncManager = new PullSyncManager(
      queue.getStorage(),
      this.conflictResolver,
      this.supabase
    );
    this.gatewayDetector = gatewayDetector;
    this.gatewaySwitch = new GatewaySwitch(this.supabase);

    // Initialize mode
    this.detectAndSetMode();
  }

  /**
   * Detect and set sync mode (Gateway vs Cloud)
   */
  private async detectAndSetMode(): Promise<void> {
    if (this.gatewayDetector) {
      const gateway = await this.gatewayDetector.detectGateway();
      this.mode = gateway ? 'gateway' : 'cloud';
    } else {
      this.mode = 'cloud';
    }
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to sync mode changes
   */
  subscribeToMode(listener: (mode: SyncMode) => void): () => void {
    this.modeListeners.add(listener);
    return () => this.modeListeners.delete(listener);
  }

  /**
   * Update status and notify listeners
   */
  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.listeners.forEach((listener) => listener(status));
  }

  /**
   * Update mode and notify listeners
   */
  private setMode(mode: SyncMode): void {
    this.mode = mode;
    this.modeListeners.forEach((listener) => listener(mode));
    console.log(`[SyncEngine] Mode changed to: ${mode}`);
  }

  /**
   * Get current status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Get current sync mode
   */
  getMode(): SyncMode {
    return this.mode;
  }

  /**
   * Sync all pending operations (push only)
   */
  async sync(): Promise<SyncResult> {
    if (this.status === "syncing") {
      throw new Error("Sync already in progress");
    }

    return this._syncInternal();
  }

  /**
   * Internal sync method without status guard (for bidirectional sync)
   */
  private async _syncInternal(): Promise<SyncResult> {
    const unsynced = await this.queue.getUnsynced();
    if (unsynced.length === 0) {
      return { success: true, synced: 0, failed: 0, errors: [] };
    }

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const operation of unsynced) {
      try {
        await this.syncOperation(operation);
        await this.queue.markAsSynced(operation.id);
        this.retryManager.removeSchedule(operation.id);
        result.synced++;
      } catch (error) {
        await this.queue.incrementRetryCount(
          operation.id,
          error instanceof Error ? error.message : 'Unknown error'
        );
        result.failed++;
        result.errors.push({
          operationId: operation.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        // Schedule retry if appropriate
        const errorObj = error instanceof Error ? error : new Error('Unknown error');
        if (this.retryManager.shouldRetry(operation, errorObj)) {
          this.retryManager.scheduleRetry(operation, errorObj);
        }
      }
    }

    // Clean up synced operations
    await this.queue.clearSynced();

    return result;
  }

  /**
   * Bidirectional sync: push local changes, then pull remote changes
   */
  async syncBidirectional(tables?: string[]): Promise<BidirectionalSyncResult> {
    this.setStatus("syncing");

    try {
      // Push local changes (using internal method to bypass status check)
      const pushResult = await this._syncInternal();

      // Pull remote changes
      const pullResults = tables
        ? await this.pullFromCloud(tables)
        : await this.pullFromCloud([
            'attendance',
            'grades',
            'payments',
            'schedules',
            'lesson_logs',
          ]);

      return {
        ...pushResult,
        pullResults,
        mode: this.mode,
      };
    } finally {
      this.setStatus("idle");
    }
  }

  /**
   * Pull changes from cloud (pull sync)
   */
  async pullFromCloud(tables: string[]): Promise<PullSyncResult[]> {
    const lastSyncTimestamps = await this.pullSyncManager.getAllLastSyncTimestamps();

    return this.pullSyncManager.pullFromCloud({
      tables,
      onProgress: (table, pulled, total) => {
        console.log(`[SyncEngine] Pulled ${pulled} records from ${table}`);
      },
    });
  }

  /**
   * Sync a single operation
   */
  private async syncOperation(operation: OfflineOperation): Promise<void> {
    const { type, table, data } = operation;

    switch (type) {
      case "create":
        await this.create(table, data);
        break;
      case "update":
        await this.update(table, data);
        break;
      case "delete":
        await this.delete(table, data);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  /**
   * Create record
   */
  private async create(table: string, data: Record<string, unknown>): Promise<void> {
    const client = this.gatewaySwitch.getCurrentClient();
    const { error } = await client.from(table).insert(data);

    if (error) throw error;
  }

  /**
   * Update record
   */
  private async update(table: string, data: Record<string, unknown>): Promise<void> {
    const { id, ...updateData } = data as { id: string };
    const client = this.gatewaySwitch.getCurrentClient();
    const { error } = await client.from(table).update(updateData).eq("id", id);

    if (error) throw error;
  }

  /**
   * Delete record
   */
  private async delete(table: string, data: Record<string, unknown>): Promise<void> {
    const { id } = data as { id: string };
    const client = this.gatewaySwitch.getCurrentClient();
    const { error } = await client.from(table).delete().eq("id", id);

    if (error) throw error;
  }

  /**
   * Retry failed operations
   */
  async retryFailed(): Promise<SyncResult> {
    const readyOps = this.retryManager.getReadyOperations();
    const failedOps = await this.queue.getFailed();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const operationId of readyOps) {
      const operation = await this.queue.getById(operationId);
      if (operation) {
        try {
          await this.syncOperation(operation);
          await this.queue.markAsSynced(operation.id);
          this.retryManager.removeSchedule(operation.id);
          result.synced++;
        } catch (error) {
          await this.queue.incrementRetryCount(
            operation.id,
            error instanceof Error ? error.message : 'Unknown error'
          );
          result.failed++;
          result.errors.push({
            operationId: operation.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          // Reschedule if max retries not reached
          const errorObj = error instanceof Error ? error : new Error('Unknown error');
          if (this.retryManager.shouldRetry(operation, errorObj)) {
            this.retryManager.scheduleRetry(operation, errorObj);
          } else {
            this.retryManager.removeSchedule(operation.id);
          }
        }
      }
    }

    return result;
  }

  /**
   * Force retry all operations (even if not ready yet)
   */
  async forceRetryAll(): Promise<SyncResult> {
    const failedOps = await this.queue.getFailed();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const operation of failedOps) {
      try {
        await this.syncOperation(operation);
        await this.queue.markAsSynced(operation.id);
        this.retryManager.removeSchedule(operation.id);
        result.synced++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          operationId: operation.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  /**
   * Get retry manager statistics
   */
  getRetryStats() {
    return this.retryManager.getStats();
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const queueStats = await this.queue.getStats();
    const syncStats = await this.pullSyncManager.getSyncStats();

    return {
      ...queueStats,
      ...syncStats,
      mode: this.mode,
      status: this.status,
    };
  }

  /**
   * Auto-sync on interval
   */
  startAutoSync(intervalMs = 30000): () => void {
    const intervalId = setInterval(async () => {
      if (navigator.onLine) {
        try {
          // Check for Gateway availability
          if (this.gatewayDetector) {
            await this.detectAndSetMode();
          }

          // Perform bidirectional sync
          await this.syncBidirectional();
        } catch (error) {
          console.error("Auto-sync failed:", error);
        }
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }

  /**
   * Start retry scheduler
   */
  startRetryScheduler(intervalMs = 5000): () => void {
    const intervalId = setInterval(async () => {
      await this.retryFailed();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }

  /**
   * Switch to Gateway mode
   */
  async switchToGateway(gatewayUrl: string): Promise<void> {
    await this.gatewaySwitch.switchToGateway(gatewayUrl);
    this.setMode('gateway');

    // Sync immediately after switching
    await this.syncBidirectional();
  }

  /**
   * Switch to Cloud mode
   */
  async switchToCloud(): Promise<void> {
    await this.gatewaySwitch.switchToCloud();
    this.setMode('cloud');

    // Sync immediately after switching
    await this.syncBidirectional();
  }

  /**
   * Get current mode
   */
  getCurrentMode(): SyncMode {
    return this.gatewaySwitch.getCurrentMode();
  }
}
