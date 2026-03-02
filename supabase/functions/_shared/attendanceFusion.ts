/**
 * Shared Attendance Fusion Utilities for Edge Functions
 *
 * This module provides fusion logic that can be used across Edge Functions
 * without importing from the core package (which isn't available in Edge Functions).
 */

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
type AttendanceSource = 'teacher_manual' | 'qr_scan';
type FusionStrategy = 'teacher_priority' | 'qr_priority' | 'coexist';
type RecordStatus = 'auto' | 'confirmed' | 'overridden' | 'manual';

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
 * This is a copy of the core function for use in Edge Functions.
 * Changes should be mirrored in packages/core/src/utils/attendanceFusion.ts
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
