// Edge Function: Validate Lesson Log Location
// Description: Validates teacher location when submitting lesson logs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Types for request/response
interface ValidateLessonLogLocationRequest {
  lessonLogId: string;
  latitude: number;
  longitude: number;
  wifiSsid?: string;
  deviceInfo?: {
    deviceId?: string;
    platform?: string;
    appVersion?: string;
  };
}

interface ValidateLessonLogLocationSuccessResponse {
  success: true;
  message: string;
  distance?: number;
  withinRange: true;
  wifiValid?: boolean;
}

interface ValidateLessonLogLocationErrorResponse {
  success: false;
  error: 'out_of_range' | 'wrong_wifi' | 'invalid_location' | 'not_authorized' | 'lesson_log_not_found';
  message: string;
  distance?: number;
  withinRange?: false;
  wifiValid?: boolean;
}

type ValidateLessonLogLocationResponse =
  | ValidateLessonLogLocationSuccessResponse
  | ValidateLessonLogLocationErrorResponse;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

// Validate GPS coordinates
function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication (teacher only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'not_authorized',
          message: 'Missing authorization header',
        } as ValidateLessonLogLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'not_authorized',
          message: 'Invalid authentication',
        } as ValidateLessonLogLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // 2. Verify user is a teacher
    const { data: teacherRole, error: roleError } = await supabase
      .from('user_school_roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'teacher')
      .maybeSingle();

    if (roleError || !teacherRole) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'not_authorized',
          message: 'Unauthorized: Only teachers can submit lesson logs',
        } as ValidateLessonLogLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 3. Parse request body
    const {
      lessonLogId,
      latitude,
      longitude,
      wifiSsid,
      deviceInfo,
    }: ValidateLessonLogLocationRequest = await req.json();

    if (!lessonLogId || latitude === undefined || longitude === undefined) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_location',
          message: 'Missing required fields: lessonLogId, latitude, longitude',
        } as ValidateLessonLogLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 4. Validate GPS coordinates
    if (!isValidCoordinates(latitude, longitude)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_location',
          message: 'Invalid GPS coordinates',
        } as ValidateLessonLogLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 5. Retrieve lesson log and verify ownership
    const { data: lessonLog, error: lessonLogError } = await supabase
      .from('lesson_logs')
      .select('*, schools!inner(settings, primary_campus_id, timezone)')
      .eq('id', lessonLogId)
      .single();

    if (lessonLogError || !lessonLog) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'lesson_log_not_found',
          message: 'Lesson log not found',
        } as ValidateLessonLogLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Verify teacher owns this lesson log
    if (lessonLog.teacher_id !== user.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'not_authorized',
          message: 'Unauthorized: You do not own this lesson log',
        } as ValidateLessonLogLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 6. Retrieve school GPS configuration
    const school = lessonLog.schools as any;
    const gpsConfig = (school.settings as any)?.gps || {};
    const lessonLogConfig = (school.settings as any)?.lessonLog || {};

    // 7. Check if GPS validation is required
    if (!gpsConfig.requireGpsValidation && !lessonLogConfig.requireValidation) {
      // GPS validation not required, return success
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Location validation not required',
          withinRange: true,
        } as ValidateLessonLogLocationSuccessResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 8. GPS distance validation
    let distance: number | undefined;
    let withinRange = true;

    if (gpsConfig.requireGpsValidation) {
      // Get school or campus GPS coordinates
      const targetLat = gpsConfig.latitude;
      const targetLon = gpsConfig.longitude;
      const radiusMeters = gpsConfig.radiusMeters || 200;

      if (!targetLat || !targetLon) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'invalid_location',
            message: 'School GPS coordinates not configured',
          } as ValidateLessonLogLocationErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Calculate distance
      distance = calculateDistance(latitude, longitude, targetLat, targetLon);
      withinRange = distance <= radiusMeters;

      if (!withinRange) {
        // Audit log for failed validation
        await supabase.from('audit_logs').insert({
          action: 'validate_lesson_log_location',
          resource_type: 'lesson_log',
          resource_id: lessonLogId,
          school_id: lessonLog.school_id,
          user_id: user.id,
          details: {
            success: false,
            reason: 'out_of_range',
            distance: Math.round(distance),
            radius: radiusMeters,
            teacherLocation: { latitude, longitude },
            schoolLocation: { latitude: targetLat, longitude: targetLon },
            deviceInfo,
          },
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'out_of_range',
            message: `Vous êtes trop loin de l'école (${Math.round(
              distance
            )}m). Rayon autorisé: ${radiusMeters}m`,
            distance: Math.round(distance),
            withinRange: false,
          } as ValidateLessonLogLocationErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // 9. Wi-Fi SSID validation (if required)
    let wifiValid = true;

    if (gpsConfig.requireWifiLan && gpsConfig.wifiSsid) {
      if (!wifiSsid) {
        // Audit log for failed validation
        await supabase.from('audit_logs').insert({
          action: 'validate_lesson_log_location',
          resource_type: 'lesson_log',
          resource_id: lessonLogId,
          school_id: lessonLog.school_id,
          user_id: user.id,
          details: {
            success: false,
            reason: 'wifi_required',
            expectedWifi: gpsConfig.wifiSsid,
            deviceInfo,
          },
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'wrong_wifi',
            message: 'Veuillez vous connecter au Wi-Fi de l\'école',
            distance: distance ? Math.round(distance) : undefined,
            withinRange: withinRange || undefined,
            wifiValid: false,
          } as ValidateLessonLogLocationErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      wifiValid = wifiSsid === gpsConfig.wifiSsid;

      if (!wifiValid) {
        // Audit log for failed validation
        await supabase.from('audit_logs').insert({
          action: 'validate_lesson_log_location',
          resource_type: 'lesson_log',
          resource_id: lessonLogId,
          school_id: lessonLog.school_id,
          user_id: user.id,
          details: {
            success: false,
            reason: 'wrong_wifi',
            expectedWifi: gpsConfig.wifiSsid,
            actualWifi: wifiSsid,
            deviceInfo,
          },
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'wrong_wifi',
            message: 'Veuillez vous connecter au Wi-Fi de l\'école',
            distance: distance ? Math.round(distance) : undefined,
            withinRange: withinRange || undefined,
            wifiValid: false,
          } as ValidateLessonLogLocationErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // 10. Update lesson log with validated location
    await supabase
      .from('lesson_logs')
      .update({
        latitude,
        longitude,
        wifi_ssid: wifiSsid || null,
        device_info: deviceInfo || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', lessonLogId);

    // 11. Audit log for successful validation
    await supabase.from('audit_logs').insert({
      action: 'validate_lesson_log_location',
      resource_type: 'lesson_log',
      resource_id: lessonLogId,
      school_id: lessonLog.school_id,
      user_id: user.id,
      details: {
        success: true,
        distance: distance ? Math.round(distance) : null,
        withinRange,
        wifiValid,
        teacherLocation: { latitude, longitude },
        deviceInfo,
      },
    });

    // 12. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: withinRange
          ? 'Localisation validée avec succès'
          : 'Localisation validée',
        distance: distance ? Math.round(distance) : undefined,
        withinRange: true,
        wifiValid,
      } as ValidateLessonLogLocationSuccessResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in validate-lesson-log-location:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'invalid_location',
        message: error.message || 'Une erreur est survenue',
      } as ValidateLessonLogLocationErrorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
