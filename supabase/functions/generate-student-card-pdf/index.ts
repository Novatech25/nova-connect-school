import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

interface GenerateStudentCardRequest {
  studentId: string;
  templateId?: string;
  regenerate?: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SB_URL') || '';
const supabaseAnonKey = Deno.env.get('SB_ANON_KEY') || '';
const supabaseServiceKey = Deno.env.get('SB_SERVICE_ROLE_KEY') || '';

/**
 * Décoder et valider le JWT token
 */
function decodeJWT(token: string): { sub?: string; exp?: number; role?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    let payload = parts[1];
    const padding = 4 - (payload.length % 4);
    if (padding !== 4) payload += '='.repeat(padding);
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    const decoded = JSON.parse(atob(payload));
    
    // Vérifier expiration
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      console.log('Token expired, exp:', decoded.exp, 'now:', Date.now() / 1000);
      return null;
    }
    
    return decoded;
  } catch (e) {
    console.error('JWT decode error:', e);
    return null;
  }
}

/**
 * Valider le token avec Supabase Auth
 */
async function validateWithSupabase(token: string): Promise<string | null> {
  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
    
    const { data, error } = await authClient.auth.getUser(token);
    
    if (error) {
      console.log('Supabase auth validation error:', error.message);
      return null;
    }
    
    return data.user?.id || null;
  } catch (e) {
    console.error('Supabase auth exception:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    // Essayer d'abord Supabase Auth
    let userId = await validateWithSupabase(token);
    
    // Fallback: décoder JWT localement
    if (!userId) {
      const payload = decodeJWT(token);
      if (!payload?.sub) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = payload.sub;
    }

    console.log('Authenticated user:', userId);

    // Client Supabase avec service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier le rôle utilisateur
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role_id, roles!inner(name), school_id')
      .eq('user_id', userId)
      .limit(1);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    if (!userRoles?.length) {
      return new Response(
        JSON.stringify({ error: 'No role assigned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roleName = userRoles[0].roles.name;
    const userSchoolId = userRoles[0].school_id;

    if (!['super_admin', 'school_admin', 'accountant'].includes(roleName)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { studentId, templateId, regenerate = false }: GenerateStudentCardRequest = await req.json();

    // Validation
    if (!studentId) {
      return new Response(
        JSON.stringify({ error: 'Student ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*, schools(*)')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const school = student.schools as any;

    // Récupérer la photo de l'élève
    const { data: photoDoc, error: photoError } = await supabase
      .from('student_documents')
      .select('file_url')
      .eq('student_id', studentId)
      .eq('document_type', 'photo')
      .eq('school_id', school.id)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let photoUrl: string | null = null;
    if (photoDoc?.file_url) {
      // Construire l'URL publique
      photoUrl = `${supabaseUrl}/storage/v1/object/public/documents/${photoDoc.file_url}`;
    }
    console.log('Photo URL:', photoUrl);
    
    // Récupérer l'inscription active de l'étudiant pour avoir sa classe
    console.log('Fetching enrollment for student:', studentId);
    
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('class_id, status, enrollment_date')
      .eq('student_id', studentId)
      .eq('status', 'enrolled')
      .order('enrollment_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    console.log('Enrollment query result:', { 
      enrollment, 
      error: enrollmentError?.message,
      studentId 
    });
    
    // Récupérer les détails de la classe séparément
    let studentClass = null;
    if (enrollment?.class_id) {
      console.log('Fetching class details for class_id:', enrollment.class_id);
      
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name, level_id, levels!inner(name, code)')
        .eq('id', enrollment.class_id)
        .maybeSingle();
      
      console.log('Class query result:', { 
        classData, 
        error: classError?.message 
      });
      
      if (classData) {
        const levelData = Array.isArray(classData.levels) ? classData.levels[0] : classData.levels;
        studentClass = {
          id: classData.id,
          name: classData.name,
          level: levelData?.name || levelData?.code || ''
        };
        console.log('Built studentClass:', studentClass);
      }
    } else {
      console.log('No class_id found in enrollment');
    }
    
    console.log('School data:', JSON.stringify(school));
    console.log('Enrollment data:', JSON.stringify(enrollment));
    console.log('Class data:', JSON.stringify(studentClass));

    // Vérifier l'accès à l'école
    if (roleName !== 'super_admin' && school.id !== userSchoolId) {
      return new Response(
        JSON.stringify({ error: 'Access denied - different school' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier qrSecret
    const qrSecret = school.settings?.qrSecret;
    if (!qrSecret) {
      return new Response(
        JSON.stringify({ error: 'QR secret not configured for school' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template
    let template: any = null;
    if (templateId) {
      const { data } = await supabase
        .from('card_templates')
        .select('*')
        .eq('id', templateId)
        .eq('school_id', userSchoolId)
        .single();
      template = data;
    } else {
      const { data } = await supabase
        .from('card_templates')
        .select('*')
        .eq('school_id', userSchoolId)
        .eq('is_default', true)
        .single();
      template = data;
    }

    // Vérifier carte existante
    const { data: existingCard } = await supabase
      .from('student_cards')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingCard && !regenerate) {
      // Ajouter la photo_url à l'objet student
      const studentWithPhoto = {
        ...student,
        photo_url: photoUrl,
      };

      return new Response(
        JSON.stringify({ 
          success: true, 
          card: existingCard, 
          student: studentWithPhoto, 
          school,
          studentClass,
          template,
          qrData: existingCard.qr_code_data,
          signature: existingCard.qr_code_signature,
          message: 'Card already exists' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Payment status
    const { data: paymentBalance } = await supabase
      .rpc('calculate_student_balance', { p_student_id: studentId });
    const paymentStatus = paymentBalance?.payment_status || 'ok';

    // Révoquer ancienne carte
    if (existingCard && regenerate) {
      await supabase
        .from('student_cards')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_by: userId,
          revocation_reason: 'Regenerated',
        })
        .eq('id', existingCard.id);
    }

    // Créer nouvelle carte
    let newCard;
    let insertError;
    
    // Essayer d'abord avec le trigger automatique
    const insertResult = await supabase
      .from('student_cards')
      .insert({
        school_id: userSchoolId,
        student_id: studentId,
        template_id: template?.id || null,
        issue_date: new Date().toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
        generated_by: userId,
        payment_status: paymentStatus,
        status: 'active',
        qr_code_data: '{}',
        qr_code_signature: '',
        pdf_url: 'pending',
        pdf_size_bytes: 0,
      })
      .select()
      .single();
    
    newCard = insertResult.data;
    insertError = insertResult.error;

    // Si échec à cause de doublon, essayer avec un numéro manuel unique
    if (insertError && insertError.message?.includes('unique constraint')) {
      console.log('Retrying with manual card_number...');
      const timestamp = Date.now();
      const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      const manualCardNumber = `MANUAL-${timestamp}-${randomPart}`;
      
      const retryResult = await supabase
        .from('student_cards')
        .insert({
          school_id: userSchoolId,
          student_id: studentId,
          card_number: manualCardNumber,
          template_id: template?.id || null,
          issue_date: new Date().toISOString().split('T')[0],
          generated_at: new Date().toISOString(),
          generated_by: userId,
          payment_status: paymentStatus,
          status: 'active',
          qr_code_data: '{}',
          qr_code_signature: '',
          pdf_url: 'pending',
          pdf_size_bytes: 0,
        })
        .select()
        .single();
      
      newCard = retryResult.data;
      insertError = retryResult.error;
    }

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create card', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Générer QR et signature
    const qrTimestamp = Date.now();
    const qrPayload = { 
      studentId, 
      schoolId: school.id, 
      cardId: newCard.id, 
      timestamp: qrTimestamp 
    };
    const qrData = JSON.stringify(qrPayload);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(qrSecret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', 
      keyData, 
      { name: 'HMAC', hash: 'SHA-256' }, 
      false, 
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(qrData));
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('Card created successfully:', newCard.id);

    // Ajouter la photo_url à l'objet student
    const studentWithPhoto = {
      ...student,
      photo_url: photoUrl,
    };

    return new Response(
      JSON.stringify({
        success: true,
        card: newCard,
        student: studentWithPhoto, 
        school,
        studentClass,
        template,
        qrData, 
        signature,
        message: 'Card created successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
