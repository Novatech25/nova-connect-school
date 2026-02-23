import { StorageAdapter } from '../storage/types';
import { ConflictResolver } from '../conflict/ConflictResolution';

export interface PullSyncOptions {
  tables: string[];
  lastSync?: Date;
  batchSize?: number;
  onProgress?: (table: string, pulled: number, total: number) => void;
  onConflict?: (conflict: any) => void;
}

export interface PullSyncResult {
  table: string;
  pulled: number;
  conflicts: number;
  errors: string[];
  lastSyncTimestamp: Date;
}

export class PullSyncManager {
  private storage: StorageAdapter;
  private conflictResolver: ConflictResolver;
  private supabase: any; // Supabase client
  private tablePriorities: string[];

  constructor(storage: StorageAdapter, conflictResolver: ConflictResolver, supabase: any) {
    this.storage = storage;
    this.conflictResolver = conflictResolver;
    this.supabase = supabase;
    this.tablePriorities = [
      'attendance',          // Critical - time-sensitive
      'grades',              // Critical - student evaluation
      'payments',            // Critical - financial
      'schedules',           // Important - organization
      'lesson_logs',         // Important - educational records
      'students',            // Reference data
      'teachers',            // Reference data
      'classes',             // Reference data
      'subjects',            // Reference data
      'rooms',               // Reference data
    ];
  }

  /**
   * Pull changes from cloud for multiple tables
   */
  async pullFromCloud(options: PullSyncOptions): Promise<PullSyncResult[]> {
    const results: PullSyncResult[] = [];

    // Sort tables by priority
    const sortedTables = this.sortTablesByPriority(options.tables);

    for (const table of sortedTables) {
      try {
        const result = await this.pullTable(table, options.lastSync);
        results.push(result);

        // Call progress callback
        if (options.onProgress) {
          options.onProgress(table, result.pulled, result.pulled);
        }
      } catch (error) {
        console.error(`Failed to pull table ${table}:`, error);
        results.push({
          table,
          pulled: 0,
          conflicts: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          lastSyncTimestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Pull changes for a single table with pagination
   */
  async pullTable(table: string, lastSync?: Date): Promise<PullSyncResult> {
    let pulled = 0;
    let conflicts = 0;
    const errors: string[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      try {
        // Query Supabase with pagination
        let query = this.supabase
          .from(table)
          .select('*')
          .order('updated_at', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        // Filter by last sync timestamp
        if (lastSync) {
          query = query.gt('updated_at', lastSync.toISOString());
        }

        const { data, error } = await query;

        if (error) {
          errors.push(error.message);
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        // Process each record
        for (const record of data) {
          try {
            await this.processRecord(table, record);
            pulled++;
          } catch (error) {
            errors.push(`Record ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Check if there are more records
        hasMore = data.length === pageSize;
        page++;

      } catch (error) {
        errors.push(`Page ${page}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        break;
      }
    }

    // Update last sync timestamp for this table
    const lastSyncTimestamp = new Date();
    await this.updateLastSyncTimestamp(table, lastSyncTimestamp);

    return {
      table,
      pulled,
      conflicts,
      errors,
      lastSyncTimestamp,
    };
  }

  /**
   * Process a single pulled record
   */
  private async processRecord(table: string, remoteRecord: any): Promise<void> {
    // Check for local changes in sync_data
    const localRecord = await this.storage.get<any>(remoteRecord.id, 'sync_data');

    if (!localRecord) {
      // No local record, just insert into sync_data (not sync_metadata)
      await this.storage.set(remoteRecord.id, { ...remoteRecord, table }, 'sync_data');
      return;
    }

    // Detect conflicts
    const conflict = await this.conflictResolver.detectConflict(
      table,
      remoteRecord.id,
      localRecord,
      remoteRecord
    );

    if (conflict) {
      // Resolve conflict using table-specific strategy
      const resolution = await this.conflictResolver.resolveByTable(conflict);

      if (resolution.requiresAdminIntervention) {
        // Store conflict for manual resolution
        console.warn(`Conflict detected in ${table} for record ${remoteRecord.id}, requiring manual resolution`);
      } else {
        // Apply automatic resolution
        if (resolution.resolvedData) {
          await this.storage.set(remoteRecord.id, { ...resolution.resolvedData, table }, 'sync_data');
        }
      }
    } else {
      // No conflict, update local data in sync_data
      await this.storage.set(remoteRecord.id, { ...remoteRecord, table }, 'sync_data');
    }
  }

  /**
   * Update last sync timestamp for a table
   */
  private async updateLastSyncTimestamp(table: string, timestamp: Date): Promise<void> {
    const metadataKey = `lastSync_${table}`;
    await this.storage.set(metadataKey, timestamp.toISOString(), 'sync_metadata');
  }

  /**
   * Get last sync timestamp for a table
   */
  async getLastSyncTimestamp(table: string): Promise<Date | null> {
    const metadataKey = `lastSync_${table}`;
    const timestamp = await this.storage.get<string>(metadataKey, 'sync_metadata');

    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Get all last sync timestamps
   */
  async getAllLastSyncTimestamps(): Promise<Record<string, Date>> {
    const timestamps: Record<string, Date> = {};

    try {
      // Read keys directly from sync_metadata store
      const keys = await this.storage.keys('sync_metadata');

      for (const key of keys) {
        if (key.startsWith('lastSync_')) {
          const timestamp = await this.storage.get<string>(key, 'sync_metadata');
          if (timestamp) {
            const table = key.replace('lastSync_', '');
            timestamps[table] = new Date(timestamp);
          }
        }
      }
    } catch (error) {
      console.error('Failed to get last sync timestamps:', error);
    }

    return timestamps;
  }

  /**
   * Detect local changes that haven't been synced
   */
  async detectLocalChanges(table: string): Promise<any[]> {
    // This would check local storage for changes since last sync
    // Implementation depends on how local changes are tracked
    return [];
  }

  /**
   * Sort tables by sync priority
   */
  private sortTablesByPriority(tables: string[]): string[] {
    return tables.sort((a, b) => {
      const indexA = this.tablePriorities.indexOf(a);
      const indexB = this.tablePriorities.indexOf(b);

      // If both tables have priorities, sort by priority
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      // If only one has priority, prioritize that one
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;

      // If neither has priority, maintain original order
      return 0;
    });
  }

  /**
   * Get table priority
   */
  getTablePriority(table: string): number {
    const index = this.tablePriorities.indexOf(table);
    return index !== -1 ? index : this.tablePriorities.length;
  }

  /**
   * Check if table should be synced now based on priority
   */
  shouldSyncTable(table: string, criticalOnly: boolean = false): boolean {
    const priority = this.getTablePriority(table);

    // If critical only, only sync top 3 priorities
    if (criticalOnly) {
      return priority < 3;
    }

    return true;
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    tablesSynced: number;
    lastSyncTimes: Record<string, Date | null>;
    tablesNeedingSync: string[];
  }> {
    const lastSyncTimes = await this.getAllLastSyncTimestamps();
    const tablesNeedingSync: string[] = [];

    // Check which tables need sync (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    for (const [table, lastSync] of Object.entries(lastSyncTimes)) {
      if (!lastSync || lastSync < fiveMinutesAgo) {
        tablesNeedingSync.push(table);
      }
    }

    return {
      tablesSynced: Object.keys(lastSyncTimes).length,
      lastSyncTimes,
      tablesNeedingSync,
    };
  }
}
