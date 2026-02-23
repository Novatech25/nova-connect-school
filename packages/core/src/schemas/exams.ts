import { z } from 'zod';

// Enums
export const examSessionStatusSchema = z.enum(['draft', 'planned', 'in_progress', 'completed', 'cancelled']);
export const examTypeSchema = z.enum(['composition', 'exam', 'final_exam', 'certification']);
export const deliberationStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'published']);
export const examMinuteStatusSchema = z.enum(['draft', 'validated', 'signed', 'archived']);

// Exam Session
export const examSessionSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  periodId: z.string().uuid().nullable(),

  name: z.string().min(3).max(200),
  examType: examTypeSchema,
  description: z.string().optional(),

  startDate: z.date(),
  endDate: z.date(),

  status: examSessionStatusSchema,

  requiresJury: z.boolean().default(true),
  requiresDeliberation: z.boolean().default(true),
  requiresOfficialMinutes: z.boolean().default(true),

  plannedAt: z.date().nullable(),
  plannedBy: z.string().uuid().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createExamSessionSchema = examSessionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  plannedAt: true,
  plannedBy: true,
  startedAt: true,
  completedAt: true,
}).strict();

// Exam Center
export const examCenterSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  examSessionId: z.string().uuid(),

  name: z.string().min(3).max(200),
  code: z.string().max(50).optional(),
  address: z.string().optional(),
  capacity: z.number().int().positive().optional(),

  latitude: z.number().optional(),
  longitude: z.number().optional(),

  supervisorId: z.string().uuid().nullable(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createExamCenterSchema = examCenterSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).strict();

// Exam Jury
export const examJurySchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  examSessionId: z.string().uuid(),

  name: z.string().min(3).max(200),
  description: z.string().optional(),

  presidentId: z.string().uuid().nullable(),
  memberIds: z.array(z.string().uuid()).default([]),
  classIds: z.array(z.string().uuid()).default([]),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createExamJurySchema = examJurySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).strict();

// Exam Assignment
export const examAssignmentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  examSessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  examCenterId: z.string().uuid(),

  seatNumber: z.string().max(50).optional(),
  isPresent: z.boolean().default(false),
  absenceReason: z.string().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Exam Deliberation
export const examDeliberationSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  examSessionId: z.string().uuid(),
  juryId: z.string().uuid(),
  classId: z.string().uuid().nullable(),

  deliberationDate: z.date(),
  status: deliberationStatusSchema,

  totalStudents: z.number().int().nonnegative().default(0),
  passedStudents: z.number().int().nonnegative().default(0),
  failedStudents: z.number().int().nonnegative().default(0),

  specialDecisions: z.array(z.record(z.unknown())).default([]),

  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  publishedAt: z.date().nullable(),
  publishedBy: z.string().uuid().nullable(),

  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createExamDeliberationSchema = examDeliberationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
  publishedAt: true,
  publishedBy: true,
}).strict();

// Exam Result
export const examResultSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  examSessionId: z.string().uuid(),
  deliberationId: z.string().uuid(),
  studentId: z.string().uuid(),

  overallAverage: z.number().min(0).max(20),
  rankInClass: z.number().int().positive().nullable(),
  classSize: z.number().int().positive(),

  isPassed: z.boolean(),
  mention: z.string().max(50).nullable(),
  mentionColor: z.string().max(7).nullable(),

  specialDecision: z.string().optional(),
  juryComments: z.string().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Exam Minute
export const examMinuteSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  examSessionId: z.string().uuid(),
  deliberationId: z.string().uuid().nullable(),

  minuteType: z.string().max(50),
  title: z.string().min(3).max(200),
  content: z.string().min(10),

  status: examMinuteStatusSchema,

  signatures: z.array(z.record(z.unknown())).default([]),

  pdfUrl: z.string().nullable(),
  pdfSizeBytes: z.number().int().positive().nullable(),

  validatedAt: z.date().nullable(),
  validatedBy: z.string().uuid().nullable(),
  signedAt: z.date().nullable(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createExamMinuteSchema = examMinuteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  validatedAt: true,
  validatedBy: true,
  signedAt: true,
  pdfUrl: true,
  pdfSizeBytes: true,
}).strict();

// Workflow actions
export const startDeliberationSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const completeDeliberationSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().optional(),
}).strict();

export const publishDeliberationSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const validateExamMinuteSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const signExamMinuteSchema = z.object({
  id: z.string().uuid(),
  signatureData: z.string(), // Base64 ou autre format
}).strict();

// Filters
export const examSessionFiltersSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  status: examSessionStatusSchema.optional(),
  examType: examTypeSchema.optional(),
});

export const examDeliberationFiltersSchema = z.object({
  examSessionId: z.string().uuid().optional(),
  juryId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  status: deliberationStatusSchema.optional(),
});

// Types
export type ExamSessionStatus = z.infer<typeof examSessionStatusSchema>;
export type ExamType = z.infer<typeof examTypeSchema>;
export type DeliberationStatus = z.infer<typeof deliberationStatusSchema>;
export type ExamMinuteStatus = z.infer<typeof examMinuteStatusSchema>;

export type ExamSession = z.infer<typeof examSessionSchema>;
export type CreateExamSessionInput = z.infer<typeof createExamSessionSchema>;

export type ExamCenter = z.infer<typeof examCenterSchema>;
export type CreateExamCenterInput = z.infer<typeof createExamCenterSchema>;

export type ExamJury = z.infer<typeof examJurySchema>;
export type CreateExamJuryInput = z.infer<typeof createExamJurySchema>;

export type ExamAssignment = z.infer<typeof examAssignmentSchema>;

export type ExamDeliberation = z.infer<typeof examDeliberationSchema>;
export type CreateExamDeliberationInput = z.infer<typeof createExamDeliberationSchema>;

export type ExamResult = z.infer<typeof examResultSchema>;

export type ExamMinute = z.infer<typeof examMinuteSchema>;
export type CreateExamMinuteInput = z.infer<typeof createExamMinuteSchema>;

export type StartDeliberationInput = z.infer<typeof startDeliberationSchema>;
export type CompleteDeliberationInput = z.infer<typeof completeDeliberationSchema>;
export type PublishDeliberationInput = z.infer<typeof publishDeliberationSchema>;

export type ValidateExamMinuteInput = z.infer<typeof validateExamMinuteSchema>;
export type SignExamMinuteInput = z.infer<typeof signExamMinuteSchema>;

export type ExamSessionFilters = z.infer<typeof examSessionFiltersSchema>;
export type ExamDeliberationFilters = z.infer<typeof examDeliberationFiltersSchema>;
