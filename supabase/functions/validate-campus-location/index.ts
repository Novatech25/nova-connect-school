// Edge Function: Validate Campus Location
// Description: Validates user location within campus boundaries for multi-campus schools

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { requireMultiCampusAccess } from '../_shared/multiCampusCheck.ts';

// Types for request/response
interface ValidateCampusLocationRequest {
  schoolId: string;
  campusId: string;
  userLat: number;
  userLon: number;
  userId?: string;
  action: 'attendance' | 'lesson_log' | 'qr_scan';
}

interface ValidateCampusLocationSuccessResponse {
  valid: true;
  distance: number;
  campus: {
    id: string;
    name: string;
    code: string;
    address: string;
    radiusMeters: number;
  };
  message: string;
}

interface ValidateCampusLocationErrorResponse {
  valid: false;
  error: 'out_of_range' | 'campus_not_found' | 'access_denied' | 'multi_campus_not_enabled' | 'invalid_coordinates';
  message: string;
  distance?: number;
  campus?: {
    id: string;
    name: string;
    code: string;
    address: string;
    radiusMeters: number;
  };
}

type ValidateCampusLocationResponse =
  | ValidateCampusLocationSuccessResponse
  | ValidateCampusLocationErrorResponse;

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
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'access_denied',
          message: 'Missing authorization header',
        } as ValidateCampusLocationErrorResponse),
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
          valid: false,
          error: 'access_denied',
          message: 'Invalid authentication',
        } as ValidateCampusLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // 1.5. Verify user belongs to the specified school
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'access_denied',
          message: 'Unable to verify user school',
        } as ValidateCampusLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    if (userData.school_id !== schoolId) {
      // Only allow school_admin and super_admin to specify userId for other users
      if (userId && userData.role !== 'school_admin' && userData.role !== 'super_admin') {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'access_denied',
            message: 'You can only validate location for your own school',
          } as ValidateCampusLocationErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }

      if (!userId) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'access_denied',
            message: 'You can only validate location for your own school',
          } as ValidateCampusLocationErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
    }

    // 2. Parse request body
    const {
      schoolId,
      campusId,
      userLat,
      userLon,
      userId,
      action,
    }: ValidateCampusLocationRequest = await req.json();

    if (!schoolId || !campusId || userLat === undefined || userLon === undefined || !action) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'invalid_coordinates',
          message: 'Missing required fields: schoolId, campusId, userLat, userLon, action',
        } as ValidateCampusLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 3. Validate GPS coordinates
    if (!isValidCoordinates(userLat, userLon)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'invalid_coordinates',
          message: 'Invalid GPS coordinates',
        } as ValidateCampusLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 4. Verify multi-campus module is enabled
    try {
      await requireMultiCampusAccess(supabase, schoolId);
    } catch (error) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'multi_campus_not_enabled',
          message: error instanceof Error ? error.message : 'Multi-campus module not enabled',
        } as ValidateCampusLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 5. Retrieve campus information
    const { data: campus, error: campusError } = await supabase
      .from('campuses')
      .select('*')
      .eq('id', campusId)
      .eq('school_id', schoolId)
      .single();

    if (campusError || !campus) {
      // Audit log for campus not found
      await supabase.from('audit_logs').insert({
        action: 'validate_campus_location',
        resource_type: 'campus',
        resource_id: campusId,
        school_id: schoolId,
        user_id: userId || user.id,
        details: {
          success: false,
          reason: 'campus_not_found',
          action,
          userLocation: { latitude: userLat, longitude: userLon },
        },
      });

      return new Response(
        JSON.stringify({
          valid: false,
          error: 'campus_not_found',
          message: 'Campus not found',
        } as ValidateCampusLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // 6. Check if user has access to this campus
    const { data: hasAccessData, error: accessError } = await supabase.rpc('check_user_campus_access', {
      p_user_id: userId || user.id,
      p_campus_id: campusId,
    });

    if (accessError || !hasAccessData) {
      // Audit log for access denied
      await supabase.from('audit_logs').insert({
        action: 'validate_campus_location',
        resource_type: 'campus_access',
        resource_id: campusId,
        school_id: schoolId,
        user_id: userId || user.id,
        details: {
          success: false,
          reason: 'access_denied',
          action,
          userLocation: { latitude: userLat, longitude: userLon },
        },
      });

      return new Response(
        JSON.stringify({
          valid: false,
          error: 'access_denied',
          message: 'You do not have access to this campus',
        } as ValidateCampusLocationErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 7. Validate GPS location if campus has coordinates configured
    if (campus.latitude && campus.longitude) {
      const distance = calculateDistance(
        userLat,
        userLon,
        campus.latitude,
        campus.longitude
      );

      const isValid = distance <= campus.radius_meters;

      if (!isValid) {
        // Audit log for failed validation
        await supabase.from('audit_logs').insert({
          action: 'validate_campus_location',
          resource_type: 'campus',
          resource_id: campusId,
          school_id: schoolId,
          user_id: userId || user.id,
          details: {
            success: false,
            reason: 'out_of_range',
            action,
            distance: Math.round(distance),
            radius: campus.radius_meters,
            userLocation: { latitude: userLat, longitude: userLon },
            campusLocation: {
              latitude: campus.latitude,
              longitude: campus.longitude,
            },
          },
        });

        return new Response(
          JSON.stringify({
            valid: false,
            error: 'out_of_range',
            message: `Vous êtes à ${Math.round(distance)}m du campus ${
              campus.name
            }. Rayon autorisé: ${campus.radius_meters}m`,
            distance: Math.round(distance),
            campus: {
              id: campus.id,
              name: campus.name,
              code: campus.code,
              address: campus.address,
              radiusMeters: campus.radius_meters,
            },
          } as ValidateCampusLocationErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // 8. Audit log for successful validation
      await supabase.from('audit_logs').insert({
        action: 'validate_campus_location',
        resource_type: 'campus',
        resource_id: campusId,
        school_id: schoolId,
        user_id: userId || user.id,
        details: {
          success: true,
          action,
          distance: Math.round(distance),
          radius: campus.radius_meters,
          userLocation: { latitude: userLat, longitude: userLon },
          campusLocation: {
            latitude: campus.latitude,
            longitude: campus.longitude,
          },
        },
      });

      // 9. Return success response
      return new Response(
        JSON.stringify({
          valid: true,
          distance: Math.round(distance),
          campus: {
            id: campus.id,
            name: campus.name,
            code: campus.code,
            address: campus.address,
            radiusMeters: campus.radius_meters,
          },
          message: `Localisation validée. Vous êtes à ${Math.round(
            distance
          )}m du campus ${campus.name}`,
        } as ValidateCampusLocationSuccessResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Campus doesn't have GPS configured, allow access
      // 8. Audit log for skipped validation
      await supabase.from('audit_logs').insert({
        action: 'validate_campus_location',
        resource_type: 'campus',
        resource_id: campusId,
        school_id: schoolId,
        user_id: userId || user.id,
        details: {
          success: true,
          action,
          reason: 'gps_not_configured',
          userLocation: { latitude: userLat, longitude: userLon },
        },
      });

      // 9. Return success response without distance
      return new Response(
        JSON.stringify({
          valid: true,
          distance: 0,
          campus: {
            id: campus.id,
            name: campus.name,
            code: campus.code,
            address: campus.address,
            radiusMeters: campus.radius_meters || 0,
          },
          message: `Campus ${campus.name} accessible (géolocalisation non configurée)`,
        } as ValidateCampusLocationSuccessResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error('Error in validate-campus-location:', error);
    return new Response(
      JSON.stringify({
        valid: false,
        error: 'invalid_coordinates',
        message: error.message || 'Une erreur est survenue',
      } as ValidateCampusLocationErrorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
