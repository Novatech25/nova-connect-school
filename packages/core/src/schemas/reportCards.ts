import { z } from 'zod';

export const reportCardStatusSchema = z.enum(['draft', 'generated', 'published', 'archived']);
export const paymentBlockStatusSchema = z.enum(['ok', 'warning', 'blocked']);

export const subjectAverageSchema = z.object({
  subjectId: z.string().uuid(),
  subjectName: z.string(),
  average: z.number().min(0).max(20),
  coefficient: z.number().positive(),
  gradeCount: z.number().int().nonnegative(),
});

export const reportCardSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  periodId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  gradingScaleId: z.string().uuid(),

  overallAverage: z.number().min(0).max(20),
  rankInClass: z.number().int().positive().nullable(),
  classSize: z.number().int().positive(),
  mention: z.string().nullable(),
  mentionColor: z.string().nullable(),
  subjectAverages: z.array(subjectAverageSchema),

  status: reportCardStatusSchema,
  generatedAt: z.date().nullable(),
  generatedBy: z.string().uuid().nullable(),
  publishedAt: z.date().nullable(),
  publishedBy: z.string().uuid().nullable(),

  paymentStatus: paymentBlockStatusSchema,
  paymentStatusOverride: z.boolean(),
  overrideReason: z.string().nullable(),
  overrideBy: z.string().uuid().nullable(),
  overrideAt: z.date().nullable(),

  pdfUrl: z.string().url().nullable(),
  pdfSizeBytes: z.number().int().positive().nullable(),

  comments: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export const generateReportCardSchema = z.object({
  studentId: z.string().uuid(),
  periodId: z.string().uuid(),
  regenerate: z.boolean().optional().default(false),
  templateId: z.string().optional(),
}).strict();

export const generateBatchReportCardsSchema = z.object({
  classId: z.string().uuid(),
  periodId: z.string().uuid(),
  regenerate: z.boolean().optional().default(false),
  templateId: z.string().optional(),
}).strict();

export const publishReportCardSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const overridePaymentBlockSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
}).strict();

export const reportCardFiltersSchema = z.object({
  studentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  periodId: z.string().uuid().optional(),
  status: reportCardStatusSchema.optional(),
  paymentStatus: paymentBlockStatusSchema.optional(),
  academicYearId: z.string().uuid().optional(),
});

export const exportReportCardsSchema = z.object({
  classId: z.string().uuid().optional(),
  periodId: z.string().uuid(),
  format: z.enum(['csv', 'excel']),
}).strict();

// Types
export type ReportCardStatus = z.infer<typeof reportCardStatusSchema>;
export type PaymentBlockStatus = z.infer<typeof paymentBlockStatusSchema>;
export type SubjectAverage = z.infer<typeof subjectAverageSchema>;
export type ReportCard = z.infer<typeof reportCardSchema>;
export type GenerateReportCardInput = z.infer<typeof generateReportCardSchema>;
export type GenerateBatchReportCardsInput = z.infer<typeof generateBatchReportCardsSchema>;
export type PublishReportCardInput = z.infer<typeof publishReportCardSchema>;
export type OverridePaymentBlockInput = z.infer<typeof overridePaymentBlockSchema>;
export type ReportCardFilters = z.infer<typeof reportCardFiltersSchema>;
export type ExportReportCardsInput = z.infer<typeof exportReportCardsSchema>;
