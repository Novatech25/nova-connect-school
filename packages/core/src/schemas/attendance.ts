import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'excused']);

export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

export const attendanceSourceSchema = z.enum(['teacher_manual', 'qr_scan']);

export type AttendanceSource = z.infer<typeof attendanceSourceSchema>;

export const attendanceRecordStatusSchema = z.enum(['auto', 'confirmed', 'overridden', 'manual']);

export type AttendanceRecordStatus = z.infer<typeof attendanceRecordStatusSchema>;

export const attendanceSessionStatusSchema = z.enum(['draft', 'submitted', 'validated']);

export type AttendanceSessionStatus = z.infer<typeof attendanceSessionStatusSchema>;

// ============================================================================
// ATTENDANCE SESSIONS
// ============================================================================

export const attendanceSessionSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  plannedSessionId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  status: attendanceSessionStatusSchema,
  submittedAt: z.string().datetime().nullable(),
  validatedAt: z.string().datetime().nullable(),
  validatedBy: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AttendanceSession = z.infer<typeof attendanceSessionSchema>;

export const createAttendanceSessionSchema = z.object({
  schoolId: z.string().uuid(),
  plannedSessionId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export type CreateAttendanceSessionInput = z.infer<typeof createAttendanceSessionSchema>;

export const updateAttendanceSessionSchema = z.object({
  id: z.string().uuid(),
  status: attendanceSessionStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export type UpdateAttendanceSessionInput = z.infer<typeof updateAttendanceSessionSchema>;

export const submitAttendanceSessionSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().nullable().optional(),
});

export type SubmitAttendanceSessionInput = z.infer<typeof submitAttendanceSessionSchema>;

export const validateAttendanceSessionSchema = z.object({
  id: z.string().uuid(),
});

export type ValidateAttendanceSessionInput = z.infer<typeof validateAttendanceSessionSchema>;

// ============================================================================
// ATTENDANCE RECORDS
// ============================================================================

export const attendanceRecordSchema = z.object({
  id: z.string().uuid(),
  attendanceSessionId: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  source: attendanceSourceSchema,
  recordStatus: attendanceRecordStatusSchema.optional(),
  originalSource: attendanceSourceSchema.nullable().optional(),
  justification: z.string().nullable(),
  comment: z.string().nullable(),
  markedBy: z.string().uuid(),
  markedAt: z.string().datetime(),
  mergedAt: z.string().datetime().nullable().optional(),
  mergedBy: z.string().uuid().nullable().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

export const createAttendanceRecordSchema = z.object({
  attendanceSessionId: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  source: attendanceSourceSchema.optional().default('teacher_manual'),
  justification: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({}),
}).refine(
  (data) => {
    // If status is excused, justification should be provided
    if (data.status === 'excused' && !data.justification) {
      return false;
    }
    return true;
  },
  {
    message: "Justification is required when status is 'excused'",
    path: ['justification'],
  }
);

export type CreateAttendanceRecordInput = z.infer<typeof createAttendanceRecordSchema>;

export const updateAttendanceRecordSchema = z.object({
  id: z.string().uuid(),
  status: attendanceStatusSchema.optional(),
  justification: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({}),
}).refine(
  (data) => {
    // If status is being set to excused, justification should be provided
    if (data.status === 'excused' && !data.justification) {
      return false;
    }
    return true;
  },
  {
    message: "Justification is required when status is 'excused'",
    path: ['justification'],
  }
);

export type UpdateAttendanceRecordInput = z.infer<typeof updateAttendanceRecordSchema>;

export const bulkAttendanceRecordsSchema = z.array(createAttendanceRecordSchema);

export type BulkAttendanceRecordsInput = z.infer<typeof bulkAttendanceRecordsSchema>;

// ============================================================================
// FILTERS
// ============================================================================

export const attendanceSessionFiltersSchema = z.object({
  teacherId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: attendanceSessionStatusSchema.optional(),
});

export type AttendanceSessionFilters = z.infer<typeof attendanceSessionFiltersSchema>;

// ============================================================================
// RELATIONSHIP SCHEMAS
// ============================================================================

export const attendanceSessionWithRelationsSchema = attendanceSessionSchema.extend({
  plannedSession: z.object({
    id: z.string().uuid(),
    subjectName: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    roomName: z.string().nullable(),
  }).optional(),
  teacher: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
  }).optional(),
  class: z.object({
    id: z.string().uuid(),
    name: z.string(),
    level: z.string(),
  }).optional(),
});

export type AttendanceSessionWithRelations = z.infer<typeof attendanceSessionWithRelationsSchema>;

export const attendanceRecordWithStudentSchema = attendanceRecordSchema.extend({
  student: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    photo: z.string().nullable(),
  }).optional(),
});

export type AttendanceRecordWithStudent = z.infer<typeof attendanceRecordWithStudentSchema>;

// ============================================================================
// STATS
// ============================================================================

export const attendanceStatsSchema = z.object({
  total: z.number(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  excused: z.number(),
  attendanceRate: z.number(), // Percentage
});

export type AttendanceStats = z.infer<typeof attendanceStatsSchema>;

export const studentAttendanceSummarySchema = z.object({
  studentId: z.string().uuid(),
  studentName: z.string(),
  totalSessions: z.number(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  excused: z.number(),
  attendanceRate: z.number(),
  unjustifiedAbsences: z.number(),
});

export type StudentAttendanceSummary = z.infer<typeof studentAttendanceSummarySchema>;

// ============================================================================
// ATTENDANCE RECORD HISTORY (FUSION)
// ============================================================================

export const attendanceRecordHistorySchema = z.object({
  id: z.string().uuid(),
  attendanceRecordId: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: attendanceStatusSchema,
  source: attendanceSourceSchema,
  recordStatus: attendanceRecordStatusSchema,
  justification: z.string().nullable(),
  comment: z.string().nullable(),
  markedBy: z.string().uuid(),
  markedAt: z.string().datetime(),
  action: z.enum(['created', 'updated', 'merged', 'overridden']),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
});

export type AttendanceRecordHistory = z.infer<typeof attendanceRecordHistorySchema>;

// ============================================================================
// MERGE ATTENDANCE RECORD (FUSION)
// ============================================================================

export const mergeAttendanceRecordSchema = z.object({
  attendanceRecordId: z.string().uuid(),
  newStatus: attendanceStatusSchema,
  recordStatus: z.enum(['confirmed', 'overridden']),
  justification: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

export type MergeAttendanceRecordInput = z.infer<typeof mergeAttendanceRecordSchema>;

