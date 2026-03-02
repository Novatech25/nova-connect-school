import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyToken, sha256Hex } from '../_shared/receiptVerification.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Support both POST (body) and GET (query params)
    let token: string | null = null;

    if (req.method === 'POST') {
      const body = await req.json();
      token = body.token;
    } else {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
    }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const verification = verifyToken(token);
    if (!verification?.valid) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or expired token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenHash = await sha256Hex(token);
    const { data: tokenRecord } = await supabase
      .from('receipt_verification_tokens')
      .select('id, receipt_id, receipt_type, expires_at, token_hash')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!tokenRecord) {
      return new Response(
        JSON.stringify({ success: false, message: 'Verification token not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Verification token expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (
      tokenRecord.receipt_id !== verification.receiptId ||
      tokenRecord.receipt_type !== verification.receiptType
    ) {
      return new Response(
        JSON.stringify({ success: false, message: 'Verification token mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch receipt details
    const receiptType = verification!.receiptType;
    const receiptId = verification!.receiptId;
    const isStudentPayment = receiptType === 'student_payment';
    const tableName = isStudentPayment ? 'payment_receipts' : 'payroll_slips';
    const idColumn = isStudentPayment ? 'payment_id' : 'payroll_entry_id';

    const { data: receipt, error } = await supabase
      .from(tableName)
      .select('*')
      .eq(idColumn, receiptId!)
      .single();

    if (error || !receipt) {
      return new Response(
        JSON.stringify({ success: false, message: 'Receipt not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let detailPayload: any = null;
    if (isStudentPayment) {
      const { data: payment } = await supabase
        .from('payments')
        .select('amount, payment_date, payment_method, student_id, fee_schedule_id, students(first_name, last_name, matricule), fee_schedules(fee_types(name)), schools(name)')
        .eq('id', receipt.payment_id)
        .single();

      if (!payment) {
        return new Response(
          JSON.stringify({ success: false, message: 'Payment data missing' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      detailPayload = {
        student_name: `${payment.students?.first_name ?? ''} ${payment.students?.last_name ?? ''}`.trim(),
        student_matricule: payment.students?.matricule ?? null,
        amount: payment.amount,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        fee_type: payment.fee_schedules?.fee_types?.name ?? null,
        school_name: payment.schools?.name ?? null,
      };

      if (receipt.receipt_data_hash) {
        const payload = JSON.stringify({
          receiptNumber: receipt.receipt_number,
          paymentId: receipt.payment_id,
          schoolId: receipt.school_id,
          studentId: payment.student_id,
          feeScheduleId: payment.fee_schedule_id,
          amount: payment.amount,
          paymentDate: payment.payment_date,
          paymentMethod: payment.payment_method,
        });

        const computedHash = await sha256Hex(payload);
        if (computedHash !== receipt.receipt_data_hash) {
          return new Response(
            JSON.stringify({ success: false, message: 'Receipt data mismatch' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      const { data: entry } = await supabase
        .from('payroll_entries')
        .select('net_amount, payroll_periods(name), teacher:users(first_name, last_name), schools(name)')
        .eq('id', receipt.payroll_entry_id)
        .single();

      if (entry) {
        detailPayload = {
          teacher_name: `${entry.teacher?.first_name ?? ''} ${entry.teacher?.last_name ?? ''}`.trim(),
          amount: entry.net_amount,
          period: entry.payroll_periods?.name ?? null,
          school_name: entry.schools?.name ?? null,
        };
      }
    }

    // Log verification
    await supabase
      .from('receipt_verification_tokens')
      .update({ verified_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    await supabase.from('receipt_verification_logs').insert({
      receipt_id: receiptId,
      receipt_type: receiptType,
      token_hash: tokenRecord.token_hash,
      success: true,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent'),
      metadata: { via: 'token' },
    });

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        receipt: {
          receipt_number: receipt.receipt_number || receipt.slip_number,
          school_id: receipt.school_id,
          generated_at: receipt.generated_at,
          status: receipt.status || 'active',
          type: receiptType,
          details: detailPayload,
        },
        message: receipt.status === 'cancelled' ? 'Receipt verified - cancelled' : 'Receipt verified successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error verifying receipt:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
