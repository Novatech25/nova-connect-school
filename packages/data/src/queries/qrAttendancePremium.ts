import { getSupabaseClient } from '../client'
import type {
  GenerateClassQrPremium,
  GenerateClassQrResponse,
  ActiveClassQrResponse,
  QrClassCode,
  QrScanDeviceFingerprint,
  QrScanAnomaly,
  QrRotationHistory,
  AnomaliesListResponse,
  DeviceFingerprintsResponse,
} from '@my-sandbox/core/schemas/qrAttendancePremium'

// ============================================================================
// QR CODE MANAGEMENT
// ============================================================================

/**
 * Generate a class QR code (premium)
 */
export async function generateClassQrPremium(
  params: GenerateClassQrPremium
): Promise<GenerateClassQrResponse> {
  const { data, error } = await getSupabaseClient().functions.invoke<GenerateClassQrResponse>(
    'generate-class-qr-premium',
    {
      body: params,
    }
  )

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Failed to generate QR code')

  return data
}

/**
 * Get the active QR code for a class
 */
export async function getActiveClassQr(classId: string): Promise<ActiveClassQrResponse | null> {
  const { data, error } = await getSupabaseClient()
    .from('qr_class_codes')
    .select('*')
    .eq('class_id', classId)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const qrData = Buffer.from(
    JSON.stringify({ token: data.qr_token, sig: data.signature })
  ).toString('base64')

  const timeRemaining = Math.floor(
    (new Date(data.expires_at).getTime() - Date.now()) / 1000
  )

  return {
    id: data.id,
    qr_token: data.qr_token,
    signature: data.signature,
    expires_at: data.expires_at,
    rotation_interval_seconds: data.rotation_interval_seconds,
    generation_count: data.generation_count,
    qrData,
    timeRemaining,
  }
}

/**
 * Get QR code history for a class
 */
export async function getClassQrHistory(
  classId: string,
  limit = 10
): Promise<QrClassCode[]> {
  const { data, error } = await getSupabaseClient()
    .from('qr_class_codes')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Manually rotate a QR code
 */
export async function manualRotateQr(qrCodeId: string, reason: 'manual' | 'security_breach') {
  const { data, error } = await getSupabaseClient().functions.invoke('rotate-class-qr-codes', {
    body: { forceRotateQrCodeId: qrCodeId, reason },
  })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Deactivate a QR code
 */
export async function deactivateClassQr(qrCodeId: string) {
  const { error } = await getSupabaseClient()
    .from('qr_class_codes')
    .update({ is_active: false })
    .eq('id', qrCodeId)

  if (error) throw new Error(error.message)
}

/**
 * Get QR rotation history
 */
export async function getQrRotationHistory(
  qrCodeId?: string,
  classId?: string,
  limit = 20
): Promise<QrRotationHistory[]> {
  let query = getSupabaseClient()
    .from('qr_rotation_history')
    .select('*')
    .order('rotated_at', { ascending: false })
    .limit(limit)

  if (qrCodeId) {
    query = query.eq('qr_code_id', qrCodeId)
  } else if (classId) {
    // Get QR code IDs for this class first
    const { data: qrCodes } = await getSupabaseClient()
      .from('qr_class_codes')
      .select('id')
      .eq('class_id', classId)

    if (qrCodes) {
      const qrCodeIds = qrCodes.map(qr => qr.id)
      query = query.in('qr_code_id', qrCodeIds)
    }
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data || []
}

// ============================================================================
// DEVICE FINGERPRINTS
// ============================================================================

/**
 * Get device fingerprints for a student
 */
export async function getDeviceFingerprints(
  studentId: string
): Promise<QrScanDeviceFingerprint[]> {
  const { data, error } = await getSupabaseClient()
    .from('qr_scan_device_fingerprints')
    .select('*')
    .eq('student_id', studentId)
    .order('last_seen_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Get all device fingerprints for a school
 */
export async function getSchoolDeviceFingerprints(
  schoolId: string,
  suspiciousOnly = false
): Promise<DeviceFingerprintsResponse> {
  let query = getSupabaseClient()
    .from('qr_scan_device_fingerprints')
    .select('*', { count: 'exact' })
    .eq('school_id', schoolId)
    .order('last_seen_at', { ascending: false })

  if (suspiciousOnly) {
    query = query.eq('is_suspicious', true)
  }

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  return {
    fingerprints: data || [],
    total: count || 0,
  }
}

/**
 * Block a device
 */
export async function blockDevice(fingerprintId: string, reason: string) {
  const { error } = await getSupabaseClient()
    .from('qr_scan_device_fingerprints')
    .update({
      is_suspicious: true,
      blocked_at: new Date().toISOString(),
      blocked_reason: reason,
    })
    .eq('id', fingerprintId)

  if (error) throw new Error(error.message)
}

/**
 * Unblock a device
 */
export async function unblockDevice(fingerprintId: string) {
  const { error } = await getSupabaseClient()
    .from('qr_scan_device_fingerprints')
    .update({
      is_suspicious: false,
      blocked_at: null,
      blocked_reason: null,
    })
    .eq('id', fingerprintId)

  if (error) throw new Error(error.message)
}

// ============================================================================
// ANOMALIES
// ============================================================================

/**
 * Get anomalies for a school
 */
export async function getAnomalies(
  schoolId: string,
  filters?: {
    anomalyType?: string
    severity?: string
    studentId?: string
    status?: 'resolved' | 'unresolved'
    page?: number
    pageSize?: number
  }
): Promise<AnomaliesListResponse> {
  const page = filters?.page || 1
  const pageSize = filters?.pageSize || 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = getSupabaseClient()
    .from('qr_scan_anomalies')
    .select('*', { count: 'exact' })
    .eq('school_id', schoolId)
    .order('detected_at', { ascending: false })

  if (filters?.anomalyType) {
    query = query.eq('anomaly_type', filters.anomalyType)
  }

  if (filters?.severity) {
    query = query.eq('severity', filters.severity)
  }

  if (filters?.studentId) {
    query = query.eq('student_id', filters.studentId)
  }

  if (filters?.status === 'resolved') {
    query = query.not('resolution', 'is', null)
  } else if (filters?.status === 'unresolved') {
    query = query.is('resolution', null)
  }

  const { data, error, count } = await query.range(from, to)

  if (error) throw new Error(error.message)

  return {
    anomalies: data || [],
    total: count || 0,
    page,
    pageSize,
  }
}

/**
 * Get anomaly details
 */
export async function getAnomaly(anomalyId: string): Promise<QrScanAnomaly | null> {
  const { data, error } = await getSupabaseClient()
    .from('qr_scan_anomalies')
    .select(
      `
      *,
      students (
        id,
        first_name,
        last_name,
        email
      )
    `
    )
    .eq('id', anomalyId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Resolve an anomaly
 */
export async function resolveAnomaly(
  anomalyId: string,
  resolution: string,
  reviewedBy: string
) {
  const { error } = await getSupabaseClient()
    .from('qr_scan_anomalies')
    .update({
      resolution,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', anomalyId)

  if (error) throw new Error(error.message)
}

/**
 * Get anomaly statistics for a school
 */
export async function getAnomalyStatistics(
  schoolId: string,
  startDate?: Date,
  endDate?: Date
) {
  let query = getSupabaseClient()
    .from('qr_scan_anomalies')
    .select('anomaly_type, severity, detected_at')

  if (startDate) {
    query = query.gte('detected_at', startDate.toISOString())
  }

  if (endDate) {
    query = query.lte('detected_at', endDate.toISOString())
  }

  const { data, error } = await query.eq('school_id', schoolId)

  if (error) throw new Error(error.message)

  // Calculate statistics
  const total = data?.length || 0
  const byType = data?.reduce((acc, curr) => {
    acc[curr.anomaly_type] = (acc[curr.anomaly_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const bySeverity = data?.reduce((acc, curr) => {
    acc[curr.severity] = (acc[curr.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const resolved = data?.filter(a => a.resolution !== null).length || 0
  const unresolved = total - resolved

  return {
    total,
    byType,
    bySeverity,
    resolved,
    unresolved,
  }
}

// ============================================================================
// SCHOOL SETTINGS
// ============================================================================

/**
 * Get premium QR settings for a school
 */
export async function getPremiumQrSettings(schoolId: string) {
  const { data, error } = await getSupabaseClient()
    .from('schools')
    .select('settings')
    .eq('id', schoolId)
    .single()

  if (error) throw new Error(error.message)

  return data?.settings?.qrAttendancePremium || null
}

/**
 * Update premium QR settings for a school
 */
export async function updatePremiumQrSettings(
  schoolId: string,
  settings: Record<string, any>
) {
  // First, fetch current settings to preserve other configuration
  const { data: school } = await getSupabaseClient()
    .from('schools')
    .select('settings')
    .eq('id', schoolId)
    .single()

  if (school) {
    // Merge with existing settings, only updating the qrAttendancePremium subtree
    const { error } = await getSupabaseClient()
      .from('schools')
      .update({
        settings: {
          ...school.settings, // Preserve existing settings
          qrAttendancePremium: settings, // Update only the premium QR subtree
        },
      })
      .eq('id', schoolId)

    if (error) throw new Error(error.message)
  }
}
