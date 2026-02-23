// ============================================
// Module Premium - API Export Avancé
// TypeScript Schemas with Zod Validation
// ============================================

import { z } from 'zod';

// ============================================
// Base Enums
// ============================================

export const ExportTypeEnum = z.enum(['excel', 'pdf', 'csv']);
export type ExportType = z.infer<typeof ExportTypeEnum>;

export const ExportResourceTypeEnum = z.enum([
  'bulletins',
  'students',
  'attendance',
  'payments',
  'payroll',
  'grades',
  'schedules',
  'lesson_logs',
  'student_cards',
  'exam_results'
]);
export type ExportResourceType = z.infer<typeof ExportResourceTypeEnum>;

export const ExportStatusEnum = z.enum(['pending', 'processing', 'completed', 'failed', 'expired']);
export type ExportStatus = z.infer<typeof ExportStatusEnum>;

// ============================================
// Column Configuration Schema
// ============================================

export const ExportColumnSchema = z.object({
  key: z.string(),
  header: z.string().optional(),
  width: z.number().optional(),
  format: z.object({
    type: z.enum(['number', 'currency', 'percentage', 'date', 'integer', 'string']).optional(),
    decimals: z.number().optional(),
    symbol: z.string().optional()
  }).optional(),
  visible: z.boolean().optional()
});

// ============================================
// Template Configuration Schema
// ============================================

export const ExportTemplateConfigSchema = z.object({
  columns: z.array(ExportColumnSchema).optional(),
  filters: z.record(z.any()).optional(),
  styles: z.object({
    headerColor: z.string().optional(),
    headerFont: z.string().optional(),
    headerFontSize: z.number().optional(),
    headerBold: z.boolean().optional(),
    alternateRows: z.boolean().optional(),
    alternateRowColor: z.string().optional(),
    logo: z.boolean().optional(),
    pageSize: z.enum(['A4', 'A3', 'Letter']).optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    schoolHeader: z.boolean().optional(),
    footer: z.boolean().optional(),
    signatureLines: z.boolean().optional(),
    separator: z.enum([',', ';', '\t']).optional(),
    encoding: z.string().optional(),
    includeBOM: z.boolean().optional()
  }).optional(),
  sortBy: z.object({
    column: z.string(),
    direction: z.enum(['asc', 'desc'])
  }).optional()
});

export type ExportTemplateConfig = z.infer<typeof ExportTemplateConfigSchema>;

// ============================================
// Export Template Schema
// ============================================

export const ExportTemplateSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  export_type: ExportTypeEnum,
  resource_type: ExportResourceTypeEnum,
  template_config: ExportTemplateConfigSchema,
  is_active: z.boolean(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ExportTemplate = z.infer<typeof ExportTemplateSchema>;

// ============================================
// Export Job Schema
// ============================================

export const ExportJobSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  template_id: z.string().uuid().nullable(),
  export_type: ExportTypeEnum,
  resource_type: ExportResourceTypeEnum,
  status: ExportStatusEnum,
  file_path: z.string().nullable(),
  file_size_bytes: z.bigint().nullable(),
  filters: z.record(z.any()),
  row_count: z.number().nullable(),
  initiated_by: z.string().uuid(),
  scheduled_job_id: z.string().uuid().nullable(),
  error_message: z.string().nullable(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  expires_at: z.string().datetime(),
  created_at: z.string().datetime()
});

export type ExportJob = z.infer<typeof ExportJobSchema>;

// ============================================
// Scheduled Export Schema
// ============================================

export const ScheduledExportSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  template_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(255),
  cron_expression: z.string().min(1).max(100),
  filters: z.record(z.any()),
  recipients: z.array(z.string().email()),
  is_active: z.boolean(),
  last_run_at: z.string().datetime().nullable(),
  next_run_at: z.string().datetime(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ScheduledExport = z.infer<typeof ScheduledExportSchema>;

// ============================================
// Export API Token Schema
// ============================================

export const ExportApiTokenSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  token_hash: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  permissions: z.array(ExportResourceTypeEnum),
  expires_at: z.string().datetime().nullable(),
  last_used_at: z.string().datetime().nullable(),
  usage_count: z.number(),
  rate_limit_per_hour: z.number(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable()
});

export type ExportApiToken = z.infer<typeof ExportApiTokenSchema>;

// ============================================
// Export Filters Schema
// ============================================

export const ExportFiltersSchema = z.object({
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional()
  }).optional(),
  periodId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  status: z.string().optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  teacherId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  gradeType: z.string().optional(),
  feeType: z.string().optional(),
  paymentMethod: z.string().optional()
});

export type ExportFilters = z.infer<typeof ExportFiltersSchema>;

// ============================================
// Launch Export Request Schema
// ============================================

export const LaunchExportRequestSchema = z.object({
  templateId: z.string().uuid().optional(),
  templateConfig: ExportTemplateConfigSchema.optional(),
  exportType: ExportTypeEnum,
  resourceType: ExportResourceTypeEnum,
  filters: ExportFiltersSchema.optional()
});

export type LaunchExportRequest = z.infer<typeof LaunchExportRequestSchema>;

// ============================================
// Download Export Request Schema
// ============================================

export const DownloadExportRequestSchema = z.object({
  jobId: z.string().uuid()
});

export type DownloadExportRequest = z.infer<typeof DownloadExportRequestSchema>;

// ============================================
// Create Template Request Schema
// ============================================

export const CreateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  export_type: ExportTypeEnum,
  resource_type: ExportResourceTypeEnum,
  template_config: ExportTemplateConfigSchema
});

export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

// ============================================
// Update Template Request Schema
// ============================================

export const UpdateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  template_config: ExportTemplateConfigSchema.optional(),
  is_active: z.boolean().optional()
});

export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

// ============================================
// Create Scheduled Export Request Schema
// ============================================

export const CreateScheduledExportRequestSchema = z.object({
  template_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  cron_expression: z.string().min(1).max(100),
  filters: ExportFiltersSchema.optional(),
  recipients: z.array(z.string().email())
});

export type CreateScheduledExportRequest = z.infer<typeof CreateScheduledExportRequestSchema>;

// ============================================
// Create API Token Request Schema
// ============================================

export const CreateApiTokenRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  permissions: z.array(ExportResourceTypeEnum).min(1),
  rate_limit_per_hour: z.number().min(0).optional(),
  expires_at: z.string().datetime().optional()
});

export type CreateApiTokenRequest = z.infer<typeof CreateApiTokenRequestSchema>;

// ============================================
// API Export Request Schema
// ============================================

export const ApiExportRequestSchema = z.object({
  exportType: ExportTypeEnum,
  resourceType: ExportResourceTypeEnum,
  filters: ExportFiltersSchema.optional(),
  returnUrl: z.boolean().optional()
});

export type ApiExportRequest = z.infer<typeof ApiExportRequestSchema>;

// ============================================
// Export Response Schemas
// ============================================

export const LaunchExportResponseSchema = z.object({
  success: z.boolean(),
  jobId: z.string().uuid(),
  status: ExportStatusEnum,
  exportType: ExportTypeEnum.optional(),
  resourceType: ExportResourceTypeEnum.optional()
});

export type LaunchExportResponse = z.infer<typeof LaunchExportResponseSchema>;

export const DownloadExportResponseSchema = z.object({
  success: z.boolean(),
  signedUrl: z.string().url(),
  fileName: z.string(),
  fileSize: z.bigint(),
  rowCount: z.number().optional(),
  expiresAt: z.string().datetime()
});

export type DownloadExportResponse = z.infer<typeof DownloadExportResponseSchema>;

// ============================================
// Export Statistics Schema
// ============================================

export const ExportStatisticsSchema = z.object({
  totalExports: z.number(),
  exportsThisMonth: z.number(),
  exportsByType: z.record(z.enum(['excel', 'pdf', 'csv']), z.number()),
  exportsByResource: z.record(ExportResourceTypeEnum, z.number()),
  successRate: z.number(),
  averageFileSize: z.number(),
  averageProcessingTime: z.number() // in seconds
});

export type ExportStatistics = z.infer<typeof ExportStatisticsSchema>;

// Export all schemas
export default {
  ExportTypeEnum,
  ExportResourceTypeEnum,
  ExportStatusEnum,
  ExportColumnSchema,
  ExportTemplateConfigSchema,
  ExportTemplateSchema,
  ExportJobSchema,
  ScheduledExportSchema,
  ExportApiTokenSchema,
  ExportFiltersSchema,
  LaunchExportRequestSchema,
  DownloadExportRequestSchema,
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  CreateScheduledExportRequestSchema,
  CreateApiTokenRequestSchema,
  ApiExportRequestSchema,
  LaunchExportResponseSchema,
  DownloadExportResponseSchema,
  ExportStatisticsSchema
};
