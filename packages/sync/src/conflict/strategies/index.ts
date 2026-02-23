import { ConflictStrategy } from '../types';
import { PaymentConflictStrategy } from './PaymentConflictStrategy';
import { GradeConflictStrategy } from './GradeConflictStrategy';
import { ScheduleConflictStrategy } from './ScheduleConflictStrategy';
import { AttendanceConflictStrategy } from './AttendanceConflictStrategy';
import { DefaultConflictStrategy } from './DefaultConflictStrategy';

export type ConflictStrategyType =
  | 'payment'
  | 'grade'
  | 'schedule'
  | 'attendance'
  | 'lesson_log'
  | 'default';

/**
 * Get the appropriate conflict resolution strategy for a given table
 */
export function getConflictStrategy(
  table: string,
  options?: { attendanceMergeStrategy?: 'teacher_wins' | 'qr_wins' | 'coexist' | 'teacher_validates' }
): ConflictStrategy {
  // Payment tables - append-only strategy
  if (table === 'payments' || table === 'fees' || table === 'transactions') {
    return new PaymentConflictStrategy();
  }

  // Grade tables - versioning strategy
  if (table === 'grades' || table === 'gradebook' || table === 'student_grades') {
    return new GradeConflictStrategy();
  }

  // Schedule tables - versioning strategy
  if (table === 'schedules' || table === 'timetables' || table === 'schedule_entries') {
    return new ScheduleConflictStrategy();
  }

  // Attendance tables - merge strategy
  if (table === 'attendance' || table === 'student_attendance' || table === 'attendance_records') {
    return new AttendanceConflictStrategy(options?.attendanceMergeStrategy);
  }

  // Lesson log tables - last-write-wins
  if (table === 'lesson_logs' || table === 'lesson_notes' || table === 'cahier_texte') {
    return new DefaultConflictStrategy();
  }

  // Default strategy for all other tables
  return new DefaultConflictStrategy();
}

/**
 * Get conflict strategy by type name
 */
export function getStrategyByType(
  type: ConflictStrategyType,
  options?: { attendanceMergeStrategy?: 'teacher_wins' | 'qr_wins' | 'coexist' | 'teacher_validates' }
): ConflictStrategy {
  switch (type) {
    case 'payment':
      return new PaymentConflictStrategy();
    case 'grade':
      return new GradeConflictStrategy();
    case 'schedule':
      return new ScheduleConflictStrategy();
    case 'attendance':
      return new AttendanceConflictStrategy(options?.attendanceMergeStrategy);
    case 'lesson_log':
      return new DefaultConflictStrategy();
    case 'default':
    default:
      return new DefaultConflictStrategy();
  }
}

/**
 * Map table names to strategy types
 */
export const TABLE_STRATEGY_MAP: Record<string, ConflictStrategyType> = {
  payments: 'payment',
  fees: 'payment',
  transactions: 'payment',

  grades: 'grade',
  gradebook: 'grade',
  student_grades: 'grade',
  grade_versions: 'grade',

  schedules: 'schedule',
  timetables: 'schedule',
  schedule_entries: 'schedule',
  schedule_versions: 'schedule',

  attendance: 'attendance',
  student_attendance: 'attendance',
  attendance_records: 'attendance',

  lesson_logs: 'lesson_log',
  lesson_notes: 'lesson_log',
  cahier_texte: 'lesson_log',
};

/**
 * Get strategy type for a table
 */
export function getStrategyTypeForTable(table: string): ConflictStrategyType {
  return TABLE_STRATEGY_MAP[table] || 'default';
}

// Export all strategies for direct access
export { PaymentConflictStrategy };
export { GradeConflictStrategy };
export { ScheduleConflictStrategy };
export { AttendanceConflictStrategy };
export { DefaultConflictStrategy };
