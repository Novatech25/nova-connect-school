import { z } from "zod";

// Enums
export const importTypeSchema = z.enum(['schedules', 'grades', 'students']);
export const importStatusSchema = z.enum(['uploaded', 'parsing', 'validating', 'previewing', 'importing', 'completed', 'failed', 'rolled_back']);
export const importActionSchema = z.enum(['created', 'updated', 'skipped']);

// Validation Error Schema
export const importValidationErrorSchema = z.object({
  row: z.number(),
  field: z.string(),
  message: z.string(),
  value: z.any(),
});

// Import Job Schema
export const importJobSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  importType: importTypeSchema,
  fileName: z.string(),
  filePath: z.string().nullable(),
  fileSizeBytes: z.number().optional(),
  status: importStatusSchema,
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
  importedRows: z.number().int().nonnegative(),
  columnMapping: z.record(z.string()),
  validationErrors: z.array(importValidationErrorSchema),
  importConfig: z.record(z.unknown()).optional(),
  initiatedBy: z.string().uuid().nullable(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date().nullable(),
  errorMessage: z.string().nullable(),
  canRollback: z.boolean(),
  rolledBackAt: z.coerce.date().nullable(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createImportJobSchema = z.object({
  schoolId: z.string().uuid(),
  importType: importTypeSchema,
  fileName: z.string().min(1),
  filePath: z.string().optional(),
  fileSizeBytes: z.number().optional(),
  importConfig: z.record(z.unknown()).optional(),
});

// Import Template Schema
export const importTemplateSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  importType: importTypeSchema,
  columnMapping: z.record(z.string()),
  defaultValues: z.record(z.unknown()).optional(),
  validationRules: z.record(z.unknown()).optional(),
  isActive: z.boolean(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createImportTemplateSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  importType: importTypeSchema,
  columnMapping: z.record(z.string()),
  defaultValues: z.record(z.unknown()).optional(),
  validationRules: z.record(z.unknown()).optional(),
});

// Import History Schema
export const importHistorySchema = z.object({
  id: z.string().uuid(),
  importJobId: z.string().uuid(),
  schoolId: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string().uuid().nullable(),
  action: importActionSchema,
  rowNumber: z.number().int().optional(),
  originalData: z.record(z.unknown()),
  importedData: z.record(z.unknown()),
  createdAt: z.coerce.date(),
});

// Student Import Row Schema
export const importStudentRowSchema = z.object({
  matricule: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.union([z.string(), z.date()]).optional(),
  gender: z.enum(['M', 'F', 'Autre']).optional(),
  placeOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  classId: z.string().uuid().optional(),
  className: z.string().optional(),
  status: z.enum(['active', 'inactive', 'graduated', 'transferred']).optional(),
  parentId: z.string().uuid().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
});

// Grade Import Row Schema
export const importGradeRowSchema = z.object({
  studentMatricule: z.union([z.string(), z.string().uuid()]),
  subjectCode: z.union([z.string(), z.string().uuid()]),
  periodName: z.union([z.string(), z.string().uuid()]),
  score: z.union([z.number(), z.string()]),
  maxScore: z.union([z.number(), z.string()]),
  gradeType: z.enum(['assignment', 'exam', 'quiz', 'project', 'participation', 'composition', 'homework']),
  title: z.string().min(1, "Title is required"),
  coefficient: z.number().optional().default(1),
  weight: z.number().optional().default(1),
  comments: z.string().optional(),
  gradedDate: z.union([z.string(), z.date()]).optional(),
  className: z.string().optional(),
  teacherEmail: z.string().email().optional().or(z.literal("")),
});

// Schedule Slot Import Row Schema
export const importScheduleSlotRowSchema = z.object({
  dayOfWeek: z.enum(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format"),
  teacherEmail: z.union([z.string().email(), z.string().uuid()]),
  className: z.union([z.string(), z.string().uuid()]),
  subjectCode: z.union([z.string(), z.string().uuid()]),
  roomName: z.string().optional(),
  campusName: z.string().optional(),
  semester: z.string().optional(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  isRecurring: z.boolean().optional().default(true),
  notes: z.string().optional(),
});

// Parsed Import Data Schema
export const parsedImportDataSchema = z.object({
  columns: z.array(z.string()),
  detectedMapping: z.record(z.string()),
  rows: z.array(z.record(z.unknown())),
  validationErrors: z.array(importValidationErrorSchema),
  stats: z.object({
    total: z.number().int(),
    valid: z.number().int(),
    invalid: z.number().int(),
  }),
});

// TypeScript exports
export type ImportType = z.infer<typeof importTypeSchema>;
export type ImportStatus = z.infer<typeof importStatusSchema>;
export type ImportAction = z.infer<typeof importActionSchema>;
export type ImportJob = z.infer<typeof importJobSchema>;
export type CreateImportJob = z.infer<typeof createImportJobSchema>;
export type ImportTemplate = z.infer<typeof importTemplateSchema>;
export type CreateImportTemplate = z.infer<typeof createImportTemplateSchema>;
export type ImportHistory = z.infer<typeof importHistorySchema>;
export type ImportStudentRow = z.infer<typeof importStudentRowSchema>;
export type ImportGradeRow = z.infer<typeof importGradeRowSchema>;
export type ImportScheduleSlotRow = z.infer<typeof importScheduleSlotRowSchema>;
export type ParsedImportData = z.infer<typeof parsedImportDataSchema>;
export type ImportValidationError = z.infer<typeof importValidationErrorSchema>;
