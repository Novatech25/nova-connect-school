// Edge Function: Validate QR Scan
// Description: Validates QR code scans with security checks and creates attendance records

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { determineRecordStatus, type FusionConfig } from '../_shared/attendanceFusion.ts';

// Types for request/response
interface ValidateQrRequest {
  token: string;
  signature: string;
  latitude?: number;
  longitude?: number;
  wifiSsid?: string;
  deviceInfo?: {
    deviceId?: string;
    platform: string;
    appVersion: string;
    model?: string;
    osVersion?: string;
    screenResolution?: string;
    timezone?: string;
  };
}

interface ValidateQrSuccessResponse {
  success: true;
  attendanceRecordId: string;
  message: string;
}

interface ValidateQrErrorResponse {
  success: false;
  error:
    | 'expired_qr'
    | 'invalid_signature'
    | 'wrong_class'
    | 'wrong_time'
    | 'out_of_range'
    | 'rate_limited'
    | 'duplicate_scan';
  message: string;
}

type ValidateQrResponse = ValidateQrSuccessResponse | ValidateQrErrorResponse;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const qrSigningSecret = Deno.env.get('QR_SIGNING_SECRET')!;

// Verify HMAC-SHA256 signature
async function verifySignature(
  data: string,
  providedSignature: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(qrSigningSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  const computedSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSignature === providedSignature;
}

// Calculate distance between two GPS coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Detect if QR token is from premium class QR
// Premium tokens start with "premium:" prefix to distinguish from standard tokens
// Standard format: schoolId:codeType:classId:timestamp:randomBytes
// Premium format: premium:schoolId:classId:timestamp:nonce:generationCount
function isPremiumClassQrToken(token: string): boolean {
  return token.startsWith('premium:')
}

// Generate device fingerprint hash
function generateDeviceFingerprintHash(deviceInfo: any): string {
  const data = `${deviceInfo.platform}|${deviceInfo.model || 'unknown'}|${deviceInfo.osVersion || 'unknown'}|${deviceInfo.screenResolution || 'unknown'}|${deviceInfo.timezone || 'unknown'}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = crypto.subtle.digestSync('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Process device fingerprint
async function processDeviceFingerprint(
  supabase: any,
  schoolId: string,
  studentId: string,
  deviceInfo: any
): Promise<{ fingerprint: string; isSuspicious: boolean }> {
  const fingerprint = generateDeviceFingerprintHash(deviceInfo);

  // Check if fingerprint exists
  const { data: existing } = await supabase
    .from('qr_scan_device_fingerprints')
    .select('*')
    .eq('device_fingerprint', fingerprint)
    .maybeSingle();

  if (existing) {
    // Update last seen
    await supabase
      .from('qr_scan_device_fingerprints')
      .update({
        last_seen_at: new Date().toISOString(),
        scan_count: existing.scan_count + 1,
      })
      .eq('id', existing.id);

    // Check if student is using multiple devices
    const { data: studentDevices } = await supabase
      .from('qr_scan_device_fingerprints')
      .select('id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId);

    const isSuspicious = studentDevices && studentDevices.length > 2;

    return { fingerprint, isSuspicious };
  } else {
    // Create new fingerprint
    await supabase
      .from('qr_scan_device_fingerprints')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        device_fingerprint: fingerprint,
        device_info: deviceInfo,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        scan_count: 1,
      });

    return { fingerprint, isSuspicious: false };
  }
}

// Detect anomalies
async function detectAnomalies(
  supabase: any,
  schoolId: string,
  studentId: string,
  qrCodeId: string,
  deviceFingerprint: string
): Promise<void> {
  // Check for multiple devices in last 24 hours
  const { data: recentScans } = await supabase
    .from('qr_scan_logs')
    .select('metadata')
    .eq('student_id', studentId)
    .gte('scanned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .eq('scan_status', 'success');

  const uniqueDevices = new Set(
    recentScans?.map((s: any) => s.metadata?.device_fingerprint).filter(Boolean)
  );

  if (uniqueDevices.size > 2) {
    await supabase.from('qr_scan_anomalies').insert({
      school_id: schoolId,
      student_id: studentId,
      qr_code_id: qrCodeId,
      anomaly_type: 'multiple_devices',
      severity: 'high',
      detected_at: new Date().toISOString(),
      metadata: { deviceCount: uniqueDevices.size },
    });
  }

  // Check for rapid scans (< 5 minutes apart)
  const { data: veryRecentScans } = await supabase
    .from('qr_scan_logs')
    .select('scanned_at')
    .eq('student_id', studentId)
    .gte('scanned_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .eq('scan_status', 'success');

  if (veryRecentScans && veryRecentScans.length > 1) {
    await supabase.from('qr_scan_anomalies').insert({
      school_id: schoolId,
      student_id: studentId,
      qr_code_id: qrCodeId,
      anomaly_type: 'rapid_scans',
      severity: 'medium',
      detected_at: new Date().toISOString(),
      metadata: { scanCount: veryRecentScans.length },
    });
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication (student only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // 2. Parse request body
    const {
      token,
      signature,
      latitude,
      longitude,
      wifiSsid,
      deviceInfo,
    }: ValidateQrRequest = await req.json();

    if (!token || !signature) {
      throw new Error('Missing required fields: token, signature');
    }

    // 3. Verify signature HMAC
    // Check if this is a premium QR first (different secret)
    const isPremiumQr = isPremiumClassQrToken(token);
    const qrSecret = isPremiumQr
      ? (Deno.env.get('QR_PREMIUM_SECRET') || 'default-premium-secret')
      : qrSigningSecret;

    async function verifySignatureWithSecret(data: string, providedSignature: string, secret: string): Promise<boolean> {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(data)
      );

      const computedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return computedSignature === providedSignature;
    }

    const isValidSignature = await verifySignatureWithSecret(token, signature, qrSecret);
    if (!isValidSignature) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_signature',
          message: 'Signature QR invalide',
        } as ValidateQrErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 to not expose internal errors
        }
      );
    }

    // 4. Retrieve QR code from database
    let qrCode: any;
    let qrError: any;

    if (isPremiumQr) {
      // Premium QR: retrieve from qr_class_codes
      const result = await supabase
        .from('qr_class_codes')
        .select('*')
        .eq('qr_token', token)
        .single();

      qrCode = result.data;
      qrError = result.error;
    } else {
      // Standard QR: retrieve from qr_attendance_codes
      const result = await supabase
        .from('qr_attendance_codes')
        .select('*')
        .eq('qr_token', token)
        .single();

      qrCode = result.data;
      qrError = result.error;
    }

    if (qrError || !qrCode) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'expired_qr',
          message: 'Code QR introuvable ou expiré',
        } as ValidateQrErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 5. Retrieve student record early (needed for all subsequent qr_scan_logs inserts)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (studentError || !student) {
      throw new Error('Student record not found');
    }

    // 5.5 Premium QR: Device fingerprinting and anomaly detection
    let deviceFingerprint: string | null = null;
    let hasAnomaly = false;

    if (isPremiumQr && deviceInfo) {
      // Process device fingerprint
      const fpResult = await processDeviceFingerprint(
        supabase,
        qrCode.school_id,
        student.id,
        deviceInfo
      );

      deviceFingerprint = fpResult.fingerprint;

      if (fpResult.isSuspicious) {
        hasAnomaly = true;
      }

      // Run anomaly detection
      await detectAnomalies(
        supabase,
        qrCode.school_id,
        student.id,
        qrCode.id,
        deviceFingerprint
      );
    }

    // 6. Check expiration
    const now = new Date();
    const expiresAt = new Date(qrCode.expires_at);
    if (now > expiresAt) {
      // Log failed attempt with student.id (not user.id)
      await supabase.from('qr_scan_logs').insert({
        school_id: qrCode.school_id,
        qr_code_id: qrCode.id,
        student_id: student.id,
        scan_status: 'expired_qr',
        scanned_at: now.toISOString(),
        latitude,
        longitude,
        device_info: deviceInfo,
        error_message: 'QR code expired',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'expired_qr',
          message: 'Ce code QR a expiré',
        } as ValidateQrErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 7. Check if QR is active
    if (!qrCode.is_active) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'expired_qr',
          message: 'Ce code QR a été désactivé',
        } as ValidateQrErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 8. Retrieve school configuration
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('settings, primary_campus_id, timezone')
      .eq('id', qrCode.school_id)
      .single();

    if (schoolError || !school) {
      throw new Error('School not found');
    }

    const qrConfig = (school.settings as any)?.qrAttendance || {};
    const gpsConfig = (school.settings as any)?.gps || {};

    // 9. GPS validation (if required) - Reject if GPS is required but not provided
    if (qrConfig.requireGpsValidation) {
      if (!latitude || !longitude) {
        // Log failed attempt
        await supabase.from('qr_scan_logs').insert({
          school_id: qrCode.school_id,
          qr_code_id: qrCode.id,
          student_id: student.id,
          scan_status: 'out_of_range',
          scanned_at: now.toISOString(),
          latitude,
          longitude,
          device_info: deviceInfo,
          error_message: 'GPS coordinates required but not provided',
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'out_of_range',
            message: 'La localisation GPS est requise pour valider votre présence',
          } as ValidateQrErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      const campusId = qrCode.campus_id || school.primary_campus_id;
      if (campusId) {
        const { data: campus } = await supabase
          .from('campuses')
          .select('latitude, longitude, radius_meters')
          .eq('id', campusId)
          .single();

        if (campus) {
          const distance = calculateDistance(
            latitude,
            longitude,
            campus.latitude,
            campus.longitude
          );

          if (distance > campus.radius_meters) {
            // Log failed attempt
            await supabase.from('qr_scan_logs').insert({
              school_id: qrCode.school_id,
              qr_code_id: qrCode.id,
              student_id: student.id,
              scan_status: 'out_of_range',
              scanned_at: now.toISOString(),
              latitude,
              longitude,
              device_info: deviceInfo,
              error_message: `Out of range: ${distance}m from campus`,
            });

            return new Response(
              JSON.stringify({
                success: false,
                error: 'out_of_range',
                message: `Vous êtes trop loin de l'école (${Math.round(
                  distance
                )}m). Rayon autorisé: ${campus.radius_meters}m`,
              } as ValidateQrErrorResponse),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            );
          }
        }
      }

      // 10. Wi-Fi SSID validation (if required) - Reject if Wi-Fi is required but not provided or mismatched
      if (gpsConfig.requireWifiLan) {
        if (!wifiSsid) {
          // Log failed attempt
          await supabase.from('qr_scan_logs').insert({
            school_id: qrCode.school_id,
            qr_code_id: qrCode.id,
            student_id: student.id,
            scan_status: 'out_of_range',
            scanned_at: now.toISOString(),
            latitude,
            longitude,
            device_info: deviceInfo,
            error_message: 'Wi-Fi SSID required but not provided',
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: 'out_of_range',
              message: 'Veuillez vous connecter au Wi-Fi de l\'école',
            } as ValidateQrErrorResponse),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }

        if (gpsConfig.wifiSsid && wifiSsid !== gpsConfig.wifiSsid) {
          await supabase.from('qr_scan_logs').insert({
            school_id: qrCode.school_id,
            qr_code_id: qrCode.id,
            student_id: student.id,
            scan_status: 'out_of_range',
            scanned_at: now.toISOString(),
            latitude,
            longitude,
            device_info: deviceInfo,
            error_message: `Wrong Wi-Fi network: ${wifiSsid} != ${gpsConfig.wifiSsid}`,
          });

          return new Response(
            JSON.stringify({
              success: false,
              error: 'out_of_range',
              message: 'Veuillez vous connecter au Wi-Fi de l\'école',
            } as ValidateQrErrorResponse),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }
      }
    }

    // 11. Class validation (if class-specific QR or premium class QR)
    let plannedSessionId: string | null = null;
    // Standard QR: check code_type === 'class_specific'
    // Premium QR: check isPremiumQr && class_id exists
    const isClassQr = (qrCode.code_type === 'class_specific' && qrCode.class_id) || (isPremiumQr && qrCode.class_id);

    if (isClassQr) {
      // Check if student is enrolled in this class
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('student_id', student.id)
        .eq('class_id', qrCode.class_id)
        .single();

      if (!enrollment) {
        await supabase.from('qr_scan_logs').insert({
          school_id: qrCode.school_id,
          qr_code_id: qrCode.id,
          student_id: student.id,
          scan_status: 'wrong_class',
          scanned_at: now.toISOString(),
          latitude,
          longitude,
          device_info: deviceInfo,
          error_message: 'Not enrolled in this class',
          metadata: isPremiumQr ? {
            is_premium: true,
            device_fingerprint: deviceFingerprint,
          } : undefined,
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'wrong_class',
            message: 'Vous n\'êtes pas inscrit dans cette classe',
          } as ValidateQrErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Check if there's a planned session now
      // Get school's current date in their timezone
      const schoolTimezone = school.timezone || 'Europe/Paris';
      const schoolDate = new Date().toLocaleDateString('en-CA', { timeZone: schoolTimezone }); // YYYY-MM-DD format
      const currentTime = new Date().toLocaleTimeString('en-GB', {
        timeZone: schoolTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }); // HH:MM:SS format

      const { data: currentSession } = await supabase
        .from('planned_sessions')
        .select('*')
        .eq('class_id', qrCode.class_id)
        .eq('session_date', schoolDate)
        .lte('start_time', currentTime)
        .gte('end_time', currentTime)
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!currentSession) {
        await supabase.from('qr_scan_logs').insert({
          school_id: qrCode.school_id,
          qr_code_id: qrCode.id,
          student_id: student.id,
          scan_status: 'wrong_time',
          scanned_at: now.toISOString(),
          latitude,
          longitude,
          device_info: deviceInfo,
          error_message: `No class session at this time (school date: ${schoolDate}, time: ${currentTime})`,
          metadata: isPremiumQr ? {
            is_premium: true,
            device_fingerprint: deviceFingerprint,
          } : undefined,
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'wrong_time',
            message: 'Aucun cours en cours pour cette classe',
          } as ValidateQrErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      plannedSessionId = currentSession.id;
    }

    // 12. Rate limiting check
    const maxScansPerSession = qrConfig.maxScansPerSession || 1;
    const rateLimitWindow = 15 * 60 * 1000; // 15 minutes

    const { data: recentScans } = await supabase
      .from('qr_scan_logs')
      .select('id')
      .eq('student_id', student.id)
      .gte('scanned_at', new Date(Date.now() - rateLimitWindow).toISOString())
      .eq('scan_status', 'success');

    if (recentScans && recentScans.length >= maxScansPerSession) {
      await supabase.from('qr_scan_logs').insert({
        school_id: qrCode.school_id,
        qr_code_id: qrCode.id,
        student_id: student.id,
        scan_status: 'rate_limited',
        scanned_at: now.toISOString(),
        latitude,
        longitude,
        device_info: deviceInfo,
        error_message: 'Rate limit exceeded',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'rate_limited',
          message: 'Vous avez déjà scanné le QR Code récemment. Veuillez patienter.',
        } as ValidateQrErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 13. Check for existing attendance record (any source)
    let attendanceRecordId: string;
    let existingRecord = null;
    let attendanceSessionId = null;
    let sessionStartTime = null;

    // Retrieve school fusion settings
    const fusionConfig: FusionConfig = (school.settings as any)?.attendanceFusion || {
      enabled: true,
      strategy: 'teacher_priority',
      qrTimeWindowMinutes: 15,
      autoMerge: true,
      notifyOnConflict: true,
    };

    // Find the attendance session
    if (plannedSessionId) {
      const { data: session } = await supabase
        .from('attendance_sessions')
        .select('id, planned_session_id, started_at')
        .eq('planned_session_id', plannedSessionId)
        .maybeSingle();

      if (session) {
        attendanceSessionId = session.id;
        sessionStartTime = session.started_at;

        // Check for existing record for this student in this session
        const { data: existing } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('attendance_session_id', session.id)
          .eq('student_id', student.id)
          .maybeSingle();

        existingRecord = existing;
      }
    }

    // Apply fusion logic if record exists and fusion is enabled
    if (existingRecord && fusionConfig.enabled) {
      const fusionResult = determineRecordStatus(
        {
          status: existingRecord.status,
          source: existingRecord.source,
          markedAt: existingRecord.marked_at,
          recordStatus: existingRecord.record_status,
        },
        {
          status: 'present',
          source: 'qr_scan',
          markedAt: now,
        },
        fusionConfig.strategy,
        fusionConfig.qrTimeWindowMinutes,
        sessionStartTime || undefined
      );

      if (!fusionResult.shouldMerge) {
        // Log as duplicate but don't create/update record
        await supabase.from('qr_scan_logs').insert({
          school_id: qrCode.school_id,
          qr_code_id: qrCode.id,
          student_id: student.id,
          scan_status: 'duplicate_scan',
          scanned_at: now.toISOString(),
          latitude,
          longitude,
          device_info: deviceInfo,
          error_message: fusionResult.reason || 'Attendance already recorded',
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'duplicate_scan',
            message: fusionResult.reason === 'Teacher already marked attendance, QR scan ignored'
              ? 'Votre présence a déjà été enregistrée par le professeur'
              : 'Vous avez déjà enregistré votre présence pour ce cours',
          } as ValidateQrErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Update existing record with fusion
      const { data: updatedRecord } = await supabase
        .from('attendance_records')
        .update({
          status: fusionResult.status,
          record_status: fusionResult.recordStatus,
          original_source: fusionResult.originalSource || existingRecord.source,
          merged_at: now.toISOString(),
          merged_by: student.user_id,
          metadata: {
            ...(existingRecord.metadata || {}),
            qrScanMerged: true,
            qrCodeId: qrCode.id,
            latitude,
            longitude,
          },
        })
        .eq('id', existingRecord.id)
        .select('id')
        .single();

      attendanceRecordId = updatedRecord!.id;

      // Log successful QR scan with fusion
      await supabase.from('qr_scan_logs').insert({
        school_id: qrCode.school_id,
        qr_code_id: qrCode.id,
        student_id: student.id,
        scan_status: 'success',
        scanned_at: now.toISOString(),
        latitude,
        longitude,
        device_info: deviceInfo,
        attendance_record_id: attendanceRecordId,
        metadata: {
          fusionApplied: true,
          fusionResult: fusionResult.recordStatus,
        },
      });

      // Send conflict notification if enabled and this is an override
      if (fusionConfig.notifyOnConflict && fusionResult.recordStatus === 'overridden') {
        // Get session to find teacher
        const { data: sessionWithTeacher } = await supabase
          .from('attendance_sessions')
          .select('teacher_id')
          .eq('id', attendanceSessionId)
          .single();

        if (sessionWithTeacher?.teacher_id) {
          await supabase.from('notifications').insert({
            user_id: sessionWithTeacher.teacher_id,
            type: 'attendance_conflict',
            title: 'Conflit de présence détecté',
            body: `L'élève ${student.first_name} ${student.last_name} a scanné le QR après votre marquage manuel.`,
            data: {
              attendanceRecordId,
              studentId: student.id,
              sessionId: attendanceSessionId,
              conflictType: 'qr_after_manual',
            },
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          attendanceRecordId,
          message: 'Présence enregistrée avec succès',
        } as ValidateQrSuccessResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 14. Create attendance record if no existing record or fusion disabled
    if (attendanceSessionId) {
      // Create new attendance record
      const { data: record } = await supabase
        .from('attendance_records')
        .insert({
          attendance_session_id: attendanceSessionId,
          student_id: student.id,
          status: 'present',
          source: 'qr_scan',
          record_status: 'auto',
          marked_by: student.user_id,
          marked_at: now.toISOString(),
          metadata: {
            latitude,
            longitude,
            scannedVia: 'qr_code',
            qrCodeId: qrCode.id,
          },
        })
        .select('id')
        .single();

      attendanceRecordId = record!.id;
    } else {
      // No session found - return error
      await supabase.from('qr_scan_logs').insert({
        school_id: qrCode.school_id,
        qr_code_id: qrCode.id,
        student_id: student.id,
        scan_status: 'wrong_class',
        scanned_at: now.toISOString(),
        latitude,
        longitude,
        device_info: deviceInfo,
        error_message: 'No attendance session found for this QR code',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'wrong_class',
          message: 'Aucune session de présence trouvée pour ce code QR',
        } as ValidateQrErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 15. Log successful scan
    await supabase.from('qr_scan_logs').insert({
      school_id: qrCode.school_id,
      qr_code_id: qrCode.id,
      student_id: student.id,
      attendance_record_id: attendanceRecordId || null,
      scan_status: 'success',
      scanned_at: now.toISOString(),
      latitude,
      longitude,
      device_info: deviceInfo,
      metadata: isPremiumQr ? {
        is_premium: true,
        device_fingerprint: deviceFingerprint,
        has_anomaly: hasAnomaly,
      } : undefined,
    });

    // 16. Audit log
    await supabase.from('audit_logs').insert({
      school_id: qrCode.school_id,
      user_id: user.id,
      action: 'qr_scan_attendance',
      resource_type: 'attendance_record',
      resource_id: attendanceRecordId,
      metadata: {
        qrCodeId: qrCode.id,
        codeType: qrCode.code_type || 'class_premium',
        isPremiumQr,
        latitude,
        longitude,
        deviceFingerprint,
      },
    });

    // 17. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        attendanceRecordId,
        message: 'Présence enregistrée avec succès',
      } as ValidateQrSuccessResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in validate-qr-scan:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'expired_qr',
        message: error.message || 'Une erreur est survenue',
      } as ValidateQrErrorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
