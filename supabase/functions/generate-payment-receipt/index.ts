import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { generateStudentPaymentReceipt, DEFAULT_CONFIGS } from '../_shared/receiptTemplates.ts';
import { generateVerificationToken, generateQRCodeMatrix, sha256Hex } from '../_shared/receiptVerification.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawAuthHeader =
      req.headers.get('x-user-token') ||
      req.headers.get('x-user-jwt') ||
      req.headers.get('Authorization') ||
      '';
    console.log('Auth header present:', !!rawAuthHeader);

    if (!rawAuthHeader) {
      console.error('Missing authorization header');
      throw new Error('Missing authorization header');
    }

    const token = rawAuthHeader.startsWith('Bearer ')
      ? rawAuthHeader.replace('Bearer ', '')
      : rawAuthHeader;
    console.log('Token length:', token.length);
    console.log('Token prefix:', token.substring(0, 20) + '...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log('Auth result:', { authError, user: !!user });

    if (authError) {
      console.error('Auth error details:', authError);
      throw new Error(`Auth error: ${authError.message}`);
    }

    if (!user) {
      console.error('No user found in token');
      throw new Error('Invalid authorization token - no user found');
    }

    const { paymentId, printerProfileId, autoSend, sendChannels } = await req.json();

    // Fetch payment with all related data
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        students(id, first_name, last_name, matricule),
        fee_schedules(*, fee_types(*, schools(*))),
        cashier:users!payments_received_by_fkey(id, first_name, last_name)
      `)
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) throw new Error('Payment not found');

    const school = payment.fee_schedules?.fee_types?.schools;
    const student = payment.students;
    const feeSchedule = payment.fee_schedules;
    const feeType = feeSchedule?.fee_types;

    if (!school || !student || !feeSchedule || !feeType) {
      throw new Error('Missing payment relations (school/student/fee schedule)');
    }

    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('school_id, roles(name)')
      .eq('user_id', user.id);

    if (roleError || !roleRows || roleRows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedRoles = new Set(['school_admin', 'accountant', 'parent', 'student', 'super_admin']);
    const hasAccess = roleRows.some((row) => {
      const roleName = (row as any)?.roles?.name;
      if (roleName === 'super_admin') return true;
      return allowedRoles.has(roleName) && row.school_id === school.id;
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bucketName = 'payment-receipts';

    // Check existing receipt
    const { data: existingReceipt } = await supabase
      .from('payment_receipts')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (existingReceipt) {
      const { data: signedUrlData } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(existingReceipt.pdf_url, 3600);

      return new Response(
        JSON.stringify({
          success: true,
          receipt: existingReceipt,
          signedUrl: signedUrlData?.signedUrl,
          message: 'Receipt already exists'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get printer profile
    let printerConfig = DEFAULT_CONFIGS.A4_STANDARD;
    if (printerProfileId) {
      const { data: profile } = await supabase
        .from('printer_profiles')
        .select('*')
        .eq('id', printerProfileId)
        .single();

      if (profile) {
        printerConfig = { ...DEFAULT_CONFIGS[profile.profile_type], ...profile.template_config };
      }
    } else {
      // Get default profile for school
      const { data: defaultProfile } = await supabase
        .from('printer_profiles')
        .select('*')
        .eq('school_id', school.id)
        .eq('is_default', true)
        .single();

      if (defaultProfile) {
        printerConfig = { ...DEFAULT_CONFIGS[defaultProfile.profile_type], ...defaultProfile.template_config };
      }
    }
    printerConfig = { ...printerConfig, showQR: true, showSignature: true };

    // Generate receipt number directly (without PostgreSQL function)
    const year = new Date().getFullYear().toString();

    // Get the last receipt number for this school and year
    const { data: lastReceipt } = await supabase
      .from('payment_receipts')
      .select('receipt_number')
      .eq('school_id', school.id)
      .like('receipt_number', `REC-${year}-%`)
      .order('receipt_number', { ascending: false })
      .limit(1)
      .single();

    let sequenceNumber = 1;
    if (lastReceipt) {
      // Extract sequence number from last receipt (e.g., "REC-2025-0001" -> 1)
      const match = lastReceipt.receipt_number.match(/REC-\d+-(\d+)/);
      if (match) {
        sequenceNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Generate new receipt number
    const receiptNumber = `REC-${year}-${String(sequenceNumber).padStart(4, '0')}`;

    // Generate verification token
    const verificationToken = generateVerificationToken(paymentId, 'student_payment', school.id);
    const verificationTokenHash = await sha256Hex(verificationToken);
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const appPublicUrl = Deno.env.get('APP_PUBLIC_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL');
    const baseAppUrl = appPublicUrl ? appPublicUrl.replace(/\/$/, '') : '';
    const verificationUrl = baseAppUrl
      ? `${baseAppUrl}/verify-receipt?token=${encodeURIComponent(verificationToken)}`
      : anonKey
        ? `${supabaseUrl}/functions/v1/verify-receipt?token=${encodeURIComponent(verificationToken)}&apikey=${encodeURIComponent(anonKey)}`
        : `${supabaseUrl}/functions/v1/verify-receipt?token=${encodeURIComponent(verificationToken)}`;
    const qrModules = generateQRCodeMatrix(verificationUrl);

    // Generate PDF
    let className: string | undefined = undefined;
    const academicYearId = feeSchedule?.academic_year_id;
    if (student?.id && academicYearId) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('classes(name)')
        .eq('student_id', student.id)
        .eq('academic_year_id', academicYearId)
        .limit(1)
        .maybeSingle();

      className = (enrollment as any)?.classes?.name;
    }

    const receiptData = {
      school,
      receiptNumber,
      date: new Date(payment.payment_date),
      amount: payment.amount,
      paymentMethod: getPaymentMethodLabel(payment.payment_method),
      paymentId: payment.id,
      paymentReference: payment.reference_number,
      paymentNotes: payment.notes,
      status: 'active',
      verificationUrl,
      cashier: payment.cashier,
      student: { ...student, class_name: className },
      feeType,
      feeSchedule,
      // Ces champs peuvent ne pas exister dans la table payments
      // On les récupère depuis feeSchedule ou on met des valeurs par défaut
      paymentNature: feeSchedule?.metadata?.payment_nature || 'Paiement de frais scolaires',
      periodCoverage: feeType?.name || 'Période en cours',
      discount: feeSchedule?.discount_amount || 0,
      arrears: 0, // Calculé si nécessaire
    };

    const pdfBlob = generateStudentPaymentReceipt(receiptData, printerConfig, { modules: qrModules });

    // Ensure storage bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) throw bucketsError;
    const bucketExists = (buckets || []).some((bucket) => bucket.name === bucketName);
    if (!bucketExists) {
      const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
        public: false,
      });
      if (createBucketError) throw createBucketError;
    }

    // Upload to storage
    const fileName = `${school.id}/${student.id}/${receiptNumber}-${paymentId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Save verification token
    const receiptDataHashPayload = JSON.stringify({
      receiptNumber,
      paymentId: payment.id,
      schoolId: school.id,
      studentId: student.id,
      feeScheduleId: feeSchedule.id,
      amount: payment.amount,
      paymentDate: payment.payment_date,
      paymentMethod: payment.payment_method,
    });
    const receiptDataHash = await sha256Hex(receiptDataHashPayload);

    const { data: tokenRecord } = await supabase
      .from('receipt_verification_tokens')
      .insert({
        receipt_id: paymentId,
        receipt_type: 'student_payment',
        token_hash: verificationTokenHash,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    // Create receipt record
    const { data: receipt, error: insertError } = await supabase
      .from('payment_receipts')
      .insert({
        school_id: school.id,
        payment_id: paymentId,
        receipt_number: receiptNumber,
        pdf_url: fileName,
        pdf_size_bytes: pdfBlob.length,
        generated_by: user.id,
        printer_profile_id: printerProfileId,
        verification_token_id: tokenRecord?.id,
        receipt_data_hash: receiptDataHash,
        status: 'active',
        auto_sent: autoSend,
        send_channels: sendChannels || [],
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Auto-send if requested
    if (autoSend && sendChannels?.length > 0) {
      // Trigger send-notification edge function
      await supabase.functions.invoke('send-receipt-notification', {
        body: {
          receiptId: receipt.id,
          receiptType: 'student_payment',
          channels: sendChannels,
        },
      });
    }

    const { data: signedUrlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600);

    return new Response(
      JSON.stringify({
        success: true,
        receipt,
        signedUrl: signedUrlData?.signedUrl,
        verificationUrl,
        message: 'Receipt generated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('=== RECEIPT GENERATION ERROR ===');
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error:', error);

    // Return a detailed error message
    const errorMessage = error?.message || 'Unknown error';
    const errorDetails = {
      name: error?.name || 'UnknownError',
      message: errorMessage,
      hint: 'Verify that payment_receipts and receipt_verification_tokens tables exist',
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
        details: errorDetails,
        hint: 'Check the console for more details'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'cash': 'Especes',
    'bank_transfer': 'Virement bancaire',
    'check': 'Cheque',
    'mobile_money': 'Mobile Money',
    'card': 'Carte bancaire',
    'other': 'Autre'
  };
  return labels[method] || method;
}

