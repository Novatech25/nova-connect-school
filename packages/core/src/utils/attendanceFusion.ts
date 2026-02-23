/**
 * Attendance Fusion Utilities
 *
 * This module contains logic for merging teacher manual attendance with QR code scans.
 * It implements three fusion strategies: teacher_priority, qr_priority, and coexist.
 */

import type { AttendanceStatus, AttendanceSource } from '../schemas/attendance';

export type FusionStrategy = 'teacher_priority' | 'qr_priority' | 'coexist';
export type RecordStatus = 'auto' | 'confirmed' | 'overridden' | 'manual';

export interface AttendanceRecord {
  id?: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  markedAt: Date | string;
  recordStatus?: RecordStatus;
  originalSource?: AttendanceSource | null;
}

export interface FusionConfig {
  enabled: boolean;
  strategy: FusionStrategy;
  qrTimeWindowMinutes: number;
  autoMerge: boolean;
  notifyOnConflict: boolean;
}

export interface FusionResult {
  status: AttendanceStatus;
  recordStatus: RecordStatus;
  originalSource?: AttendanceSource | null;
  shouldMerge: boolean;
  reason?: string;
}

/**
 * Determines how to merge two attendance records based on the configured strategy
 *
 * @param existingRecord - The existing attendance record
 * @param newRecord - The new attendance record being applied
 * @param strategy - The fusion strategy to use
 * @param qrTimeWindowMinutes - Time window for QR scans to be considered valid (in minutes)
 * @param sessionStartTime - The start time of the attendance session (for QR time window checks)
 * @returns FusionResult with the status, recordStatus, and whether to merge
 */
export function determineRecordStatus(
  existingRecord: AttendanceRecord,
  newRecord: AttendanceRecord,
  strategy: FusionStrategy,
  qrTimeWindowMinutes: number,
  sessionStartTime?: Date | string
): FusionResult {
  const existingSource = existingRecord.source;
  const newSource = newRecord.source;

  // Strategy 1: Teacher Priority
  // Teacher markings always override QR scans
  if (strategy === 'teacher_priority') {
    if (newSource === 'teacher_manual') {
      // Teacher is marking, override whatever exists (QR or manual)
      return {
        status: newRecord.status,
        recordStatus: existingRecord.source === 'qr_scan' ? 'overridden' : 'manual',
        originalSource: existingRecord.source === 'qr_scan' ? 'qr_scan' : undefined,
        shouldMerge: true,
        reason: 'Teacher manual attendance overrides existing record',
      };
    } else if (newSource === 'qr_scan') {
      // QR scan after teacher manual mark - ignore it
      if (existingSource === 'teacher_manual') {
        return {
          status: existingRecord.status,
          recordStatus: existingRecord.recordStatus || 'manual',
          shouldMerge: false,
          reason: 'Teacher already marked attendance, QR scan ignored',
        };
      }
      // QR scan after QR scan - treat as duplicate, keep existing
      return {
        status: existingRecord.status,
        recordStatus: existingRecord.recordStatus || 'auto',
        shouldMerge: false,
        reason: 'QR already scanned, duplicate scan ignored',
      };
    }
  }

  // Strategy 2: QR Priority
  // QR scans prevail if within the time window, teacher can override with absent
  if (strategy === 'qr_priority') {
    // Check if QR is within the time window
    const isQRInWindow = isQRInTimeWindow(newRecord.markedAt, qrTimeWindowMinutes, sessionStartTime);

    if (newSource === 'qr_scan' && isQRInWindow) {
      // QR scan within window - it prevails
      return {
        status: 'present',
        recordStatus: 'auto',
        shouldMerge: true,
        reason: 'QR scan within time window, student marked present',
      };
    } else if (newSource === 'qr_scan' && !isQRInWindow) {
      // QR scan outside window - ignore if teacher already marked
      if (existingSource === 'teacher_manual') {
        return {
          status: existingRecord.status,
          recordStatus: existingRecord.recordStatus || 'manual',
          shouldMerge: false,
          reason: 'QR scan outside time window, teacher attendance kept',
        };
      }
    }

    // Teacher marking after QR scan
    if (newSource === 'teacher_manual') {
      if (existingSource === 'qr_scan') {
        // Teacher marking "absent" overrides QR
        if (newRecord.status === 'absent') {
          return {
            status: 'absent',
            recordStatus: 'overridden',
            originalSource: 'qr_scan',
            shouldMerge: true,
            reason: 'Teacher marked absent, overriding QR scan',
          };
        }
        // Teacher marking same as QR (present) - confirm
        return {
          status: newRecord.status,
          recordStatus: 'confirmed',
          shouldMerge: true,
          reason: 'Teacher confirmed QR scan',
        };
      }
      // Teacher manual to manual - normal update
      return {
        status: newRecord.status,
        recordStatus: 'manual',
        shouldMerge: true,
        reason: 'Teacher updated manual attendance',
      };
    }
  }

  // Strategy 3: Coexist
  // Both sources are preserved with a calculated final status
  if (strategy === 'coexist') {
    const statusesMatch = existingRecord.status === newRecord.status;

    if (statusesMatch) {
      // Both sources agree - confirm
      return {
        status: newRecord.status,
        recordStatus: 'confirmed',
        shouldMerge: true,
        reason: 'Both sources agree, record confirmed',
      };
    } else {
      // Sources disagree - mark as overridden
      return {
        status: newRecord.status,
        recordStatus: 'overridden',
        originalSource: existingSource,
        shouldMerge: true,
        reason: 'Sources disagree, new source overrides previous',
      };
    }
  }

  // Fallback: should not reach here, but handle gracefully
  return {
    status: newRecord.status,
    recordStatus: 'manual',
    shouldMerge: true,
    reason: 'Default: apply new record',
  };
}

/**
 * Checks if a QR scan is within the valid time window
 *
 * @param scanTime - When the QR was scanned
 * @param timeWindowMinutes - The time window in minutes
 * @param sessionStartTime - The start time of the session
 * @returns true if the scan is within the time window
 */
export function isQRInTimeWindow(
  scanTime: Date | string,
  timeWindowMinutes: number,
  sessionStartTime?: Date | string
): boolean {
  const scanDate = typeof scanTime === 'string' ? new Date(scanTime) : scanTime;
  const sessionDate = sessionStartTime
    ? typeof sessionStartTime === 'string'
      ? new Date(sessionStartTime)
      : sessionStartTime
    : new Date();

  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  const timeDiffMs = Math.abs(scanDate.getTime() - sessionDate.getTime());

  return timeDiffMs <= timeWindowMs;
}

/**
 * Checks if a record can be merged based on session status and user role
 *
 * @param existingRecord - The existing attendance record
 * @param newRecord - The new attendance record being applied
 * @param sessionStatus - The status of the attendance session (draft, submitted, etc.)
 * @param userRole - The role of the user attempting the merge
 * @returns true if the merge is allowed
 */
export function canMergeRecords(
  existingRecord: AttendanceRecord,
  _newRecord: AttendanceRecord,
  sessionStatus: string = 'draft',
  userRole: string = 'teacher'
): boolean {
  // Only allow merges on draft sessions for non-admins
  if (sessionStatus !== 'draft' && !['admin', 'supervisor'].includes(userRole)) {
    return false;
  }

  // Don't allow merging confirmed or overridden records unless admin
  if (
    (existingRecord.recordStatus === 'confirmed' || existingRecord.recordStatus === 'overridden') &&
    !['admin', 'supervisor'].includes(userRole)
  ) {
    return false;
  }

  return true;
}

/**
 * Builds metadata object for a merge operation
 *
 * @param existingRecord - The existing attendance record
 * @param newRecord - The new attendance record being applied
 * @param strategy - The fusion strategy used
 * @param mergedBy - The ID of the user who performed the merge
 * @returns A metadata JSONB object
 */
export function buildMergeMetadata(
  existingRecord: AttendanceRecord,
  newRecord: AttendanceRecord,
  strategy: FusionStrategy,
  mergedBy: string
): Record<string, any> {
  return {
    previousStatus: existingRecord.status,
    previousSource: existingRecord.source,
    previousRecordStatus: existingRecord.recordStatus || 'manual',
    newStatus: newRecord.status,
    newSource: newRecord.source,
    mergeStrategy: strategy,
    mergedBy,
    mergedAt: new Date().toISOString(),
    mergeReason: `${newRecord.source} merged with ${existingRecord.source} using ${strategy} strategy`,
  };
}

/**
 * Determines if a conflict exists between two records
 *
 * @param record1 - First attendance record
 * @param record2 - Second attendance record
 * @returns true if the records conflict (different statuses)
 */
export function hasConflict(record1: AttendanceRecord, record2: AttendanceRecord): boolean {
  return record1.status !== record2.status;
}

/**
 * Calculates the severity level of a conflict
 *
 * @param existingRecord - The existing attendance record
 * @param newRecord - The new attendance record being applied
 * @returns The severity level: 'high', 'medium', or 'low'
 */
export function getConflictSeverity(
  existingRecord: AttendanceRecord,
  newRecord: AttendanceRecord
): 'high' | 'medium' | 'low' {
  // High severity: present vs absent
  if (
    (existingRecord.status === 'present' && newRecord.status === 'absent') ||
    (existingRecord.status === 'absent' && newRecord.status === 'present')
  ) {
    return 'high';
  }

  // Medium severity: present vs late or absent vs late
  if (
    (existingRecord.status === 'present' && newRecord.status === 'late') ||
    (existingRecord.status === 'late' && newRecord.status === 'present') ||
    (existingRecord.status === 'absent' && newRecord.status === 'late') ||
    (existingRecord.status === 'late' && newRecord.status === 'absent')
  ) {
    return 'medium';
  }

  // Low severity: anything else (e.g., excused vs absent)
  return 'low';
}

/**
 * Formats a record status for display
 *
 * @param recordStatus - The record status
 * @returns A human-readable label
 */
export function formatRecordStatus(recordStatus: RecordStatus): string {
  const labels: Record<RecordStatus, string> = {
    auto: 'QR Scan Only',
    confirmed: 'Confirmed',
    overridden: 'Modified',
    manual: 'Manual Entry',
  };

  return labels[recordStatus] || recordStatus;
}

/**
 * Formats a fusion strategy for display
 *
 * @param strategy - The fusion strategy
 * @returns A human-readable label
 */
export function formatFusionStrategy(strategy: FusionStrategy): string {
  const labels: Record<FusionStrategy, string> = {
    teacher_priority: 'Teacher Priority',
    qr_priority: 'QR Priority',
    coexist: 'Coexist',
  };

  return labels[strategy] || strategy;
}
