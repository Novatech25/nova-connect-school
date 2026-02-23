import { ConflictStrategy, ConflictRecord, ConflictResolution } from '../types';

/**
 * Schedule conflict resolution strategy (versioning)
 *
 * Published schedule = immutable version in schedule_versions.
 * In case of conflict:
 * - Draft version: last-write-wins based on updated_at
 * - Published version: error, requires admin intervention
 * - Verify constraints (teacher/room double-booking) before resolution
 */
export class ScheduleConflictStrategy implements ConflictStrategy {
  async resolve(conflict: ConflictRecord): Promise<ConflictResolution> {
    const { localData, serverData } = conflict;

    const isLocalPublished = localData.is_published || false;
    const isServerPublished = serverData.is_published || false;

    // If both are published, this is a critical conflict
    if (isLocalPublished && isServerPublished) {
      return {
        action: 'manual',
        reason: 'both_published',
        data: {
          localData,
          serverData,
        },
        requiresAdminIntervention: true,
        message: 'Both schedule versions are published. Critical conflict requiring admin intervention.',
      };
    }

    // If only one is published, use the published version
    if (isLocalPublished && !isServerPublished) {
      return {
        action: 'keep_local',
        reason: 'published_version',
        data: {
          localData,
          serverData,
        },
        requiresAdminIntervention: false,
        message: 'Local version is published, server is draft. Using published version.',
      };
    }

    if (isServerPublished && !isLocalPublished) {
      return {
        action: 'keep_server',
        reason: 'published_version',
        data: {
          localData,
          serverData,
        },
        requiresAdminIntervention: false,
        message: 'Server version is published, local is draft. Using published version.',
      };
    }

    // Both are drafts - use last-write-wins
    const localUpdatedAt = new Date(localData.updated_at || 0);
    const serverUpdatedAt = new Date(serverData.updated_at || 0);

    if (localUpdatedAt > serverUpdatedAt) {
      // Check constraints before applying local version
      const constraintCheck = await this.checkConstraints(localData);

      if (!constraintCheck.valid) {
        return {
          action: 'manual',
          reason: 'constraint_violation',
          data: {
            localData,
            serverData,
            constraints: constraintCheck.violations,
          },
          requiresAdminIntervention: true,
          message: `Local version violates constraints: ${constraintCheck.violations.join(', ')}`,
        };
      }

      return {
        action: 'keep_local',
        reason: 'last_write_wins',
        data: {
          timestamp: localUpdatedAt.toISOString(),
        },
        requiresAdminIntervention: false,
        message: 'Local draft is more recent (last-write-wins)',
      };
    }

    if (serverUpdatedAt > localUpdatedAt) {
      // Check constraints before applying server version
      const constraintCheck = await this.checkConstraints(serverData);

      if (!constraintCheck.valid) {
        return {
          action: 'manual',
          reason: 'constraint_violation',
          data: {
            localData,
            serverData,
            constraints: constraintCheck.violations,
          },
          requiresAdminIntervention: true,
          message: `Server version violates constraints: ${constraintCheck.violations.join(', ')}`,
        };
      }

      return {
        action: 'keep_server',
        reason: 'last_write_wins',
        data: {
          timestamp: serverUpdatedAt.toISOString(),
        },
        requiresAdminIntervention: false,
        message: 'Server draft is more recent (last-write-wins)',
      };
    }

    // Timestamps are equal, check if data is different
    if (this.isDataDifferent(localData, serverData)) {
      return {
        action: 'manual',
        reason: 'concurrent_edits',
        data: {
          localData,
          serverData,
          differences: this.getDifferences(localData, serverData),
        },
        requiresAdminIntervention: true,
        message: 'Concurrent edits at the same time. Admin must choose which version to keep.',
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
   * Check scheduling constraints (teacher/room availability)
   */
  private async checkConstraints(scheduleData: any): Promise<{
    valid: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];

    // Note: In a real implementation, this would query the database
    // to check for overlapping sessions. For now, we return valid.

    // Example checks that would be implemented:
    // - Teacher not double-booked at this time
    // - Room not double-booked at this time
    // - Class not already scheduled at this time
    // - Teacher is available (not on leave)
    // - Room is available (not under maintenance)

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Check if schedule data is different
   */
  private isDataDifferent(local: any, server: any): boolean {
    const relevantFields = [
      'subject_id',
      'teacher_id',
      'room_id',
      'class_id',
      'start_time',
      'end_time',
      'day_of_week',
      'is_published',
    ];

    for (const field of relevantFields) {
      if (local[field] !== server[field]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get specific differences between schedule versions
   */
  private getDifferences(local: any, server: any): Array<{
    field: string;
    local: any;
    server: any;
  }> {
    const differences: Array<{ field: string; local: any; server: any }> = [];
    const relevantFields = [
      'subject_id',
      'teacher_id',
      'room_id',
      'class_id',
      'start_time',
      'end_time',
      'day_of_week',
      'is_published',
    ];

    for (const field of relevantFields) {
      if (local[field] !== server[field]) {
        differences.push({
          field,
          local: local[field],
          server: server[field],
        });
      }
    }

    return differences;
  }

  /**
   * Get conflict description for UI
   */
  getDescription(conflict: ConflictRecord): string {
    const { localData, serverData } = conflict;

    const isLocalPublished = localData.is_published || false;
    const isServerPublished = serverData.is_published || false;

    const subject = localData.subject_name || localData.subject_id;
    const day = localData.day_of_week;

    if (isLocalPublished && isServerPublished) {
      return `Critical: Both published schedules conflict for ${subject} on ${day}`;
    }

    if (isLocalPublished || isServerPublished) {
      return `Schedule conflict: ${isLocalPublished ? 'published' : 'draft'} vs ${isServerPublished ? 'published' : 'draft'} for ${subject} on ${day}`;
    }

    return `Schedule draft conflict for ${subject} on ${day}`;
  }

  /**
   * Get suggested resolutions for admin
   */
  getSuggestions(conflict: ConflictRecord): Array<{
    action: string;
    description: string;
    data?: any;
  }> {
    const { localData, serverData } = conflict;

    const isLocalPublished = localData.is_published || false;
    const isServerPublished = serverData.is_published || false;

    if (isLocalPublished && isServerPublished) {
      return [
        {
          action: 'keep_local',
          description: 'Keep local published version (create new version from server draft)',
          data: { localData, serverData },
        },
        {
          action: 'keep_server',
          description: 'Keep server published version (create new version from local draft)',
          data: { localData, serverData },
        },
        {
          action: 'unpublish_and_merge',
          description: 'Unpublish both, merge into new draft, then republish',
          data: { localData, serverData },
        },
      ];
    }

    return [
      {
        action: 'keep_local',
        description: 'Use local version',
        data: { localData, serverData },
      },
      {
        action: 'keep_server',
        description: 'Use server version',
        data: { localData, serverData },
      },
      {
        action: 'merge',
        description: 'Merge changes into new version',
        data: { localData, serverData },
      },
    ];
  }
}
