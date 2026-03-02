import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { generateTeacherSalaryReceipt, DEFAULT_CONFIGS } from '../_shared/receiptTemplates.ts';
import { generateVerificationToken, generateQRCodeMatrix, sha256Hex } from '../_shared/receiptVerification.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) throw new Error('Invalid authorization token');

    const { data: userData } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (!userData || !['school_admin', 'accountant', 'teacher'].includes(userData.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { payrollEntryId, printerProfileId, autoSend, sendChannels } = await req.json();

    // Fetch payroll entry with all related data
    const { data: entry, error: entryError } = await supabase
      .from('payroll_entries')
      .select(`
        *,
        teacher:users(id, first_name, last_name, email, employee_id),
        payroll_period:payroll_periods(*),
        salary_components(*),
        school:schools(*)
      `)
      .eq('id', payrollEntryId)
      .single();

    if (entryError || !entry) throw new Error('Payroll entry not found');

    const teacher = entry.teacher;
    const period = entry.payroll_period;
    const school = entry.school;
    const components = entry.salary_components;

    // Fetch the most recent payment to get cashier (paid_by)
    let cashier = null;
    const { data: payments } = await supabase
      .from('payroll_payments')
      .select(`
        paid_by,
        users!payroll_payments_paid_by_fkey(id, first_name, last_name)
      `)
      .eq('payroll_entry_id', payrollEntryId)
      .order('payment_date', { ascending: false })
      .limit(1)
      .single();

    if (payments) {
      cashier = payments.users;
    }

    // Check existing slip
    const { data: existingSlip } = await supabase
      .from('payroll_slips')
      .select('*')
      .eq('payroll_entry_id', payrollEntryId)
      .single();

    if (existingSlip) {
      const { data: signedUrlData } = await supabase.storage
        .from('payroll-slips')
        .createSignedUrl(existingSlip.pdf_url, 3600);

      return new Response(
        JSON.stringify({
          success: true,
          slip: existingSlip,
          signedUrl: signedUrlData?.signedUrl,
          message: 'Slip already exists'
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

    // Generate slip number using function
    const { data: slipNumberData, error: slipNumberError } = await supabase
      .rpc('generate_receipt_number', {
        p_school_id: school.id,
        p_receipt_type: 'teacher_salary'
      });

    if (slipNumberError) throw slipNumberError;
    const slipNumber = slipNumberData;

    // Generate verification token
    const verificationToken = generateVerificationToken(payrollEntryId, 'teacher_salary', school.id);
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
    const receiptData = {
      school,
      receiptNumber: slipNumber,
      date: new Date(period.end_date),
      amount: entry.net_amount,
      paymentMethod: 'Virement',
      verificationUrl,
      cashier,
      teacher,
      payrollEntry: entry,
      salaryComponents: components,
      hoursWorked: entry.validated_hours,
      hourlyRate: entry.hourly_rate,
      grossAmount: entry.base_amount,
      primesAmount: entry.primes_amount,
      retenuesAmount: entry.retenues_amount,
      avancesAmount: entry.avances_amount,
    };

    const pdfBlob = generateTeacherSalaryReceipt(receiptData, printerConfig, { modules: qrModules });

    // Upload to storage
    const fileName = `${school.id}/${teacher.id}/${slipNumber}-${payrollEntryId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('payroll-slips')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Save verification token
    const { data: tokenRecord } = await supabase
      .from('receipt_verification_tokens')
      .insert({
        receipt_id: payrollEntryId,
        receipt_type: 'teacher_salary',
        token_hash: verificationTokenHash,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    // Create slip record
    const { data: slip, error: insertError } = await supabase
      .from('payroll_slips')
      .insert({
        school_id: school.id,
        payroll_entry_id: payrollEntryId,
        slip_number: slipNumber,
        pdf_url: fileName,
        pdf_size_bytes: pdfBlob.length,
        generated_by: user.id,
        printer_profile_id: printerProfileId,
        verification_token_id: tokenRecord?.id,
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
          receiptId: slip.id,
          receiptType: 'teacher_salary',
          channels: sendChannels,
        },
      });
    }

    const { data: signedUrlData } = await supabase.storage
      .from('payroll-slips')
      .createSignedUrl(fileName, 3600);

    return new Response(
      JSON.stringify({
        success: true,
        slip,
        signedUrl: signedUrlData?.signedUrl,
        verificationUrl: `${supabaseUrl}/functions/v1/verify-receipt?token=${encodeURIComponent(verificationToken)}`,
        message: 'Payroll slip generated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating payroll slip:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
