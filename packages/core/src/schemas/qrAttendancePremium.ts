import { z } from 'zod'

// ============================================================================
// ENUMS
// ============================================================================

export const QrAnomalyTypeEnum = z.enum([
  'multiple_devices',
  'impossible_location',
  'rapid_scans',
  'signature_mismatch',
  'expired_reuse',
  'device_binding_violation',
])

export const QrAnomalySeverityEnum = z.enum(['low', 'medium', 'high', 'critical'])

export const QrRotationReasonEnum = z.enum(['scheduled', 'manual', 'security_breach', 'expiration'])

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Schema for generating a class QR code (premium)
 */
export const generateClassQrPremiumSchema = z.object({
  schoolId: z.string().uuid('Invalid school ID'),
  classId: z.string().uuid('Invalid class ID'),
  campusId: z.string().uuid('Invalid campus ID').optional(),
  rotationIntervalSeconds: z
    .number()
    .int('Rotation interval must be an integer')
    .min(30, 'Rotation interval must be at least 30 seconds')
    .max(600, 'Rotation interval must not exceed 600 seconds (10 minutes)'),
})

/**
 * Schema for device info in premium QR scans
 */
export const deviceInfoPremiumSchema = z.object({
  deviceId: z.string().optional(),
  platform: z.string().min(1, 'Platform is required'),
  appVersion: z.string().min(1, 'App version is required'),
  model: z.string().optional(),
  osVersion: z.string().optional(),
  screenResolution: z.string().optional(),
  timezone: z.string().optional(),
})

/**
 * Schema for validating QR scan (premium)
 */
export const validateQrScanPremiumSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  signature: z.string().min(1, 'Signature is required'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  wifiSsid: z.string().optional(),
  deviceInfo: deviceInfoPremiumSchema.optional(),
})

/**
 * Schema for anomaly resolution
 */
export const resolveAnomalySchema = z.object({
  anomalyId: z.string().uuid('Invalid anomaly ID'),
  resolution: z.string().min(1, 'Resolution is required'),
  notifyStudent: z.boolean().default(false),
})

/**
 * Schema for blocking a device
 */
export const blockDeviceSchema = z.object({
  fingerprintId: z.string().uuid('Invalid fingerprint ID'),
  reason: z.string().min(1, 'Reason is required'),
})

/**
 * Schema for manual QR rotation
 */
export const manualRotateQrSchema = z.object({
  qrCodeId: z.string().uuid('Invalid QR code ID'),
  reason: z.enum(['manual', 'security_breach']),
})

// ============================================================================
// DATABASE SCHEMAS (matches tables)
// ============================================================================

/**
 * Schema for qr_class_codes table
 */
export const qrClassCodeSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  class_id: z.string().uuid(),
  campus_id: z.string().uuid().nullable(),
  qr_token: z.string(),
  signature: z.string(),
  generated_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  rotation_interval_seconds: z.number().int().min(30).max(600),
  is_active: z.boolean(),
  generation_count: z.number().int().min(1),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

/**
 * Schema for qr_scan_device_fingerprints table
 */
export const qrScanDeviceFingerprintSchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  student_id: z.string().uuid(),
  device_fingerprint: z.string(),
  device_info: z.record(z.any()).optional(),
  first_seen_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  scan_count: z.number().int().min(1),
  is_suspicious: z.boolean(),
  blocked_at: z.string().datetime().nullable(),
  blocked_reason: z.string().nullable(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

/**
 * Schema for qr_scan_anomalies table
 */
export const qrScanAnomalySchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  student_id: z.string().uuid().nullable(),
  qr_code_id: z.string().uuid().nullable(),
  anomaly_type: QrAnomalyTypeEnum,
  severity: QrAnomalySeverityEnum,
  detected_at: z.string().datetime(),
  device_info: z.record(z.any()).optional(),
  location_data: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().datetime().nullable(),
  resolution: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

/**
 * Schema for qr_rotation_history table
 */
export const qrRotationHistorySchema = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  qr_code_id: z.string().uuid(),
  old_token: z.string(),
  new_token: z.string(),
  rotated_at: z.string().datetime(),
  rotation_reason: QrRotationReasonEnum,
  rotated_by: z.string().uuid().nullable(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
})

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Schema for premium QR configuration in school settings
 */
export const premiumQrConfigSchema = z.object({
  enabled: z.boolean().default(false),
  classQrEnabled: z.boolean().default(false),
  cardQrEnabled: z.boolean().default(false),
  rotationIntervalSeconds: z
    .number()
    .int()
    .min(30)
    .max(600)
    .default(60),
  deviceBindingEnabled: z.boolean().default(false),
  anomalyDetectionEnabled: z.boolean().default(true),
  maxDevicesPerStudent: z.number().int().min(1).max(5).default(2),
  rotationMode: z.enum(['automatic', 'manual']).default('automatic'),
})

/**
 * Schema for school settings with premium QR configuration
 */
export const schoolPremiumQrSettingsSchema = z.object({
  qrAttendancePremium: premiumQrConfigSchema.optional(),
})

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Schema for generate class QR response
 */
export const generateClassQrResponseSchema = z.object({
  qrCodeId: z.string().uuid(),
  qrData: z.string(), // base64 encoded token + signature
  expiresAt: z.string().datetime(),
  rotationIntervalSeconds: z.number().int(),
  classId: z.string().uuid(),
  generatedAt: z.string().datetime(),
})

/**
 * Schema for QR rotation response
 */
export const qrRotationResponseSchema = z.object({
  rotatedCount: z.number().int(),
  rotatedQrCodes: z.array(
    z.object({
      qrCodeId: z.string().uuid(),
      classId: z.string().uuid(),
      oldToken: z.string(),
      newToken: z.string(),
      rotatedAt: z.string().datetime(),
    })
  ),
  errors: z.array(z.string()),
})

/**
 * Schema for active QR code response
 */
export const activeClassQrResponseSchema = qrClassCodeSchema
  .pick({
    id: true,
    qr_token: true,
    signature: true,
    expires_at: true,
    rotation_interval_seconds: true,
    generation_count: true,
  })
  .extend({
    qrData: z.string(), // base64 encoded
    timeRemaining: z.number().int(), // seconds until expiration
  })

/**
 * Schema for anomalies list response
 */
export const anomaliesListResponseSchema = z.object({
  anomalies: z.array(
    qrScanAnomalySchema.pick({
      id: true,
      anomaly_type: true,
      severity: true,
      detected_at: true,
      student_id: true,
      resolution: true,
    })
  ),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
})

/**
 * Schema for device fingerprints list response
 */
export const deviceFingerprintsResponseSchema = z.object({
  fingerprints: z.array(
    qrScanDeviceFingerprintSchema.pick({
      id: true,
      device_fingerprint: true,
      device_info: true,
      first_seen_at: true,
      last_seen_at: true,
      scan_count: true,
      is_suspicious: true,
      blocked_at: true,
    })
  ),
  total: z.number().int(),
})

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type GenerateClassQrPremium = z.infer<typeof generateClassQrPremiumSchema>
export type DeviceInfoPremium = z.infer<typeof deviceInfoPremiumSchema>
export type ValidateQrScanPremium = z.infer<typeof validateQrScanPremiumSchema>
export type ResolveAnomaly = z.infer<typeof resolveAnomalySchema>
export type BlockDevice = z.infer<typeof blockDeviceSchema>
export type ManualRotateQr = z.infer<typeof manualRotateQrSchema>

export type QrClassCode = z.infer<typeof qrClassCodeSchema>
export type QrScanDeviceFingerprint = z.infer<typeof qrScanDeviceFingerprintSchema>
export type QrScanAnomaly = z.infer<typeof qrScanAnomalySchema>
export type QrRotationHistory = z.infer<typeof qrRotationHistorySchema>

export type PremiumQrConfig = z.infer<typeof premiumQrConfigSchema>

export type GenerateClassQrResponse = z.infer<typeof generateClassQrResponseSchema>
export type QrRotationResponse = z.infer<typeof qrRotationResponseSchema>
export type ActiveClassQrResponse = z.infer<typeof activeClassQrResponseSchema>
export type AnomaliesListResponse = z.infer<typeof anomaliesListResponseSchema>
export type DeviceFingerprintsResponse = z.infer<typeof deviceFingerprintsResponseSchema>
