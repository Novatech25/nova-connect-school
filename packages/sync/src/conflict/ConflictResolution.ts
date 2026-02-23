import { ConflictStrategy as NewConflictStrategy, ConflictRecord } from './types';
import { getConflictStrategy } from './strategies';
import { StorageAdapter } from '../storage/types';

// Legacy types for backward compatibility
export type ConflictStrategy = "client-wins" | "server-wins" | "last-write-wins" | "merge";

export interface Conflict {
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  timestamp: number;
  tableName: string;
  recordId: string;
}

export type ConflictResolution = {
  strategy: ConflictStrategy;
  resolvedData?: Record<string, unknown>;
};

/**
 * Enhanced ConflictResolver with type-specific strategies
 */
export class ConflictResolver {
  private storage: StorageAdapter | null = null;
  private conflictCache: ConflictRecord[] = [];

  constructor(storage?: StorageAdapter) {
    if (storage) {
      this.storage = storage;
    }
  }

  /**
   * Legacy resolve method for backward compatibility
   */
  resolve(conflict: Conflict, strategy: ConflictStrategy = "last-write-wins"): ConflictResolution {
    switch (strategy) {
      case "client-wins":
        return {
          strategy,
          resolvedData: conflict.localData,
        };

      case "server-wins":
        return {
          strategy,
          resolvedData: conflict.serverData,
        };

      case "last-write-wins":
        // Compare timestamps (assuming both have updated_at field)
        const localTimestamp = (conflict.localData.updated_at as number) || conflict.timestamp;
        const serverTimestamp = (conflict.serverData.updated_at as number) || 0;

        return {
          strategy,
          resolvedData: localTimestamp > serverTimestamp ? conflict.localData : conflict.serverData,
        };

      case "merge":
        return {
          strategy,
          resolvedData: this.merge(conflict.localData, conflict.serverData),
        };

      default:
        throw new Error(`Unknown conflict strategy: ${strategy}`);
    }
  }

  /**
   * Detect conflict between local and server data
   */
  async detectConflict(
    table: string,
    recordId: string,
    localData: any,
    serverData: any
  ): Promise<ConflictRecord | null> {
    // Check if data is different
    if (!this.isDataDifferent(localData, serverData)) {
      return null;
    }

    // Check update timestamps
    const localUpdatedAt = new Date(localData.updated_at || localData.created_at || 0);
    const serverUpdatedAt = new Date(serverData.updated_at || serverData.created_at || 0);

    // If local was updated after server, there might be a conflict
    if (localUpdatedAt > serverUpdatedAt) {
      return {
        id: crypto.randomUUID(),
        table,
        recordId,
        localData,
        serverData,
        detectedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * Resolve conflict by table using type-specific strategy
   */
  async resolveByTable(conflict: ConflictRecord): Promise<{
    action: 'keep_local' | 'keep_server' | 'keep_both' | 'merge' | 'manual';
    resolvedData?: any;
    requiresAdminIntervention: boolean;
    message: string;
  }> {
    const strategy = getConflictStrategy(conflict.table);
    const resolution = await strategy.resolve(conflict);

    // Determine resolved data based on action
    let resolvedData: any;

    switch (resolution.action) {
      case 'keep_local':
        resolvedData = conflict.localData;
        break;
      case 'keep_server':
        resolvedData = conflict.serverData;
        break;
      case 'keep_both':
        // For append-only scenarios like payments
        resolvedData = {
          local: conflict.localData,
          server: conflict.serverData,
        };
        break;
      case 'merge':
        resolvedData = resolution.data?.mergedData || this.merge(conflict.localData, conflict.serverData);
        break;
      case 'manual':
        // Store in conflict cache for manual resolution
        await this.storeConflict(conflict);
        resolvedData = null;
        break;
    }

    return {
      action: resolution.action,
      resolvedData,
      requiresAdminIntervention: resolution.requiresAdminIntervention,
      message: resolution.message,
    };
  }

  /**
   * Check if conflict requires manual resolution
   */
  requiresManualResolution(conflict: ConflictRecord): boolean {
    const strategy = getConflictStrategy(conflict.table);
    return strategy.resolve(conflict).then(resolution => resolution.requiresAdminIntervention);
  }

  /**
   * Store unresolved conflict in IndexedDB
   */
  private async storeConflict(conflict: ConflictRecord): Promise<void> {
    if (!this.storage) {
      this.conflictCache.push(conflict);
      return;
    }

    try {
      await this.storage.set(conflict.id, conflict, 'conflict_cache');
    } catch (error) {
      console.error('Failed to store conflict:', error);
      this.conflictCache.push(conflict);
    }
  }

  /**
   * Get all unresolved conflicts
   */
  async getUnresolvedConflicts(): Promise<ConflictRecord[]> {
    if (!this.storage) {
      return this.conflictCache.filter(c => !c.resolvedAt);
    }

    try {
      const all = await this.storage.getAll<ConflictRecord>('conflict_cache');
      return all.filter(c => !c.resolvedAt);
    } catch (error) {
      console.error('Failed to get conflicts:', error);
      return [];
    }
  }

  /**
   * Get conflicts by table
   */
  async getConflictsByTable(table: string): Promise<ConflictRecord[]> {
    if (!this.storage) {
      return this.conflictCache.filter(c => c.table === table && !c.resolvedAt);
    }

    try {
      const all = await this.storage.getAll<ConflictRecord>('conflict_cache');
      return all.filter(c => c.table === table && !c.resolvedAt);
    } catch (error) {
      console.error('Failed to get conflicts by table:', error);
      return [];
    }
  }

  /**
   * Manually resolve a conflict
   */
  async resolveManually(
    conflictId: string,
    resolution: 'local' | 'server' | 'merge',
    resolvedBy: string,
    mergedData?: any
  ): Promise<void> {
    if (!this.storage) {
      const conflict = this.conflictCache.find(c => c.id === conflictId);
      if (conflict) {
        conflict.resolvedAt = new Date();
        conflict.resolution = resolution === 'merge' ? 'merge' : `client-wins`;
        conflict.resolvedBy = resolvedBy;
      }
      return;
    }

    try {
      const conflict = await this.storage.get<ConflictRecord>(conflictId);
      if (conflict) {
        conflict.resolvedAt = new Date();
        conflict.resolution = resolution === 'merge' ? 'merge' : `client-wins`;
        conflict.resolvedBy = resolvedBy;
        await this.storage.set(conflictId, conflict, 'conflict_cache');
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    }
  }

  /**
   * Merge two objects (simple implementation)
   */
  private merge(local: Record<string, unknown>, server: Record<string, unknown>): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...server };

    for (const [key, localValue] of Object.entries(local)) {
      const serverValue = merged[key];

      // If server doesn't have the field, use local
      if (serverValue === undefined) {
        merged[key] = localValue;
      }
      // If both are objects, merge recursively
      else if (
        typeof localValue === "object" &&
        localValue !== null &&
        !Array.isArray(localValue) &&
        typeof serverValue === "object" &&
        serverValue !== null &&
        !Array.isArray(serverValue)
      ) {
        merged[key] = this.merge(
          localValue as Record<string, unknown>,
          serverValue as Record<string, unknown>
        );
      }
      // Otherwise prefer local (client-wins for specific fields)
      else {
        merged[key] = localValue;
      }
    }

    return merged;
  }

  /**
   * Field-level merge with specific strategies per field
   */
  mergeWithFieldStrategies(
    local: Record<string, unknown>,
    server: Record<string, unknown>,
    fieldStrategies: Record<string, ConflictStrategy>
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const key of new Set([...Object.keys(local), ...Object.keys(server)])) {
      const strategy = fieldStrategies[key];

      if (strategy === "server-wins") {
        merged[key] = server[key];
      } else if (strategy === "client-wins") {
        merged[key] = local[key];
      } else {
        // Default to local if not specified
        merged[key] = local[key] !== undefined ? local[key] : server[key];
      }
    }

    return merged;
  }

  /**
   * Check if data is different
   */
  private isDataDifferent(local: any, server: any): boolean {
    const localJson = JSON.stringify(local);
    const serverJson = JSON.stringify(server);
    return localJson !== serverJson;
  }
}
