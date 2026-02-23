import { ConflictStrategy, ConflictRecord, ConflictResolution } from '../types';

/**
 * Default conflict resolution strategy (last-write-wins)
 *
 * For all other data types not covered by specific strategies.
 * Uses timestamp-based resolution.
 */
export class DefaultConflictStrategy implements ConflictStrategy {
  async resolve(conflict: ConflictRecord): Promise<ConflictResolution> {
    const { localData, serverData } = conflict;

    const localUpdatedAt = new Date(localData.updated_at || localData.created_at || 0);
    const serverUpdatedAt = new Date(serverData.updated_at || serverData.created_at || 0);

    // Use most recent update
    if (localUpdatedAt > serverUpdatedAt) {
      return {
        action: 'keep_local',
        reason: 'last_write_wins',
        data: {
          timestamp: localUpdatedAt.toISOString(),
        },
        requiresAdminIntervention: false,
        message: `Local record is more recent (${localUpdatedAt.toISOString()})`,
      };
    }

    if (serverUpdatedAt > localUpdatedAt) {
      return {
        action: 'keep_server',
        reason: 'last_write_wins',
        data: {
          timestamp: serverUpdatedAt.toISOString(),
        },
        requiresAdminIntervention: false,
        message: `Server record is more recent (${serverUpdatedAt.toISOString()})`,
      };
    }

    // Timestamps are equal, check if data differs
    if (this.isDataDifferent(localData, serverData)) {
      return {
        action: 'manual',
        reason: 'concurrent_updates',
        data: {
          localData,
          serverData,
        },
        requiresAdminIntervention: true,
        message: 'Concurrent updates detected. Admin intervention required.',
      };
    }

    // Data is identical
    return {
      action: 'keep_server',
      reason: 'identical_data',
      requiresAdminIntervention: false,
      message: 'Data is identical, no conflict',
    };
  }

  /**
   * Check if data is different
   */
  private isDataDifferent(local: any, server: any): boolean {
    const localJson = JSON.stringify(local);
    const serverJson = JSON.stringify(server);
    return localJson !== serverJson;
  }

  /**
   * Get conflict description
   */
  getDescription(conflict: ConflictRecord): string {
    const { table, recordId } = conflict;
    return `Conflict in ${table} for record ${recordId}`;
  }

  /**
   * Get suggested resolutions
   */
  getSuggestions(conflict: ConflictRecord): Array<{
    action: string;
    description: string;
    data?: any;
  }> {
    return [
      {
        action: 'keep_local',
        description: 'Use local version',
        data: { data: conflict.localData },
      },
      {
        action: 'keep_server',
        description: 'Use server version',
        data: { data: conflict.serverData },
      },
    ];
  }
}
