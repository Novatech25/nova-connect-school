import { z } from 'zod';

// ============================================
// ENUM Schemas
// ============================================

export const feeTypeCategorySchema = z.enum([
  'inscription',
  'mensualite',
  'tranche',
  'examen',
  'activite',
  'autre'
]);

export const feeScheduleStatusSchema = z.enum([
  'pending',
  'paid',
  'partial',
  'overdue',
  'cancelled'
]);

export const paymentMethodSchema = z.enum([
  'cash',
  'bank_transfer',
  'check',
  'mobile_money',
  'card',
  'other'
]);

export const reminderTypeSchema = z.enum([
  'first',
  'second',
  'final',
  'custom'
]);

export const reminderStatusSchema = z.enum([
  'pending',
  'sent',
  'failed'
]);

export const exemptionTypeSchema = z.enum([
  'scholarship',
  'discount',
  'exemption',
  'other'
]);

// ============================================
// Database Entity Schemas
// ============================================

export const feeTypeSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  category: feeTypeCategorySchema,
  default_amount: z.number().nonnegative(),
  is_mandatory: z.boolean(),
  applies_to_levels: z.array(z.string().uuid()),
  is_active: z.boolean(),
  metadata: z.record(z.any()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const feeScheduleSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  student_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  fee_type_id: z.string().uuid(),
  amount: z.number().nonnegative(),
  due_date: z.coerce.date(),
  status: feeScheduleStatusSchema,
  paid_amount: z.number().nonnegative(),
  remaining_amount: z.number().nonnegative(),
  discount_amount: z.number().nonnegative(),
  discount_reason: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  // Relations
  fee_types: feeTypeSchema.optional(),
});

export const paymentSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  student_id: z.string().uuid(),
  fee_schedule_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_date: z.coerce.date(),
  payment_method: paymentMethodSchema,
  reference_number: z.string().optional(),
  received_by: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  // Relations
  student: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    matricule: z.string().optional(),
  }).optional(),
  fee_schedules: feeScheduleSchema.optional(),
});

export const paymentReceiptSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  payment_id: z.string().uuid(),
  receipt_number: z.string(),
  pdf_url: z.string(), // Storage path, not a full URL - use generateReceipt() to get signed URL
  pdf_size_bytes: z.number().int().optional(),
  generated_at: z.coerce.date(),
  generated_by: z.string().uuid().optional(),
  sent_at: z.coerce.date().optional(),
  sent_to: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.coerce.date(),
});

export const paymentReminderSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  student_id: z.string().uuid(),
  fee_schedule_id: z.string().uuid(),
  reminder_type: reminderTypeSchema,
  sent_at: z.coerce.date().optional(),
  sent_via: z.array(z.string()),
  status: reminderStatusSchema,
  scheduled_for: z.coerce.date().optional(),
  message_template: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.coerce.date(),
});

export const paymentExemptionSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  student_id: z.string().uuid(),
  exemption_type: exemptionTypeSchema,
  amount: z.number().nonnegative().optional(),
  percentage: z.number().nonnegative().max(100).optional(),
  reason: z.string().min(1),
  approved_by: z.string().uuid(),
  approved_at: z.coerce.date(),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date().optional(),
  applies_to_fee_types: z.array(z.string().uuid()),
  is_active: z.boolean(),
  metadata: z.record(z.any()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

// ============================================
// Input Schemas for API
// ============================================

export const createFeeTypeSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  category: feeTypeCategorySchema,
  default_amount: z.number().nonnegative(),
  is_mandatory: z.boolean().default(true),
  applies_to_levels: z.array(z.string().uuid()).default([]),
  is_active: z.boolean().default(true),
  metadata: z.record(z.any()).optional().default({}),
});

export const updateFeeTypeSchema = createFeeTypeSchema.partial().extend({
  id: z.string().uuid(),
});

export const createFeeScheduleSchema = z.object({
  student_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  fee_type_id: z.string().uuid(),
  amount: z.number().nonnegative(),
  due_date: z.coerce.date(),
  discount_amount: z.number().nonnegative().default(0),
  discount_reason: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export const updateFeeScheduleSchema = createFeeScheduleSchema.partial().extend({
  id: z.string().uuid(),
});

export const recordPaymentSchema = z.object({
  student_id: z.string().uuid(),
  fee_schedule_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: paymentMethodSchema,
  reference_number: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
}).strict();

// Base exemption schema (without refine) to allow .partial() usage
const baseExemptionSchema = z.object({
  student_id: z.string().uuid(),
  exemption_type: exemptionTypeSchema,
  amount: z.number().nonnegative().optional(),
  percentage: z.number().min(0).max(100).optional(),
  reason: z.string().min(1),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date().optional(),
  applies_to_fee_types: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.any()).optional().default({}),
});

export const applyExemptionSchema = baseExemptionSchema.refine(
  (data) => data.amount !== undefined || data.percentage !== undefined,
  { message: "Either amount or percentage must be provided" }
);

export const updateExemptionSchema = baseExemptionSchema.partial().extend({
  id: z.string().uuid(),
});

export const sendReminderSchema = z.object({
  student_id: z.string().uuid(),
  fee_schedule_id: z.string().uuid().optional(),
  reminder_type: reminderTypeSchema,
  message_template: z.string().optional(),
});

// ============================================
// Filter and Query Schemas
// ============================================

export const paymentFiltersSchema = z.object({
  studentId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  feeTypeId: z.string().uuid().optional(),
  status: feeScheduleStatusSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  schoolId: z.string().uuid().optional(),
});

export const paymentReportTypeSchema = z.enum([
  'encaissements',
  'arrieres',
  'previsions',
  'recouvrement'
]);

export const financialReportSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  feeTypeId: z.string().uuid().optional(),
  reportType: paymentReportTypeSchema,
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// ============================================
// Response Schemas
// ============================================

export const studentBalanceSchema = z.object({
  total_due: z.number(),
  total_paid: z.number(),
  total_remaining: z.number(),
  total_overdue: z.number(),
  payment_status: z.enum(['ok', 'warning', 'blocked']),
});

export const paymentStatsSchema = z.object({
  total_collected: z.number(),
  total_pending: z.number(),
  total_overdue: z.number(),
  collection_rate: z.number(),
  payment_count: z.number(),
});

export const paymentSummarySchema = z.object({
  student: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    matricule: z.string().optional(),
  }),
  balance: studentBalanceSchema,
  fee_schedules: z.array(feeScheduleSchema),
  recent_payments: z.array(paymentSchema),
  exemptions: z.array(paymentExemptionSchema),
});

// ============================================
// TypeScript Type Exports
// ============================================

export type FeeTypeCategory = z.infer<typeof feeTypeCategorySchema>;
export type FeeScheduleStatus = z.infer<typeof feeScheduleStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type ReminderType = z.infer<typeof reminderTypeSchema>;
export type ReminderStatus = z.infer<typeof reminderStatusSchema>;
export type ExemptionType = z.infer<typeof exemptionTypeSchema>;

export type FeeType = z.infer<typeof feeTypeSchema>;
export type FeeSchedule = z.infer<typeof feeScheduleSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>;
export type PaymentReminder = z.infer<typeof paymentReminderSchema>;
export type PaymentExemption = z.infer<typeof paymentExemptionSchema>;

export type CreateFeeTypeInput = z.infer<typeof createFeeTypeSchema>;
export type UpdateFeeTypeInput = z.infer<typeof updateFeeTypeSchema>;
export type CreateFeeScheduleInput = z.infer<typeof createFeeScheduleSchema>;
export type UpdateFeeScheduleInput = z.infer<typeof updateFeeScheduleSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type ApplyExemptionInput = z.infer<typeof applyExemptionSchema>;
export type UpdateExemptionInput = z.infer<typeof updateExemptionSchema>;
export type SendReminderInput = z.infer<typeof sendReminderSchema>;

export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;
export type PaymentReportType = z.infer<typeof paymentReportTypeSchema>;
export type FinancialReportInput = z.infer<typeof financialReportSchema>;

export type StudentBalance = z.infer<typeof studentBalanceSchema>;
export type PaymentStats = z.infer<typeof paymentStatsSchema>;
export type PaymentSummary = z.infer<typeof paymentSummarySchema>;
