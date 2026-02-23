// Zod Schemas for QR Attendance System
// Validation schemas for QR code generation and scanning

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const QrCodeTypeSchema = z.enum([
  'school_global',
  'class_specific',
  'student_card',
]);

export type QrCodeType = z.infer<typeof QrCodeTypeSchema>;

export const QrScanStatusSchema = z.enum([
  'success',
  'expired_qr',
  'invalid_signature',
  'wrong_class',
  'wrong_time',
  'out_of_range',
  'rate_limited',
  'duplicate_scan',
]);

export type QrScanStatus = z.infer<typeof QrScanStatusSchema>;

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// Schema for generating QR codes
const generateQrCodeSchemaBase = z.object({
  schoolId: z.string().uuid('Invalid school ID format'),
  codeType: QrCodeTypeSchema,
  classId: z.string().uuid('Invalid class ID format').optional(),
  studentId: z.string().uuid('Invalid student ID format').optional(),
  campusId: z.string().uuid('Invalid campus ID format').optional(),
});

// Refine: class_specific requires classId
export const generateQrCodeSchemaRefined = generateQrCodeSchemaBase.refine(
  (data) => {
    if (data.codeType === 'class_specific') {
      return !!data.classId;
    }
    return true;
  },
  {
    message: 'classId is required when codeType is class_specific',
    path: ['classId'],
  }
);

// Refine: student_card requires studentId
export const generateQrCodeSchemaRefined2 = generateQrCodeSchemaRefined.refine(
  (data) => {
    if (data.codeType === 'student_card') {
      return !!data.studentId;
    }
    return true;
  },
  {
    message: 'studentId is required when codeType is student_card',
    path: ['studentId'],
  }
);

export const generateQrCodeSchema = generateQrCodeSchemaRefined2;

export type GenerateQrCodeInput = z.infer<typeof generateQrCodeSchemaRefined2>;

// Schema for validating QR scans
export const validateQrScanSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  signature: z.string().min(1, 'Signature is required'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  wifiSsid: z.string().optional(),
  deviceInfo: z
    .object({
      deviceId: z.string().optional(),
      platform: z.string(),
      appVersion: z.string(),
    })
    .optional(),
});

export type ValidateQrScanInput = z.infer<typeof validateQrScanSchema>;

// ============================================================================
// DATABASE SCHEMAS
// ============================================================================

// Schema for qr_attendance_codes table
export const qrAttendanceCodeSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  code_type: QrCodeTypeSchema,
  class_id: z.string().uuid().nullable(),
  student_id: z.string().uuid().nullable(),
  campus_id: z.string().uuid().nullable(),
  qr_token: z.string(),
  signature: z.string(),
  generated_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  is_active: z.boolean(),
  rotation_interval_minutes: z.number().int().positive(),
  metadata: z.record(z.any()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type QrAttendanceCode = z.infer<typeof qrAttendanceCodeSchema>;

// Schema for qr_scan_logs table
export const qrScanLogSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  qr_code_id: z.string().uuid().nullable(),
  student_id: z.string().uuid(),
  attendance_record_id: z.string().uuid().nullable(),
  scan_status: QrScanStatusSchema,
  scanned_at: z.string().datetime(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  device_info: z.record(z.any()).nullable(),
  error_message: z.string().nullable(),
  metadata: z.record(z.any()),
  created_at: z.string().datetime(),
});

export type QrScanLog = z.infer<typeof qrScanLogSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// Generate QR Code Response
export const generateQrCodeResponseSchema = z.object({
  qrCodeId: z.string().uuid(),
  qrData: z.string(), // URL to encode in QR
  expiresAt: z.string().datetime(),
  rotationIntervalMinutes: z.number().int().positive(),
});

export type GenerateQrCodeResponse = z.infer<typeof generateQrCodeResponseSchema>;

// Validate QR Scan Success Response
export const validateQrScanSuccessResponseSchema = z.object({
  success: z.literal(true),
  attendanceRecordId: z.string().uuid(),
  message: z.string(),
});

// Validate QR Scan Error Response
export const validateQrScanErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.enum([
    'expired_qr',
    'invalid_signature',
    'wrong_class',
    'wrong_time',
    'out_of_range',
    'rate_limited',
    'duplicate_scan',
  ]),
  message: z.string(),
});

export const validateQrScanResponseSchema = z.discriminatedUnion('success', [
  validateQrScanSuccessResponseSchema,
  validateQrScanErrorResponseSchema,
]);

export type ValidateQrScanResponse = z.infer<typeof validateQrScanResponseSchema>;

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

// Filter schema for querying scan logs
export const qrScanLogsFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  classId: z.string().uuid().optional(),
  status: QrScanStatusSchema.optional(),
  studentId: z.string().uuid().optional(),
});

export type QrScanLogsFilter = z.infer<typeof qrScanLogsFilterSchema>;

// ============================================================================
// SCHOOL SETTINGS SCHEMA
// ============================================================================

// QR Attendance configuration in school.settings
export const qrAttendanceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  qrValidityMinutes: z.number().int().min(5).max(60).default(10),
  qrRotationMinutes: z.number().int().min(5).max(60).default(10),
  enableAntiFraud: z.boolean().default(true),
  requireGpsValidation: z.boolean().default(true),
  maxScansPerSession: z.number().int().min(1).max(5).default(1),
});

export type QrAttendanceConfig = z.infer<typeof qrAttendanceConfigSchema>;
