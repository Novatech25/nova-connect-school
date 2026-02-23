import { z } from 'zod';

export const cardStatusSchema = z.enum(['active', 'expired', 'revoked', 'lost']);

export const paymentStatusSchema = z.enum(['ok', 'warning', 'blocked']);

export const layoutConfigSchema = z.object({
  logoPosition: z.object({ x: z.number(), y: z.number() }).optional(),
  photoPosition: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  qrPosition: z.object({ x: z.number(), y: z.number(), size: z.number() }),
  textColor: z.string().default('#000000'),
  backgroundColor: z.string().default('#FFFFFF'),
  borderColor: z.string().optional(),
  fontSize: z.number().default(10),
  fontFamily: z.string().default('Helvetica'),
  namePosition: z.object({ x: z.number(), y: z.number() }).optional(),
  matriculePosition: z.object({ x: z.number(), y: z.number() }).optional(),
  classPosition: z.object({ x: z.number(), y: z.number() }).optional(),
  schoolNamePosition: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const cardTemplateSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  layoutConfig: layoutConfigSchema,
  logoUrl: z.string().url().optional(),
  backgroundImageUrl: z.string().url().optional(),
  cardWidthMm: z.number().positive().default(85.60),
  cardHeightMm: z.number().positive().default(53.98),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createCardTemplateSchema = cardTemplateSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    logoFile: z.any().optional(),
    backgroundImageFile: z.any().optional(),
  });

export const updateCardTemplateSchema = cardTemplateSchema
  .partial()
  .required({ id: true })
  .extend({
    logoFile: z.any().optional(),
    backgroundImageFile: z.any().optional(),
  });

export const studentCardSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  templateId: z.string().uuid().nullable(),
  cardNumber: z.string().min(1),
  qrCodeData: z.string(),
  qrCodeSignature: z.string(),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date().nullable(),
  status: cardStatusSchema.default('active'),
  pdfUrl: z.string().optional(),
  pdfSizeBytes: z.number().int().positive().optional(),
  generatedAt: z.coerce.date().optional(),
  generatedBy: z.string().uuid().nullable(),
  revokedAt: z.coerce.date().nullable(),
  revokedBy: z.string().uuid().nullable(),
  revocationReason: z.string().optional(),
  paymentStatus: paymentStatusSchema.default('ok'),
  paymentStatusOverride: z.boolean().default(false),
  overrideReason: z.string().optional(),
  overrideBy: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createStudentCardSchema = z.object({
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  cardNumber: z.string().optional(),
  issueDate: z.coerce.date().default(() => new Date()),
  expiryDate: z.coerce.date().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateStudentCardSchema = studentCardSchema
  .partial()
  .required({ id: true });

export const revokeCardSchema = z.object({
  cardId: z.string().uuid(),
  reason: z.string().min(1, 'Reason is required'),
});

export const generateCardBatchSchema = z.object({
  schoolId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1, 'At least one student required'),
  templateId: z.string().uuid().nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
});

export const generateCardPdfSchema = z.object({
  studentId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  regenerate: z.boolean().default(false),
});

export const overrideCardPaymentStatusSchema = z.object({
  cardId: z.string().uuid(),
  override: z.boolean(),
  reason: z.string().optional(),
});

export const validateCardQrSchema = z.object({
  qrData: z.string(),
  signature: z.string(),
  expectedClassId: z.string().uuid().optional(),
  expectedCampusId: z.string().uuid().optional(),
});

export type CardStatus = z.infer<typeof cardStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type LayoutConfig = z.infer<typeof layoutConfigSchema>;
export type CardTemplate = z.infer<typeof cardTemplateSchema>;
export type CreateCardTemplate = z.infer<typeof createCardTemplateSchema>;
export type UpdateCardTemplate = z.infer<typeof updateCardTemplateSchema>;
export type StudentCard = z.infer<typeof studentCardSchema>;
export type CreateStudentCard = z.infer<typeof createStudentCardSchema>;
export type UpdateStudentCard = z.infer<typeof updateStudentCardSchema>;
export type RevokeCard = z.infer<typeof revokeCardSchema>;
export type GenerateCardBatch = z.infer<typeof generateCardBatchSchema>;
export type GenerateCardPdf = z.infer<typeof generateCardPdfSchema>;
export type OverrideCardPaymentStatus = z.infer<typeof overrideCardPaymentStatusSchema>;
export type ValidateCardQr = z.infer<typeof validateCardQrSchema>;
