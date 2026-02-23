import { ConflictResolution } from '../conflict/ConflictResolution';
import { PaymentConflictStrategy } from '../conflict/strategies/PaymentConflictStrategy';
import { GradeConflictStrategy } from '../conflict/strategies/GradeConflictStrategy';
import { ScheduleConflictStrategy } from '../conflict/strategies/ScheduleConflictStrategy';
import { AttendanceConflictStrategy } from '../conflict/strategies/AttendanceConflictStrategy';

describe('ConflictResolution', () => {
  let conflictResolution: ConflictResolution;

  beforeEach(() => {
    conflictResolution = new ConflictResolution();
  });

  describe('Payment conflict resolution', () => {
    it('should use append-only strategy for payments', () => {
      const strategy = new PaymentConflictStrategy();

      const result = strategy.resolve({
        type: 'payment',
        local: { id: 'payment-1', amount: 100000, created_at: '2024-01-15T10:00:00Z' },
        remote: { id: 'payment-1', amount: 100000, created_at: '2024-01-15T10:00:00Z' },
      });

      expect(result.strategy).toBe('append-only');
      expect(result.action).toBe('keep_both');
    });

    it('should detect duplicate payments', () => {
      const strategy = new PaymentConflictStrategy();

      const isDuplicate = strategy.isDuplicate(
        { id: 'payment-1', amount: 100000, student_id: 'student-1' },
        { id: 'payment-2', amount: 100000, student_id: 'student-1' }
      );

      expect(isDuplicate).toBe(true);
    });

    it('should merge duplicate payments instead of creating conflict', () => {
      const strategy = new PaymentConflictStrategy();

      const result = strategy.resolve({
        type: 'payment',
        local: { id: 'payment-1', amount: 100000, student_id: 'student-1' },
        remote: { id: 'payment-2', amount: 100000, student_id: 'student-1' },
      });

      expect(result.action).toBe('merge');
    });
  });

  describe('Grade conflict resolution', () => {
    it('should use versioning strategy for grades', () => {
      const strategy = new GradeConflictStrategy();

      const result = strategy.resolve({
        type: 'grade',
        local: { id: 'grade-1', score: 15, version: 1 },
        remote: { id: 'grade-1', score: 16, version: 2 },
      });

      expect(result.strategy).toBe('versioning');
      expect(result.winner).toBe('remote'); // Higher version wins
    });

    it('should allow admin to choose version', () => {
      const strategy = new GradeConflictStrategy();

      const manualResult = strategy.manualResolve({
        type: 'grade',
        local: { id: 'grade-1', score: 15, version: 1 },
        remote: { id: 'grade-1', score: 16, version: 1 },
        chosen: 'local',
      });

      expect(manualResult.winner).toBe('local');
    });
  });

  describe('Schedule conflict resolution', () => {
    it('should use last-write-wins for draft schedules', () => {
      const strategy = new ScheduleConflictStrategy();

      const result = strategy.resolve({
        type: 'schedule',
        local: { id: 'schedule-1', status: 'draft', updated_at: '2024-01-15T10:00:00Z' },
        remote: { id: 'schedule-1', status: 'draft', updated_at: '2024-01-15T09:00:00Z' },
      });

      expect(result.strategy).toBe('last-write-wins');
      expect(result.winner).toBe('local'); // Later update wins
    });

    it('should require manual resolution for published schedules', () => {
      const strategy = new ScheduleConflictStrategy();

      const result = strategy.resolve({
        type: 'schedule',
        local: { id: 'schedule-1', status: 'published', updated_at: '2024-01-15T10:00:00Z' },
        remote: { id: 'schedule-1', status: 'published', updated_at: '2024-01-15T09:00:00Z' },
      });

      expect(result.action).toBe('manual');
    });
  });

  describe('Attendance conflict resolution', () => {
    it('should merge teacher and QR attendance', () => {
      const strategy = new AttendanceConflictStrategy();

      const result = strategy.resolve({
        type: 'attendance',
        local: {
          id: 'att-1',
          student_id: 'student-1',
          status: 'present',
          source: 'teacher',
        },
        remote: {
          id: 'att-1',
          student_id: 'student-1',
          status: 'present',
          source: 'qr',
        },
      });

      expect(result.action).toBe('merge');
    });

    it('should apply teacher_wins strategy when configured', () => {
      const strategy = new AttendanceConflictStrategy();

      const result = strategy.resolve({
        type: 'attendance',
        local: { id: 'att-1', status: 'present', source: 'teacher' },
        remote: { id: 'att-1', status: 'absent', source: 'qr' },
        mergeStrategy: 'teacher_wins',
      });

      expect(result.winner).toBe('local');
      expect(result.finalValue.status).toBe('present');
    });

    it('should apply qr_wins strategy when configured', () => {
      const strategy = new AttendanceConflictStrategy();

      const result = strategy.resolve({
        type: 'attendance',
        local: { id: 'att-1', status: 'absent', source: 'teacher' },
        remote: { id: 'att-1', status: 'present', source: 'qr' },
        mergeStrategy: 'qr_wins',
      });

      expect(result.winner).toBe('remote');
      expect(result.finalValue.status).toBe('present');
    });

    it('should coexist conflicting values when configured', () => {
      const strategy = new AttendanceConflictStrategy();

      const result = strategy.resolve({
        type: 'attendance',
        local: { id: 'att-1', status: 'absent', source: 'teacher' },
        remote: { id: 'att-1', status: 'present', source: 'qr' },
        mergeStrategy: 'coexist',
      });

      expect(result.action).toBe('keep_both');
      expect(result.finalValue.teacher_status).toBe('absent');
      expect(result.finalValue.qr_status).toBe('present');
    });
  });

  describe('ConflictResolution integration', () => {
    it('should delegate to appropriate strategy based on type', () => {
      const paymentConflict = conflictResolution.resolve({
        type: 'payment',
        local: { id: 'payment-1', amount: 100000 },
        remote: { id: 'payment-1', amount: 100000 },
      });

      expect(paymentConflict.strategy).toBe('append-only');

      const gradeConflict = conflictResolution.resolve({
        type: 'grade',
        local: { id: 'grade-1', score: 15, version: 1 },
        remote: { id: 'grade-1', score: 16, version: 2 },
      });

      expect(gradeConflict.strategy).toBe('versioning');
    });
  });
});
