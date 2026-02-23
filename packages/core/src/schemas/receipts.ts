import { z } from 'zod';

export const printerProfileTypeSchema = z.enum(['A4_STANDARD', 'THERMAL_80', 'THERMAL_58']);
export const receiptTypeSchema = z.enum(['student_payment', 'teacher_salary']);

export const printerProfileSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  profile_name: z.string().min(1).max(50),
  profile_type: printerProfileTypeSchema,
  is_default: z.boolean(),
  template_config: z.object({
    page_width: z.number().optional(),
    page_height: z.number().optional(),
    margin_top: z.number().optional(),
    margin_bottom: z.number().optional(),
    margin_left: z.number().optional(),
    margin_right: z.number().optional(),
    font_size_header: z.number().optional(),
    font_size_body: z.number().optional(),
    font_size_footer: z.number().optional(),
    show_logo: z.boolean().optional(),
    show_qr: z.boolean().optional(),
    show_signature: z.boolean().optional(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const receiptVerificationTokenSchema = z.object({
  id: z.string().uuid(),
  receipt_id: z.string().uuid(),
  receipt_type: receiptTypeSchema,
  token_hash: z.string(),
  expires_at: z.coerce.date(),
  verified_at: z.coerce.date().optional(),
  verified_by: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.coerce.date(),
});

export const generateReceiptRequestSchema = z.object({
  paymentId: z.string().uuid().optional(),
  payrollEntryId: z.string().uuid().optional(),
  printerProfileId: z.string().uuid().optional(),
  autoSend: z.boolean().default(false),
  sendChannels: z.array(z.enum(['email', 'whatsapp', 'sms'])).default([]),
}).refine(data => data.paymentId || data.payrollEntryId, {
  message: 'Either paymentId or payrollEntryId must be provided',
});

export const verifyReceiptRequestSchema = z.object({
  token: z.string().min(1),
});

export type PrinterProfileType = z.infer<typeof printerProfileTypeSchema>;
export type ReceiptType = z.infer<typeof receiptTypeSchema>;
export type PrinterProfile = z.infer<typeof printerProfileSchema>;
export type ReceiptVerificationToken = z.infer<typeof receiptVerificationTokenSchema>;
export type GenerateReceiptRequest = z.infer<typeof generateReceiptRequestSchema>;
export type VerifyReceiptRequest = z.infer<typeof verifyReceiptRequestSchema>;
