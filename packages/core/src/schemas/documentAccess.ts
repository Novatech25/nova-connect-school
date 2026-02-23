import { z } from 'zod';

export const documentTypeSchema = z.enum([
  'report_card',
  'certificate',
  'student_card',
  'exam_authorization',
]);

export const documentAccessLogSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  userId: z.string().uuid(),
  studentId: z.string().uuid(),
  documentType: documentTypeSchema,
  documentId: z.string().uuid(),
  documentName: z.string().optional(),
  accessGranted: z.boolean(),
  paymentStatus: z.enum(['ok', 'warning', 'blocked']),
  paymentStatusOverride: z.boolean(),
  denialReason: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  accessedAt: z.coerce.date(),
});

export const documentAccessFiltersSchema = z.object({
  studentId: z.string().uuid().optional(),
  documentType: documentTypeSchema.optional(),
  accessGranted: z.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentAccessLog = z.infer<typeof documentAccessLogSchema>;
export type DocumentAccessFilters = z.infer<typeof documentAccessFiltersSchema>;
