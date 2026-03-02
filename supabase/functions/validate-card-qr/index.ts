import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import crypto from 'https://deno.land/std@0.168.0/node/crypto.ts';

interface ValidateCardQrRequest {
  qrData: string;
  signature: string;
  expectedClassId?: string;
  expectedCampusId?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Rate limiting store (in production, use Redis or similar)
const scanAttempts = new Map<string, { count: number; lastAttempt: number }>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Verify user has permission (teacher, supervisor, or school_admin)
    const { data: userData } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (!userData || !['teacher', 'supervisor', 'school_admin'].includes(userData.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { qrData, signature, expectedClassId, expectedCampusId }: ValidateCardQrRequest = await req.json();

    // Parse QR data
    let qrPayload;
    try {
      qrPayload = JSON.parse(qrData);
    } catch {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'Invalid QR data format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { studentId, schoolId, cardId, timestamp } = qrPayload;

    if (!studentId || !schoolId || !cardId || !timestamp) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'Invalid QR payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch school to get QR secret
    const { data: school } = await supabase
      .from('schools')
      .select('settings, id')
      .eq('id', schoolId)
      .single();

    if (!school) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'School not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user's school matches card school
    if (userData.role !== 'super_admin' && school.id !== userData.school_id) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'Card not from your school' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get QR secret from school settings
    const schoolSettings = school.settings || {};
    const qrSecret = schoolSettings.qrSecret;
    const qrValidityMinutes = schoolSettings.qrValidityMinutes || 60;

    if (!qrSecret) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'QR validation not configured for school' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const expectedSignature = await crypto.subtle
      .importKey(
        'raw',
        new TextEncoder().encode(qrSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )
      .then(async (key) => {
        const signatureBuffer = await crypto.subtle.sign(
          'HMAC',
          key,
          new TextEncoder().encode(qrData)
        );
        return Array.from(new Uint8Array(signatureBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      });

    if (signature !== expectedSignature) {
      // Log suspicious activity
      await supabase
        .from('audit_logs')
        .insert({
          school_id: userData.school_id,
          user_id: user.id,
          action: 'VALIDATE',
          resource_type: 'student_card_qr',
          resource_id: cardId,
          old_data: { reason: 'Invalid signature' },
          new_data: { qrData, signature: '***', ip: req.headers.get('x-forwarded-for') || 'unknown' },
        });

      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'Invalid QR signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check timestamp validity
    const now = Date.now();
    const expiryTime = timestamp + qrValidityMinutes * 60 * 1000;
    if (now > expiryTime) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'QR code expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch card
    const { data: card } = await supabase
      .from('student_cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (!card) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'Card not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check card status
    if (card.status !== 'active') {
      let reason = '';
      if (card.status === 'expired') reason = 'Card expired';
      else if (card.status === 'revoked') reason = 'Card revoked';
      else if (card.status === 'lost') reason = 'Card reported lost';

      return new Response(
        JSON.stringify({ success: false, valid: false, reason }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if card is expired
    if (card.expiry_date) {
      const expiryDate = new Date(card.expiry_date);
      if (new Date() > expiryDate) {
        return new Response(
          JSON.stringify({ success: false, valid: false, reason: 'Card expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch student data
    const { data: student } = await supabase
      .from('students')
      .select('*, classes(*), campuses(*)')
      .eq('id', studentId)
      .single();

    if (!student) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify class context if provided
    if (expectedClassId && student.class_id !== expectedClassId) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'Student not in expected class' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify campus context if provided
    if (expectedCampusId && student.campus_id !== expectedCampusId) {
      return new Response(
        JSON.stringify({ success: false, valid: false, reason: 'Student not in expected campus' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting per card/student
    const rateLimitKey = `${cardId}_${user.id}`;
    const nowTime = Date.now();
    const attempts = scanAttempts.get(rateLimitKey);

    if (attempts && nowTime - attempts.lastAttempt < 10000) { // 10 seconds
      if (attempts.count >= 3) {
        return new Response(
          JSON.stringify({ success: false, valid: false, reason: 'Too many scan attempts. Please wait.' }),
                          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      scanAttempts.set(rateLimitKey, { count: attempts.count + 1, lastAttempt: nowTime });
    } else {
      scanAttempts.set(rateLimitKey, { count: 1, lastAttempt: nowTime });
    }

    // Log successful validation in audit logs
    await supabase
      .from('audit_logs')
      .insert({
        school_id: userData.school_id,
        user_id: user.id,
        action: 'VALIDATE',
        resource_type: 'student_card_qr',
        resource_id: cardId,
        new_data: {
          student_id: studentId,
          validation_context: {
            expected_class_id: expectedClassId,
            expected_campus_id: expectedCampusId,
          },
        },
      });

    // Check if QR for attendance is enabled (premium feature)
    const qrForAttendance = schoolSettings.studentCards?.qrForAttendance || false;
    let attendanceRecorded = false;

    if (qrForAttendance && userData.role !== 'school_admin') {
      // Record attendance using card QR
      const { data: attendanceRecord } = await supabase
        .from('qr_attendance_logs')
        .insert({
          school_id: userData.school_id,
          student_id: studentId,
          scanned_by: user.id,
          scan_type: 'student_card',
          card_id: cardId,
          class_id: student.class_id,
          campus_id: student.campus_id,
        })
        .select()
        .single();

      attendanceRecorded = !!attendanceRecord;
    }

    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        student: {
          id: student.id,
          firstName: student.first_name,
          lastName: student.last_name,
          matricule: student.matricule,
          photoUrl: student.photo_url,
          class: student.classes,
          campus: student.campuses,
        },
        card: {
          id: card.id,
          cardNumber: card.card_number,
          status: card.status,
          issueDate: card.issue_date,
          expiryDate: card.expiry_date,
        },
        attendanceRecorded,
        message: 'Card validated successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error validating card QR:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
