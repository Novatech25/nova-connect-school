import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface CheckAccessRequest {
  documentType: 'report_card' | 'certificate' | 'student_card' | 'exam_authorization';
  documentId: string;
  studentId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const userToken = req.headers.get('x-user-token');
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : null;
    const token = userToken || bearer;
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const { documentType, documentId, studentId }: CheckAccessRequest = await req.json();

    const { data: userProfile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle();

    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('school_id, roles(name)')
      .eq('user_id', user.id);

    const roleNames = Array.from(
      new Set(
        [
          ...(roleRows || []).map((row: any) => row.roles?.name).filter(Boolean),
          user.user_metadata?.role,
        ].filter(Boolean)
      )
    );

    const hasRole = (role: string) => roleNames.includes(role);
    const isSuperAdmin = hasRole('super_admin');

    let userSchoolId =
      userProfile?.school_id ||
      (roleRows || []).find((row: any) => row.school_id)?.school_id ||
      null;

    const { data: student } = await supabase
      .from('students')
      .select('id, school_id, user_id')
      .eq('id', studentId)
      .maybeSingle();

    if (!student) {
      await logAccess(supabase, {
        schoolId: userSchoolId,
        userId: user.id,
        studentId,
        documentType,
        documentId,
        accessGranted: false,
        paymentStatus: 'ok',
        paymentStatusOverride: false,
        denialReason: 'Student not found',
      });
      return new Response(
        JSON.stringify({ success: false, message: 'Student not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userSchoolId) {
      userSchoolId = student.school_id || null;
    }

    const isStudent = student.user_id === user.id || hasRole('student');

    const { data: parentRows } = await supabase
      .from('parents')
      .select('id, school_id')
      .eq('user_id', user.id);

    const parentIds = (parentRows || []).map((row: any) => row.id).filter(Boolean);

    const { data: parentRelation } = parentIds.length
      ? await supabase
          .from('student_parent_relations')
          .select('id, school_id')
          .eq('student_id', studentId)
          .in('parent_id', parentIds)
          .limit(1)
          .maybeSingle()
      : { data: null };

    const isParent = Boolean(parentRelation);
    const isStaff = hasRole('school_admin') || hasRole('accountant') || hasRole('teacher');

    if (!userSchoolId) {
      userSchoolId = parentRelation?.school_id || (parentRows || [])[0]?.school_id || null;
    }

    if (!isSuperAdmin && userSchoolId && student.school_id !== userSchoolId) {
      await logAccess(supabase, {
        schoolId: userSchoolId,
        userId: user.id,
        studentId,
        documentType,
        documentId,
        accessGranted: false,
        paymentStatus: 'ok',
        paymentStatusOverride: false,
        denialReason: 'Unauthorized: Student belongs to different school',
      });
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isSuperAdmin && !isStudent && !isParent && !isStaff) {
      await logAccess(supabase, {
        schoolId: userSchoolId,
        userId: user.id,
        studentId,
        documentType,
        documentId,
        accessGranted: false,
        paymentStatus: 'ok',
        paymentStatusOverride: false,
        denialReason: 'Unauthorized: User not authorized to access this student documents',
      });
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userSchoolId) {
      throw new Error('Missing school context');
    }

    const { data: school } = await supabase
      .from('schools')
      .select('settings')
      .eq('id', userSchoolId)
      .single();

    const paymentConfig = school?.settings?.paymentBlocking || { mode: 'OK' };

    if (paymentConfig.mode === 'OK') {
      await logAccess(supabase, {
        schoolId: userSchoolId,
        userId: user.id,
        studentId,
        documentType,
        documentId,
        accessGranted: true,
        paymentStatus: 'ok',
        paymentStatusOverride: false,
      });

      return new Response(
        JSON.stringify({
          success: true,
          accessGranted: true,
          paymentStatus: 'ok',
          paymentStatusOverride: false,
          reason: 'Payment blocking disabled (mode OK)',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const documentTypeBlocked = {
      report_card: paymentConfig.blockBulletins,
      certificate: paymentConfig.blockCertificates,
      student_card: paymentConfig.blockStudentCards,
      exam_authorization: paymentConfig.blockExamAuthorizations,
    }[documentType];

    if (!documentTypeBlocked) {
      await logAccess(supabase, {
        schoolId: userSchoolId,
        userId: user.id,
        studentId,
        documentType,
        documentId,
        accessGranted: true,
        paymentStatus: 'ok',
        paymentStatusOverride: false,
      });

      return new Response(
        JSON.stringify({
          success: true,
          accessGranted: true,
          reason: 'Document type not blocked by school configuration'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let paymentStatus: string;
    let paymentStatusOverride: boolean;

    if (documentType === 'report_card') {
      const { data } = await supabase
        .from('report_cards')
        .select('payment_status, payment_status_override, override_reason, school_id')
        .eq('id', documentId)
        .single();

      if (!isSuperAdmin && data && userSchoolId && data.school_id !== userSchoolId) {
        await logAccess(supabase, {
          schoolId: userSchoolId,
          userId: user.id,
          studentId,
          documentType,
          documentId,
          accessGranted: false,
          paymentStatus: 'ok',
          paymentStatusOverride: false,
          denialReason: 'Unauthorized: Document belongs to different school',
        });
        return new Response(
          JSON.stringify({ success: false, message: 'Unauthorized access' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      paymentStatus = data?.payment_status || 'ok';
      paymentStatusOverride = data?.payment_status_override || false;
    } else {
      const { data: studentWithYear } = await supabase
        .from('students')
        .select('academic_year_id')
        .eq('id', studentId)
        .single();

      const { data: balance } = await supabase.rpc('calculate_student_balance', {
        p_student_id: studentId,
        p_academic_year_id: studentWithYear?.academic_year_id
      });

      paymentStatus = balance?.payment_status || 'ok';
      paymentStatusOverride = false;
    }

    let accessGranted: boolean;
    let denialReason: string | null = null;

    if (paymentConfig.mode === 'WARNING') {
      accessGranted = true;
    } else {
      accessGranted = paymentStatusOverride || paymentStatus !== 'blocked';
      denialReason = !accessGranted
        ? "Acces bloque en raison d'arrieres de paiement. Veuillez contacter l'administration."
        : null;
    }

    await logAccess(supabase, {
      schoolId: userSchoolId,
      userId: user.id,
      studentId,
      documentType,
      documentId,
      accessGranted,
      paymentStatus,
      paymentStatusOverride,
      denialReason,
      ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    });

    return new Response(
      JSON.stringify({
        success: true,
        accessGranted,
        paymentStatus,
        paymentStatusOverride,
        denialReason,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error checking document access:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function logAccess(supabase: any, data: any) {
  if (!data.schoolId) {
    return;
  }
  try {
    await supabase.from('document_access_logs').insert({
      school_id: data.schoolId,
      user_id: data.userId,
      student_id: data.studentId,
      document_type: data.documentType,
      document_id: data.documentId,
      access_granted: data.accessGranted,
      payment_status: data.paymentStatus,
      payment_status_override: data.paymentStatusOverride,
      denial_reason: data.denialReason,
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
    });
  } catch (_error) {
    // Ignore log failures to avoid blocking access checks.
  }
}
