import { ConflictStrategy, ConflictRecord, ConflictResolution } from '../types';

/**
 * Attendance conflict resolution strategy (merge)
 *
 * Two sources: teacher_manual and qr_scan.
 * Configurable merge strategy in school_settings.attendance_merge_strategy:
 * - teacher_wins: Teacher presence overrides QR (default)
 * - qr_wins: QR overrides teacher (rare)
 * - coexist: Both records coexist, show both sources
 * - teacher_validates: QR creates "auto" presence, teacher confirms/overrides
 */
export class AttendanceConflictStrategy implements ConflictStrategy {
  private mergeStrategy: 'teacher_wins' | 'qr_wins' | 'coexist' | 'teacher_validates';

  constructor(mergeStrategy: 'teacher_wins' | 'qr_wins' | 'coexist' | 'teacher_validates' = 'teacher_wins') {
    this.mergeStrategy = mergeStrategy;
  }

  async resolve(conflict: ConflictRecord): Promise<ConflictResolution> {
    const { localData, serverData } = conflict;

    const localSource = localData.source || 'unknown';
    const serverSource = serverData.source || 'unknown';

    // If sources are different, apply merge strategy
    if (localSource !== serverSource) {
      return this.applyMergeStrategy(localData, serverData);
    }

    // Same source but different data - this is unusual
    // Use most recent based on recorded_at
    const localRecordedAt = new Date(localData.recorded_at || localData.created_at || 0);
    const serverRecordedAt = new Date(serverData.recorded_at || serverData.created_at || 0);

    if (localRecordedAt > serverRecordedAt) {
      return {
        action: 'keep_local',
        reason: 'more_recent_record',
        data: {
          timestamp: localRecordedAt.toISOString(),
        },
        requiresAdminIntervention: false,
        message: `Local record is more recent (${localSource})`,
      };
    }

    if (serverRecordedAt > localRecordedAt) {
      return {
        action: 'keep_server',
        reason: 'more_recent_record',
        data: {
          timestamp: serverRecordedAt.toISOString(),
        },
        requiresAdminIntervention: false,
        message: `Server record is more recent (${serverSource})`,
      };
    }

    // Same source and timestamp - check if status differs
    if (localData.status !== serverData.status) {
      // Prefer "present" over "absent" over other statuses
      const statusPreference = { present: 3, absent: 2, late: 1, excused: 1 };
      const localPreference = statusPreference[localData.status as keyof typeof statusPreference] || 0;
      const serverPreference = statusPreference[serverData.status as keyof typeof statusPreference] || 0;

      if (localPreference > serverPreference) {
        return {
          action: 'keep_local',
          reason: 'status_preference',
          data: {
            localStatus: localData.status,
            serverStatus: serverData.status,
          },
          requiresAdminIntervention: false,
          message: `Local status (${localData.status}) preferred over server (${serverData.status})`,
        };
      }

      if (serverPreference > localPreference) {
        return {
          action: 'keep_server',
          reason: 'status_preference',
          data: {
            localStatus: localData.status,
            serverStatus: serverData.status,
          },
          requiresAdminIntervention: false,
          message: `Server status (${serverData.status}) preferred over local (${localData.status})`,
        };
      }
    }

    // Status is the same or equal preference, check other fields
    if (this.isDataDifferent(localData, serverData)) {
      return {
        action: 'merge',
        reason: 'complementary_data',
        data: {
          mergedData: this.mergeAttendanceData(localData, serverData),
        },
        requiresAdminIntervention: false,
        message: 'Merging complementary attendance data',
      };
    }

    // Data is essentially identical
    return {
      action: 'keep_server',
      reason: 'identical_data',
      requiresAdminIntervention: false,
      message: 'Data is identical, no conflict',
    };
  }

  /**
   * Apply the configured merge strategy
   */
  private applyMergeStrategy(localData: any, serverData: any): ConflictResolution {
    const localSource = localData.source || 'unknown';
    const serverSource = serverData.source || 'unknown';

    switch (this.mergeStrategy) {
      case 'teacher_wins':
        if (localSource === 'teacher_manual') {
          return {
            action: 'keep_local',
            reason: 'teacher_wins_strategy',
            data: {
              strategy: 'teacher_wins',
              localSource,
              serverSource,
            },
            requiresAdminIntervention: false,
            message: 'Teacher manual entry overrides QR scan',
          };
        }
        return {
          action: 'keep_server',
          reason: 'teacher_wins_strategy',
          data: {
            strategy: 'teacher_wins',
            localSource,
            serverSource,
          },
          requiresAdminIntervention: false,
          message: 'Teacher manual entry overrides QR scan',
        };

      case 'qr_wins':
        if (localSource === 'qr_scan') {
          return {
            action: 'keep_local',
            reason: 'qr_wins_strategy',
            data: {
              strategy: 'qr_wins',
              localSource,
              serverSource,
            },
            requiresAdminIntervention: false,
            message: 'QR scan overrides teacher manual entry',
          };
        }
        return {
          action: 'keep_server',
          reason: 'qr_wins_strategy',
          data: {
            strategy: 'qr_wins',
            localSource,
            serverSource,
          },
          requiresAdminIntervention: false,
          message: 'QR scan overrides teacher manual entry',
        };

      case 'coexist':
        return {
          action: 'merge',
          reason: 'coexist_strategy',
          data: {
            strategy: 'coexist',
            localData,
            serverData,
            mergedData: this.createCoexistingRecord(localData, serverData),
          },
          requiresAdminIntervention: false,
          message: 'Both records coexist (showing both sources)',
        };

      case 'teacher_validates':
        // QR creates "auto" presence, teacher must confirm
        const qrRecord = localSource === 'qr_scan' ? localData : serverData;
        const teacherRecord = localSource === 'teacher_manual' ? localData : serverData;

        if (!teacherRecord || teacherRecord.status === 'pending') {
          // No teacher validation yet, use QR as "auto"
          return {
            action: 'merge',
            reason: 'teacher_validates_strategy',
            data: {
              strategy: 'teacher_validates',
              qrRecord,
              mergedData: {
                ...qrRecord,
                record_status: 'auto',
                validation_status: 'pending',
              },
            },
            requiresAdminIntervention: false,
            message: 'QR scan recorded as auto, awaiting teacher validation',
          };
        }

        // Teacher has validated, use teacher record
        return {
          action: 'keep_local',
          reason: 'teacher_validated',
          data: {
            strategy: 'teacher_validates',
            validatedBy: teacherRecord.marked_by,
          },
          requiresAdminIntervention: false,
          message: 'Teacher validated record',
        };

      default:
        return {
          action: 'manual',
          reason: 'unknown_strategy',
          requiresAdminIntervention: true,
          message: 'Unknown merge strategy, admin intervention required',
        };
    }
  }

  /**
   * Merge complementary attendance data
   */
  private mergeAttendanceData(local: any, server: any): any {
    const merged = { ...local };

    // Merge notes if they exist
    if (server.notes && !local.notes) {
      merged.notes = server.notes;
    } else if (local.notes && server.notes && local.notes !== server.notes) {
      merged.notes = `${local.notes}\n${server.notes}`;
    }

    // Use most recent timestamp
    const localTime = new Date(local.recorded_at || local.created_at || 0);
    const serverTime = new Date(server.recorded_at || server.created_at || 0);
    merged.recorded_at = localTime > serverTime ? local.recorded_at : server.recorded_at;

    // Keep track of both sources
    merged.sources = [local.source || 'unknown', server.source || 'unknown'].filter(Boolean);

    return merged;
  }

  /**
   * Create coexisting record (showing both sources)
   */
  private createCoexistingRecord(local: any, server: any): any {
    return {
      student_id: local.student_id || server.student_id,
      date: local.date || server.date,
      sources: [
        {
          source: local.source || 'unknown',
          status: local.status,
          recorded_at: local.recorded_at || local.created_at,
          marked_by: local.marked_by,
        },
        {
          source: server.source || 'unknown',
          status: server.status,
          recorded_at: server.recorded_at || server.created_at,
          marked_by: server.marked_by,
        },
      ],
      display_mode: 'coexisting',
    };
  }

  /**
   * Check if attendance data is different
   */
  private isDataDifferent(local: any, server: any): boolean {
    const relevantFields = ['status', 'notes', 'recorded_at'];

    for (const field of relevantFields) {
      if (local[field] !== server[field]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get conflict description for UI
   */
  getDescription(conflict: ConflictRecord): string {
    const { localData, serverData } = conflict;

    const localSource = localData.source || 'unknown';
    const serverSource = serverData.source || 'unknown';
    const studentId = localData.student_id || serverData.student_id;
    const date = localData.date || serverData.date;

    return `Attendance conflict: ${localSource} vs ${serverSource} for student ${studentId} on ${date}`;
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

    const localSource = localData.source || 'unknown';
    const serverSource = serverData.source || 'unknown';

    return [
      {
        action: `keep_${localSource === 'teacher_manual' ? 'teacher' : 'qr'}`,
        description: `Use ${localSource} record`,
        data: { localData },
      },
      {
        action: `keep_${serverSource === 'teacher_manual' ? 'teacher' : 'qr'}`,
        description: `Use ${serverSource} record`,
        data: { serverData },
      },
      {
        action: 'merge',
        description: 'Merge both records',
        data: { localData, serverData },
      },
      {
        action: 'coexist',
        description: 'Keep both records visible (coexist mode)',
        data: { localData, serverData },
      },
      {
        action: 'mark_present',
        description: 'Override and mark as present',
        data: { studentId: localData.student_id, status: 'present' },
      },
      {
        action: 'mark_absent',
        description: 'Override and mark as absent',
        data: { studentId: localData.student_id, status: 'absent' },
      },
    ];
  }

  /**
   * Update merge strategy
   */
  setMergeStrategy(strategy: 'teacher_wins' | 'qr_wins' | 'coexist' | 'teacher_validates'): void {
    this.mergeStrategy = strategy;
  }

  /**
   * Get current merge strategy
   */
  getMergeStrategy(): string {
    return this.mergeStrategy;
  }
}
