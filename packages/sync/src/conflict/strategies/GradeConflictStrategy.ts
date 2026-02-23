import { ConflictStrategy, ConflictRecord, ConflictResolution } from '../types';

/**
 * Grade conflict resolution strategy (versioning)
 *
 * Each modification creates a new version in grade_versions.
 * In case of conflict:
 * - Compare version_number and updated_at
 * - If versions diverge: create conflict entry with both versions
 * - Admin must choose which version to publish
 * - After publication, grade is locked (except for correction versioning)
 */
export class GradeConflictStrategy implements ConflictStrategy {
  async resolve(conflict: ConflictRecord): Promise<ConflictResolution> {
    const { localData, serverData } = conflict;

    const localVersion = localData.version_number || 0;
    const serverVersion = serverData.version_number || 0;
    const localUpdatedAt = new Date(localData.updated_at || 0);
    const serverUpdatedAt = new Date(serverData.updated_at || 0);

    // If one version is clearly newer, use it
    if (localVersion > serverVersion) {
      return {
        action: 'keep_local',
        reason: 'higher_version_number',
        data: {
          localVersion,
          serverVersion,
        },
        requiresAdminIntervention: false,
        message: `Local version ${localVersion} is newer than server version ${serverVersion}`,
      };
    }

    if (serverVersion > localVersion) {
      return {
        action: 'keep_server',
        reason: 'higher_version_number',
        data: {
          localVersion,
          serverVersion,
        },
        requiresAdminIntervention: false,
        message: `Server version ${serverVersion} is newer than local version ${localVersion}`,
      };
    }

    // Versions are equal, check timestamps
    if (localUpdatedAt > serverUpdatedAt) {
      // Local is more recent but same version - possible conflict
      return {
        action: 'manual',
        reason: 'same_version_different_data',
        data: {
          localData,
          serverData,
          localVersion,
          serverVersion,
        },
        requiresAdminIntervention: true,
        message: 'Same version number but different data. Admin intervention required.',
      };
    }

    if (serverUpdatedAt > localUpdatedAt) {
      return {
        action: 'keep_server',
        reason: 'more_recent_update',
        data: {
          serverUpdatedAt: serverUpdatedAt.toISOString(),
        },
        requiresAdminIntervention: false,
        message: 'Server has more recent update',
      };
    }

    // Versions and timestamps are equal - check if data is actually different
    if (this.isDataDifferent(localData, serverData)) {
      return {
        action: 'manual',
        reason: 'divergent_versions',
        data: {
          localData,
          serverData,
          differences: this.getDifferences(localData, serverData),
        },
        requiresAdminIntervention: true,
        message: 'Divergent grade versions detected. Admin must choose which version to publish.',
      };
    }

    // Data is identical, no real conflict
    return {
      action: 'keep_server',
      reason: 'identical_data',
      requiresAdminIntervention: false,
      message: 'Data is identical, no conflict',
    };
  }

  /**
   * Check if grade data is different
   */
  private isDataDifferent(local: any, server: any): boolean {
    const relevantFields = ['score', 'coefficient', 'comment', 'is_published'];

    for (const field of relevantFields) {
      if (local[field] !== server[field]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get specific differences between grade versions
   */
  private getDifferences(local: any, server: any): Array<{
    field: string;
    local: any;
    server: any;
  }> {
    const differences: Array<{ field: string; local: any; server: any }> = [];
    const relevantFields = ['score', 'coefficient', 'comment', 'is_published'];

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

    const localScore = localData.score;
    const serverScore = serverData.score;
    const localVersion = localData.version_number || 0;
    const serverVersion = serverData.version_number || 0;

    return `Grade conflict: v${localVersion} (${localScore}) vs v${serverVersion} (${serverScore}) for student ${localData.student_id}`;
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
    const differences = this.getDifferences(localData, serverData);

    return [
      {
        action: 'keep_local',
        description: 'Publish local version',
        data: {
          version: localData.version_number,
          score: localData.score,
        },
      },
      {
        action: 'keep_server',
        description: 'Publish server version',
        data: {
          version: serverData.version_number,
          score: serverData.score,
        },
      },
      {
        action: 'merge_and_version',
        description: 'Create new version merging changes',
        data: {
          localData,
          serverData,
          differences,
        },
      },
      {
        action: 'create_correction',
        description: 'Create correction version (preserves history)',
        data: {
          localData,
          serverData,
        },
      },
    ];
  }

  /**
   * Check if grade is locked
   */
  isGradeLocked(gradeData: any): boolean {
    // Published grades are locked
    if (gradeData.is_published && gradeData.locked_after_publish) {
      return true;
    }

    // Grades with final evaluation are locked
    if (gradeData.is_final) {
      return true;
    }

    // Grades from closed evaluation periods
    if (gradeData.evaluation_period_status === 'closed') {
      return true;
    }

    return false;
  }
}
