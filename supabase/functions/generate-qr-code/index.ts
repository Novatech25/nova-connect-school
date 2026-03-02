// Edge Function: Generate QR Code
// Description: Generates signed QR codes for attendance tracking with HMAC signature

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Types for request/response
interface GenerateQrRequest {
  schoolId: string;
  codeType: 'school_global' | 'class_specific' | 'student_card';
  classId?: string;
  studentId?: string;
  campusId?: string;
}

interface GenerateQrResponse {
  qrCodeId: string;
  qrData: string;
  expiresAt: string;
  rotationIntervalMinutes: number;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const qrSigningSecret = Deno.env.get('QR_SIGNING_SECRET')!;

if (!qrSigningSecret) {
  throw new Error('QR_SIGNING_SECRET environment variable is required');
}

// Generate HMAC-SHA256 signature
async function generateSignature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(qrSigningSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate random token
function generateRandomToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  console.log("=== V4: JWT VERIFICATION DISABLED (Hopefully) ===");

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization') || '';
    const userTokenHeader =
      req.headers.get('x-user-token') ||
      req.headers.get('x-user-jwt') ||
      '';
    const rawToken = (userTokenHeader || authHeader).replace('Bearer ', '').trim();

    console.log('[EDGE FUNCTION] Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      supabaseUrlPrefix: supabaseUrl?.substring(0, 30),
      hasAnonKey: !!supabaseAnonKey,
      anonKeyPrefix: supabaseAnonKey?.substring(0, 20),
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyPrefix: supabaseServiceKey?.substring(0, 20),
      hasToken: !!rawToken,
      tokenPrefix: rawToken?.substring(0, 30),
    });

    if (!rawToken) {
      throw new Error('Missing user token');
    }

    // Use anon key for JWT validation (has access to JWT public keys)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(rawToken);

    console.log('[EDGE FUNCTION] Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError ? {
        message: authError.message,
        status: authError.status,
        name: authError.name,
      } : null,
    });

    if (authError || !user) {
      console.error('[EDGE FUNCTION] Authentication failed:', authError);
      return new Response(
        JSON.stringify({
          code: 401,
          message: 'Invalid JWT',
          details: authError?.message || 'No user found',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Use service role key for database operations (has elevated privileges)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse request body
    const {
      schoolId,
      codeType,
      classId,
      studentId,
      campusId,
    }: GenerateQrRequest = await req.json();

    // Validate required fields
    if (!schoolId || !codeType) {
      throw new Error('Missing required fields: schoolId, codeType');
    }

    // Validate code-specific requirements
    if (codeType === 'class_specific' && !classId) {
      throw new Error('classId is required for class_specific QR codes');
    }
    if (codeType === 'student_card' && !studentId) {
      throw new Error('studentId is required for student_card QR codes');
    }

    // 3. Verify user has admin/supervisor role in this school
    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('school_id, roles(name)')
      .eq('user_id', user.id);

    if (roleError) {
      throw new Error('Failed to check user roles');
    }

    const isAllowed = (roleRows || []).some((row) => {
      const roleName = (row as any)?.roles?.name;
      if (roleName === 'super_admin') {
        return true;
      }
      return (
        row.school_id === schoolId &&
        (roleName === 'school_admin' || roleName === 'supervisor')
      );
    });

    if (!isAllowed) {
      throw new Error('Unauthorized: Only admins and supervisors can generate QR codes');
    }

    // 4. Retrieve school QR configuration
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      throw new Error('School not found');
    }

    const qrConfig = (school.settings as any)?.qrAttendance;
    if (!qrConfig || !qrConfig.enabled) {
      throw new Error('QR attendance is not enabled for this school');
    }

    const qrValidityMinutes = qrConfig.qrValidityMinutes || 10;
    const rotationIntervalMinutes = qrConfig.qrRotationMinutes || 10;

    // 5. Validate class exists if provided
    if (codeType === 'class_specific' && classId) {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('id', classId)
        .eq('school_id', schoolId)
        .single();

      if (classError || !classData) {
        throw new Error('Class not found in this school');
      }
    }

    // 6. Generate token and signature
    const timestamp = Date.now();
    const randomBytes = generateRandomToken();
    const token = `${schoolId}:${codeType}:${classId || 'global'}:${timestamp}:${randomBytes}`;
    const signature = await generateSignature(token);

    // 7. Calculate expiration
    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + qrValidityMinutes * 60 * 1000);

    // 8. Insert QR code into database
    const { data: qrCode, error: insertError } = await supabase
      .from('qr_attendance_codes')
      .insert({
        school_id: schoolId,
        code_type: codeType,
        class_id: classId || null,
        student_id: studentId || null,
        campus_id: campusId || null,
        qr_token: token,
        signature: signature,
        generated_at: generatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        rotation_interval_minutes: rotationIntervalMinutes,
        metadata: {
          generatedBy: user.id,
          generatedVia: 'edge_function',
        },
      })
      .select('id')
      .single();

    if (insertError || !qrCode) {
      console.error('Error inserting QR code:', insertError);
      throw new Error('Failed to create QR code');
    }

    // 9. Create QR data URL
    const qrData = `novaconnect://attendance/scan?token=${encodeURIComponent(token)}&sig=${signature}`;

    // 10. Log action in audit_logs
    await supabase.from('audit_logs').insert({
      school_id: schoolId,
      user_id: user.id,
      action: 'generate_qr_code',
      resource_type: 'qr_attendance_code',
      resource_id: qrCode.id,
      metadata: {
        codeType,
        classId,
        expiresAt: expiresAt.toISOString(),
      },
    });

    // 11. Return response
    const response: GenerateQrResponse = {
      qrCodeId: qrCode.id,
      qrData,
      expiresAt: expiresAt.toISOString(),
      rotationIntervalMinutes,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in generate-qr-code:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 403 : 400,
      }
    );
  }
});
