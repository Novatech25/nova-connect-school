// Unit Tests for Attendance Fusion Utilities
// Testing fusion strategies, conflict detection, and merge logic

import {
  determineRecordStatus,
  isQRInTimeWindow,
  canMergeRecords,
  buildMergeMetadata,
  hasConflict,
  getConflictSeverity,
  formatRecordStatus,
  formatFusionStrategy,
  type AttendanceRecord,
  type FusionStrategy,
} from '../attendanceFusion';

describe('determineRecordStatus', () => {
  const existingQR: AttendanceRecord = {
    id: '1',
    status: 'present',
    source: 'qr_scan',
    markedAt: new Date('2025-01-23T08:00:00Z'),
    recordStatus: 'auto',
  };

  const existingManual: AttendanceRecord = {
    id: '2',
    status: 'absent',
    source: 'teacher_manual',
    markedAt: new Date('2025-01-23T08:00:00Z'),
    recordStatus: 'manual',
  };

  const sessionStartTime = new Date('2025-01-23T08:00:00Z');

  describe('teacher_priority strategy', () => {
    test('should override QR scan when teacher marks present', () => {
      const newRecord: AttendanceRecord = {
        status: 'present',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingQR,
        newRecord,
        'teacher_priority',
        15
      );

      expect(result.status).toBe('present');
      expect(result.recordStatus).toBe('overridden');
      expect(result.originalSource).toBe('qr_scan');
      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toContain('Teacher manual attendance overrides');
    });

    test('should override QR scan when teacher marks absent', () => {
      const newRecord: AttendanceRecord = {
        status: 'absent',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingQR,
        newRecord,
        'teacher_priority',
        15
      );

      expect(result.status).toBe('absent');
      expect(result.recordStatus).toBe('overridden');
      expect(result.originalSource).toBe('qr_scan');
      expect(result.shouldMerge).toBe(true);
    });

    test('should reject QR scan when teacher already marked', () => {
      const newRecord: AttendanceRecord = {
        status: 'present',
        source: 'qr_scan',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingManual,
        newRecord,
        'teacher_priority',
        15
      );

      expect(result.status).toBe(existingManual.status);
      expect(result.shouldMerge).toBe(false);
      expect(result.reason).toContain('Teacher already marked attendance');
    });

    test('should reject duplicate QR scans', () => {
      const newRecord: AttendanceRecord = {
        status: 'present',
        source: 'qr_scan',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingQR,
        newRecord,
        'teacher_priority',
        15
      );

      expect(result.shouldMerge).toBe(false);
      expect(result.reason).toContain('QR already scanned');
    });
  });

  describe('qr_priority strategy', () => {
    test('should accept QR scan within time window', () => {
      const newRecord: AttendanceRecord = {
        status: 'present',
        source: 'qr_scan',
        markedAt: new Date('2025-01-23T08:10:00Z'), // 10 minutes after session start
      };

      const result = determineRecordStatus(
        existingManual,
        newRecord,
        'qr_priority',
        15,
        sessionStartTime
      );

      expect(result.status).toBe('present');
      expect(result.recordStatus).toBe('auto');
      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toContain('QR scan within time window');
    });

    test('should reject QR scan outside time window when teacher marked', () => {
      const newRecord: AttendanceRecord = {
        status: 'present',
        source: 'qr_scan',
        markedAt: new Date('2025-01-23T08:20:00Z'), // 20 minutes after session start
      };

      const result = determineRecordStatus(
        existingManual,
        newRecord,
        'qr_priority',
        15,
        sessionStartTime
      );

      expect(result.status).toBe(existingManual.status);
      expect(result.shouldMerge).toBe(false);
      expect(result.reason).toContain('QR scan outside time window');
    });

    test('should allow teacher to override QR with absent', () => {
      const newRecord: AttendanceRecord = {
        status: 'absent',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingQR,
        newRecord,
        'qr_priority',
        15
      );

      expect(result.status).toBe('absent');
      expect(result.recordStatus).toBe('overridden');
      expect(result.originalSource).toBe('qr_scan');
      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toContain('Teacher marked absent');
    });

    test('should confirm when teacher marks same as QR', () => {
      const newRecord: AttendanceRecord = {
        status: 'present',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingQR,
        newRecord,
        'qr_priority',
        15
      );

      expect(result.status).toBe('present');
      expect(result.recordStatus).toBe('confirmed');
      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toContain('Teacher confirmed QR scan');
    });
  });

  describe('coexist strategy', () => {
    test('should confirm when both sources agree (present)', () => {
      const newRecord: AttendanceRecord = {
        status: 'present',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingQR,
        newRecord,
        'coexist',
        15
      );

      expect(result.status).toBe('present');
      expect(result.recordStatus).toBe('confirmed');
      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toContain('Both sources agree');
    });

    test('should confirm when both sources agree (absent)', () => {
      const newRecord: AttendanceRecord = {
        status: 'absent',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const existingQRAbsent: AttendanceRecord = {
        ...existingQR,
        status: 'absent',
      };

      const result = determineRecordStatus(
        existingQRAbsent,
        newRecord,
        'coexist',
        15
      );

      expect(result.status).toBe('absent');
      expect(result.recordStatus).toBe('confirmed');
      expect(result.shouldMerge).toBe(true);
    });

    test('should mark as overridden when sources disagree', () => {
      const newRecord: AttendanceRecord = {
        status: 'absent',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingQR,
        newRecord,
        'coexist',
        15
      );

      expect(result.status).toBe('absent');
      expect(result.recordStatus).toBe('overridden');
      expect(result.originalSource).toBe('qr_scan');
      expect(result.shouldMerge).toBe(true);
      expect(result.reason).toContain('Sources disagree');
    });
  });

  describe('edge cases', () => {
    test('should handle late status correctly', () => {
      const existingManualLate: AttendanceRecord = {
        ...existingManual,
        status: 'late',
      };

      const newRecord: AttendanceRecord = {
        status: 'present',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingManualLate,
        newRecord,
        'teacher_priority',
        15
      );

      expect(result.status).toBe('present');
      expect(result.shouldMerge).toBe(true);
    });

    test('should handle excused status correctly', () => {
      const existingManualExcused: AttendanceRecord = {
        ...existingManual,
        status: 'excused',
      };

      const newRecord: AttendanceRecord = {
        status: 'absent',
        source: 'teacher_manual',
        markedAt: new Date('2025-01-23T08:05:00Z'),
      };

      const result = determineRecordStatus(
        existingManualExcused,
        newRecord,
        'teacher_priority',
        15
      );

      expect(result.status).toBe('absent');
      expect(result.shouldMerge).toBe(true);
    });
  });
});

describe('isQRInTimeWindow', () => {
  const sessionStartTime = new Date('2025-01-23T08:00:00Z');
  const timeWindowMinutes = 15;

  test('should return true for scan at session start', () => {
    const scanTime = new Date('2025-01-23T08:00:00Z');
    expect(isQRInTimeWindow(scanTime, timeWindowMinutes, sessionStartTime)).toBe(true);
  });

  test('should return true for scan within time window', () => {
    const scanTime = new Date('2025-01-23T08:10:00Z'); // 10 minutes after
    expect(isQRInTimeWindow(scanTime, timeWindowMinutes, sessionStartTime)).toBe(true);
  });

  test('should return true for scan at exact boundary', () => {
    const scanTime = new Date('2025-01-23T08:15:00Z'); // Exactly 15 minutes after
    expect(isQRInTimeWindow(scanTime, timeWindowMinutes, sessionStartTime)).toBe(true);
  });

  test('should return false for scan outside time window', () => {
    const scanTime = new Date('2025-01-23T08:20:00Z'); // 20 minutes after
    expect(isQRInTimeWindow(scanTime, timeWindowMinutes, sessionStartTime)).toBe(false);
  });

  test('should handle scan before session start', () => {
    const scanTime = new Date('2025-01-23T07:50:00Z'); // 10 minutes before
    expect(isQRInTimeWindow(scanTime, timeWindowMinutes, sessionStartTime)).toBe(false);
  });

  test('should work with string dates', () => {
    const scanTime = '2025-01-23T08:05:00Z';
    expect(isQRInTimeWindow(scanTime, timeWindowMinutes, sessionStartTime)).toBe(true);
  });

  test('should default to current time if sessionStartTime not provided', () => {
    const scanTime = new Date();
    expect(isQRInTimeWindow(scanTime, timeWindowMinutes)).toBe(true);
  });
});

describe('canMergeRecords', () => {
  const existingRecord: AttendanceRecord = {
    id: '1',
    status: 'present',
    source: 'qr_scan',
    markedAt: new Date(),
    recordStatus: 'auto',
  };

  const newRecord: AttendanceRecord = {
    status: 'present',
    source: 'teacher_manual',
    markedAt: new Date(),
  };

  test('should allow merge on draft session for teacher', () => {
    expect(canMergeRecords(existingRecord, newRecord, 'draft', 'teacher')).toBe(true);
  });

  test('should deny merge on submitted session for teacher', () => {
    expect(canMergeRecords(existingRecord, newRecord, 'submitted', 'teacher')).toBe(false);
  });

  test('should allow merge on submitted session for admin', () => {
    expect(canMergeRecords(existingRecord, newRecord, 'submitted', 'admin')).toBe(true);
  });

  test('should allow merge on submitted session for supervisor', () => {
    expect(canMergeRecords(existingRecord, newRecord, 'submitted', 'supervisor')).toBe(true);
  });

  test('should deny merge on confirmed record for teacher', () => {
    const confirmedRecord = { ...existingRecord, recordStatus: 'confirmed' as const };
    expect(canMergeRecords(confirmedRecord, newRecord, 'draft', 'teacher')).toBe(false);
  });

  test('should deny merge on overridden record for teacher', () => {
    const overriddenRecord = { ...existingRecord, recordStatus: 'overridden' as const };
    expect(canMergeRecords(overriddenRecord, newRecord, 'draft', 'teacher')).toBe(false);
  });

  test('should allow merge on overridden record for admin', () => {
    const overriddenRecord = { ...existingRecord, recordStatus: 'overridden' as const };
    expect(canMergeRecords(overriddenRecord, newRecord, 'draft', 'admin')).toBe(true);
  });
});

describe('buildMergeMetadata', () => {
  test('should build metadata with all required fields', () => {
    const existingRecord: AttendanceRecord = {
      id: '1',
      status: 'present',
      source: 'qr_scan',
      markedAt: new Date('2025-01-23T08:00:00Z'),
      recordStatus: 'auto',
    };

    const newRecord: AttendanceRecord = {
      status: 'absent',
      source: 'teacher_manual',
      markedAt: new Date('2025-01-23T08:05:00Z'),
    };

    const strategy: FusionStrategy = 'teacher_priority';
    const mergedBy = 'user-123';

    const metadata = buildMergeMetadata(existingRecord, newRecord, strategy, mergedBy);

    expect(metadata.previousStatus).toBe('present');
    expect(metadata.previousSource).toBe('qr_scan');
    expect(metadata.previousRecordStatus).toBe('auto');
    expect(metadata.newStatus).toBe('absent');
    expect(metadata.newSource).toBe('teacher_manual');
    expect(metadata.mergeStrategy).toBe('teacher_priority');
    expect(metadata.mergedBy).toBe('user-123');
    expect(metadata.mergedAt).toBeDefined();
    expect(metadata.mergeReason).toContain('merged with');
    expect(metadata.mergeReason).toContain('teacher_priority');
  });
});

describe('hasConflict', () => {
  test('should return true when statuses differ', () => {
    const record1: AttendanceRecord = {
      status: 'present',
      source: 'qr_scan',
      markedAt: new Date(),
    };

    const record2: AttendanceRecord = {
      status: 'absent',
      source: 'teacher_manual',
      markedAt: new Date(),
    };

    expect(hasConflict(record1, record2)).toBe(true);
  });

  test('should return false when statuses match', () => {
    const record1: AttendanceRecord = {
      status: 'present',
      source: 'qr_scan',
      markedAt: new Date(),
    };

    const record2: AttendanceRecord = {
      status: 'present',
      source: 'teacher_manual',
      markedAt: new Date(),
    };

    expect(hasConflict(record1, record2)).toBe(false);
  });
});

describe('getConflictSeverity', () => {
  const baseQR: AttendanceRecord = {
    status: 'present',
    source: 'qr_scan',
    markedAt: new Date(),
  };

  test('should return high for present vs absent', () => {
    const teacherAbsent: AttendanceRecord = {
      status: 'absent',
      source: 'teacher_manual',
      markedAt: new Date(),
    };

    expect(getConflictSeverity(baseQR, teacherAbsent)).toBe('high');
    expect(getConflictSeverity(teacherAbsent, baseQR)).toBe('high');
  });

  test('should return medium for present vs late', () => {
    const teacherLate: AttendanceRecord = {
      status: 'late',
      source: 'teacher_manual',
      markedAt: new Date(),
    };

    expect(getConflictSeverity(baseQR, teacherLate)).toBe('medium');
  });

  test('should return medium for absent vs late', () => {
    const teacherAbsent: AttendanceRecord = {
      status: 'absent',
      source: 'teacher_manual',
      markedAt: new Date(),
    };

    const teacherLate: AttendanceRecord = {
      status: 'late',
      source: 'teacher_manual',
      markedAt: new Date(),
    };

    expect(getConflictSeverity(teacherAbsent, teacherLate)).toBe('medium');
  });

  test('should return low for other combinations', () => {
    const teacherExcused: AttendanceRecord = {
      status: 'excused',
      source: 'teacher_manual',
      markedAt: new Date(),
    };

    expect(getConflictSeverity(teacherExcused, { ...baseQR, status: 'absent' })).toBe('low');
  });
});

describe('formatRecordStatus', () => {
  test('should format auto correctly', () => {
    expect(formatRecordStatus('auto')).toBe('QR Scan Only');
  });

  test('should format confirmed correctly', () => {
    expect(formatRecordStatus('confirmed')).toBe('Confirmed');
  });

  test('should format overridden correctly', () => {
    expect(formatRecordStatus('overridden')).toBe('Modified');
  });

  test('should format manual correctly', () => {
    expect(formatRecordStatus('manual')).toBe('Manual Entry');
  });
});

describe('formatFusionStrategy', () => {
  test('should format teacher_priority correctly', () => {
    expect(formatFusionStrategy('teacher_priority')).toBe('Teacher Priority');
  });

  test('should format qr_priority correctly', () => {
    expect(formatFusionStrategy('qr_priority')).toBe('QR Priority');
  });

  test('should format coexist correctly', () => {
    expect(formatFusionStrategy('coexist')).toBe('Coexist');
  });
});
