import { z } from 'zod';

// ============================================
// ENUM Schemas
// ============================================

export const gradeStatusSchema = z.enum(['draft', 'submitted', 'approved', 'published']);

export const gradeTypeSchema = z.enum([
  'homework',
  'exam',
  'quiz',
  'project',
  'participation',
  'composition'
]);

export const gradeSubmissionStatusSchema = z.enum(['draft', 'submitted', 'approved', 'rejected']);

// ============================================
// Base Grade Schemas
// ============================================

export const gradeSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  classId: z.string().uuid(),
  periodId: z.string().uuid(),
  teacherId: z.string().uuid(),
  academicYearId: z.string().uuid(),

  // Grade details
  gradeType: gradeTypeSchema,
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title must not exceed 200 characters'),
  score: z.number().nonnegative('Score must be non-negative'),
  maxScore: z.number().positive('Max score must be positive'),
  coefficient: z.number().positive('Coefficient must be positive').default(1),
  weight: z.number().positive('Weight must be positive').default(1),

  // Report card impact
  affectsReportCard: z.boolean().default(true),

  // Workflow fields
  status: gradeStatusSchema.default('draft'),
  submittedAt: z.date().nullable(),
  approvedAt: z.date().nullable(),
  approvedBy: z.string().uuid().nullable(),
  publishedAt: z.date().nullable(),

  // Locking fields
  isLocked: z.boolean().default(false),
  lockedAt: z.date().nullable(),
  lockedBy: z.string().uuid().nullable(),

  // Metadata
  comments: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),

  // Audit timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================
// Create/Update Schemas
// ============================================

export const createGradeSchema = gradeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  approvedAt: true,
  approvedBy: true,
  publishedAt: true,
  isLocked: true,
  lockedAt: true,
  lockedBy: true,
}).strict();

export const updateGradeSchema = createGradeSchema
  .partial()
  .extend({
    id: z.string().uuid(),
  })
  .strict();

// ============================================
// Bulk Input Schema
// ============================================

export const bulkGradesInputSchema = z.object({
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  periodId: z.string().uuid(),
  gradeType: gradeTypeSchema,
  title: z.string().min(3).max(200),
  maxScore: z.number().positive(),
  coefficient: z.number().positive().default(1),
  weight: z.number().positive().default(1),
  status: gradeStatusSchema.optional(),
  affectsReportCard: z.boolean().optional().default(true),
  grades: z.array(z.object({
    studentId: z.string().uuid(),
    score: z.number().nonnegative(),
    comments: z.string().optional(),
  })),
}).strict();

// ============================================
// Workflow Action Schemas
// ============================================

export const submitGradeSchema = z.object({
  id: z.string().uuid(),
  comments: z.string().optional(),
}).strict();

export const approveGradeSchema = z.object({
  id: z.string().uuid(),
  comments: z.string().optional(),
}).strict();

export const publishGradeSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const rejectGradeSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
}).strict();

export const unlockGradeSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
}).strict();

// ============================================
// Grade Version Schemas
// ============================================

export const gradeVersionSchema = z.object({
  id: z.string().uuid(),
  gradeId: z.string().uuid(),
  schoolId: z.string().uuid(),
  versionNumber: z.number().positive(),
  previousScore: z.number().nullable(),
  newScore: z.number().nullable(),
  previousStatus: gradeStatusSchema.nullable(),
  newStatus: gradeStatusSchema.nullable(),
  changeReason: z.string().nullable(),
  changedBy: z.string().uuid(),
  changedAt: z.date(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================
// Grade Submission Schemas
// ============================================

export const gradeSubmissionSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  periodId: z.string().uuid(),
  academicYearId: z.string().uuid(),

  // Workflow fields
  status: gradeSubmissionStatusSchema.default('draft'),
  submittedAt: z.date().nullable(),
  approvedAt: z.date().nullable(),
  approvedBy: z.string().uuid().nullable(),
  rejectedAt: z.date().nullable(),
  rejectionReason: z.string().nullable(),

  // Statistics
  totalGrades: z.number().int().nonnegative(),
  gradesEntered: z.number().int().nonnegative(),
  completionPercentage: z.number().min(0).max(100),

  // Metadata
  notes: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),

  // Audit timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createGradeSubmissionSchema = gradeSubmissionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  approvedAt: true,
  approvedBy: true,
  rejectedAt: true,
  rejectionReason: true,
}).strict();

export const updateGradeSubmissionSchema = createGradeSubmissionSchema
  .partial()
  .extend({
    id: z.string().uuid(),
  })
  .strict();

export const submitGradeSubmissionSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().optional(),
}).strict();

export const approveGradeSubmissionSchema = z.object({
  id: z.string().uuid(),
  comments: z.string().optional(),
}).strict();

export const rejectGradeSubmissionSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
}).strict();

// ============================================
// Filter Schemas
// ============================================

export const gradeFiltersSchema = z.object({
  studentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  periodId: z.string().uuid().optional(),
  status: gradeStatusSchema.optional(),
  teacherId: z.string().uuid().optional(),
  gradeType: gradeTypeSchema.optional(),
  academicYearId: z.string().uuid().optional(),
});

export const gradeSubmissionFiltersSchema = z.object({
  teacherId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  periodId: z.string().uuid().optional(),
  status: gradeSubmissionStatusSchema.optional(),
  academicYearId: z.string().uuid().optional(),
});

// ============================================
// Statistics Schemas
// ============================================

export const gradeStatisticsSchema = z.object({
  average: z.number(),
  minGrade: z.number(),
  maxGrade: z.number(),
  count: z.number().int().nonnegative(),
  passingCount: z.number().int().nonnegative(),
  failingCount: z.number().int().nonnegative(),
});

export const studentGradeSummarySchema = z.object({
  studentId: z.string().uuid(),
  periodId: z.string().uuid(),
  overallAverage: z.number(),
  subjectAverages: z.array(z.object({
    subjectId: z.string().uuid(),
    subjectName: z.string(),
    average: z.number(),
    totalCoefficient: z.number(),
    gradeCount: z.number().int().nonnegative(),
  })),
  totalGrades: z.number().int().nonnegative(),
  rankInClass: z.number().int().nullable(),
  classSize: z.number().int().nonnegative(),
});

// ============================================
// Export Types
// ============================================

export type GradeStatus = z.infer<typeof gradeStatusSchema>;
export type GradeType = z.infer<typeof gradeTypeSchema>;
export type GradeSubmissionStatus = z.infer<typeof gradeSubmissionStatusSchema>;

export type Grade = z.infer<typeof gradeSchema>;
export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type BulkGradesInput = z.infer<typeof bulkGradesInputSchema>;

export type SubmitGradeInput = z.infer<typeof submitGradeSchema>;
export type ApproveGradeInput = z.infer<typeof approveGradeSchema>;
export type PublishGradeInput = z.infer<typeof publishGradeSchema>;
export type RejectGradeInput = z.infer<typeof rejectGradeSchema>;
export type UnlockGradeInput = z.infer<typeof unlockGradeSchema>;

export type GradeVersion = z.infer<typeof gradeVersionSchema>;

export type GradeSubmission = z.infer<typeof gradeSubmissionSchema>;
export type CreateGradeSubmissionInput = z.infer<typeof createGradeSubmissionSchema>;
export type UpdateGradeSubmissionInput = z.infer<typeof updateGradeSubmissionSchema>;
export type SubmitGradeSubmissionInput = z.infer<typeof submitGradeSubmissionSchema>;
export type ApproveGradeSubmissionInput = z.infer<typeof approveGradeSubmissionSchema>;
export type RejectGradeSubmissionInput = z.infer<typeof rejectGradeSubmissionSchema>;

export type GradeFilters = z.infer<typeof gradeFiltersSchema>;
export type GradeSubmissionFilters = z.infer<typeof gradeSubmissionFiltersSchema>;

export type GradeStatistics = z.infer<typeof gradeStatisticsSchema>;
export type StudentGradeSummary = z.infer<typeof studentGradeSummarySchema>;
