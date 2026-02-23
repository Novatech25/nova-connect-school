import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const payrollPeriodStatusSchema = z.enum(['draft', 'pending_payment', 'paid', 'cancelled']);
export const salaryComponentTypeSchema = z.enum(['base_hours', 'prime', 'retenue', 'avance', 'bonus', 'deduction', 'other']);

export type PayrollPeriodStatus = z.infer<typeof payrollPeriodStatusSchema>;
export type SalaryComponentType = z.infer<typeof salaryComponentTypeSchema>;

// ============================================================================
// PAYROLL PERIOD
// ============================================================================

export const payrollPeriodSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  periodName: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: payrollPeriodStatusSchema,
  totalAmount: z.number().nonnegative(),
  totalTeachers: z.number().int().nonnegative(),
  createdBy: z.string().uuid().nullable(),
  validatedBy: z.string().uuid().nullable(),
  validatedAt: z.string().datetime().nullable(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PayrollPeriod = z.infer<typeof payrollPeriodSchema>;

export const createPayrollPeriodSchema = z.object({
  academicYearId: z.string().uuid(),
  periodName: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metadata: z.record(z.any()).optional().default({}),
}).refine(data => new Date(data.endDate) > new Date(data.startDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export type CreatePayrollPeriodInput = z.infer<typeof createPayrollPeriodSchema>;

// ============================================================================
// PAYROLL ENTRY
// ============================================================================

export const payrollEntrySchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  payrollPeriodId: z.string().uuid(),
  teacherId: z.string().uuid(),
  totalHours: z.number().nonnegative(),
  validatedHours: z.number().nonnegative(),
  hourlyRate: z.number().nonnegative(),
  baseAmount: z.number().nonnegative(),
  primesAmount: z.number().nonnegative(),
  retenuesAmount: z.number().nonnegative(),
  avancesAmount: z.number().nonnegative(),
  grossAmount: z.number().nonnegative(),
  netAmount: z.number(),
  status: payrollPeriodStatusSchema,
  notes: z.string().nullable(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PayrollEntry = z.infer<typeof payrollEntrySchema>;

export const updatePayrollEntrySchema = z.object({
  id: z.string().uuid(),
  validatedHours: z.number().nonnegative().optional(),
  hourlyRate: z.number().nonnegative().optional(),
  primesAmount: z.number().nonnegative().optional(),
  retenuesAmount: z.number().nonnegative().optional(),
  avancesAmount: z.number().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

export type UpdatePayrollEntryInput = z.infer<typeof updatePayrollEntrySchema>;

// ============================================================================
// SALARY COMPONENT
// ============================================================================

export const salaryComponentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  payrollEntryId: z.string().uuid(),
  componentType: salaryComponentTypeSchema,
  label: z.string().min(1).max(255),
  amount: z.number().refine(val => val !== 0, 'Amount cannot be zero'),
  description: z.string().nullable(),
  addedBy: z.string().uuid().nullable(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
});

export type SalaryComponent = z.infer<typeof salaryComponentSchema>;

export const createSalaryComponentSchema = z.object({
  payrollEntryId: z.string().uuid(),
  componentType: salaryComponentTypeSchema,
  label: z.string().min(1, 'Label is required').max(255),
  amount: z.number().refine(val => val !== 0, 'Amount cannot be zero'),
  description: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export type CreateSalaryComponentInput = z.infer<typeof createSalaryComponentSchema>;

// ============================================================================
// PAYROLL PAYMENT
// ============================================================================

export const payrollPaymentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  payrollEntryId: z.string().uuid(),
  amount: z.number().positive(),
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'mobile_money', 'card', 'other']),
  referenceNumber: z.string().nullable(),
  paidBy: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PayrollPayment = z.infer<typeof payrollPaymentSchema>;

export const recordPayrollPaymentSchema = z.object({
  payrollEntryId: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'mobile_money', 'card', 'other']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional().default({}),
  autoGenerateSlip: z.boolean().optional().default(true),
});

export type RecordPayrollPaymentInput = z.infer<typeof recordPayrollPaymentSchema>;

// ============================================================================
// PAYROLL SLIP
// ============================================================================

export const payrollSlipSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  payrollEntryId: z.string().uuid(),
  slipNumber: z.string(),
  pdfUrl: z.string(),
  pdfSizeBytes: z.number().int().nullable(),
  generatedAt: z.string().datetime(),
  generatedBy: z.string().uuid().nullable(),
  sentAt: z.string().datetime().nullable(),
  sentTo: z.record(z.any()).nullable(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
});

export type PayrollSlip = z.infer<typeof payrollSlipSchema>;

// ============================================================================
// RELATIONS
// ============================================================================

export const payrollEntryWithRelationsSchema = payrollEntrySchema.extend({
  teacher: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }).optional(),
  payrollPeriod: payrollPeriodSchema.optional(),
  salaryComponents: z.array(salaryComponentSchema).optional(),
  payments: z.array(payrollPaymentSchema).optional(),
  slip: payrollSlipSchema.nullable().optional(),
});

export type PayrollEntryWithRelations = z.infer<typeof payrollEntryWithRelationsSchema>;

// ============================================================================
// FILTERS
// ============================================================================

export const payrollFiltersSchema = z.object({
  teacherId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  status: payrollPeriodStatusSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type PayrollFilters = z.infer<typeof payrollFiltersSchema>;

// ============================================================================
// STATS
// ============================================================================

export const teacherPayrollStatsSchema = z.object({
  teacherId: z.string().uuid(),
  totalHoursValidated: z.number(),
  totalEarned: z.number(),
  totalPaid: z.number(),
  totalPending: z.number(),
  averageHourlyRate: z.number(),
  periodsCount: z.number(),
});

export type TeacherPayrollStats = z.infer<typeof teacherPayrollStatsSchema>;

// ============================================================================
// HOURS BREAKDOWN
// ============================================================================

export const teacherHoursBreakdownSchema = z.object({
  className: z.string(),
  subjectName: z.string(),
  periodName: z.string(),
  totalHours: z.number(),
  sessionsCount: z.number(),
  hourlyRate: z.number(),
  amount: z.number(),
});

export type TeacherHoursBreakdown = z.infer<typeof teacherHoursBreakdownSchema>;

// ============================================================================
// CURRENT MONTH ESTIMATE
// ============================================================================

export const teacherCurrentMonthEstimateSchema = z.object({
  currentMonthHours: z.number(),
  estimatedAmount: z.number(),
  lastHourlyRate: z.number(),
  validatedSessionsCount: z.number(),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
});

export type TeacherCurrentMonthEstimate = z.infer<typeof teacherCurrentMonthEstimateSchema>;
