// ============================================================================
// Edge Function: Initiate Mobile Money Payment
// ============================================================================
// Handles initiation of Mobile Money payments from parents/students
// Validates premium access, checks student info, initiates provider payment
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { getProvider } from '../_shared/providers/index.ts';
import { requireMobileMoneyAccess } from '../_shared/premiumCheck.ts';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Create authenticated Supabase client first
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // 2. Parse and validate request with authenticated user
    const {
      data: { user },
      error: authError
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();

    // Validate required fields
    const { student_id, fee_schedule_id, amount, phone_number, provider_code, metadata } =
      requestBody;

    if (!student_id || !amount || !phone_number || !provider_code) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: student_id, amount, phone_number, provider_code'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be a positive number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Create service role client for privileged operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Get user's school_id from authenticated user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.school_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with a school' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schoolId = userData.school_id;

    // 3. Verify premium access
    try {
      await requireMobileMoneyAccess(supabase, schoolId);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Premium feature required'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate student belongs to the school
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id')
      .eq('id', student_id)
      .eq('school_id', schoolId)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: 'Student not found or not in your school' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. If fee_schedule_id provided, validate it and amount
    if (fee_schedule_id) {
      const { data: feeSchedule, error: feeError } = await supabase
        .from('fee_schedules')
        .select('id, amount_due, amount_paid, academic_year_id')
        .eq('id', fee_schedule_id)
        .eq('student_id', student_id)
        .single();

      if (feeError || !feeSchedule) {
        return new Response(
          JSON.stringify({ error: 'Fee schedule not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const remainingBalance = feeSchedule.amount_due - feeSchedule.amount_paid;

      if (amount > remainingBalance) {
        return new Response(
          JSON.stringify({
            error: `Amount exceeds remaining balance of ${remainingBalance} XOF`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Get provider configuration
    const { data: provider, error: providerError } = await supabase
      .from('mobile_money_providers')
      .select('*')
      .eq('school_id', schoolId)
      .eq('provider_code', provider_code)
      .eq('is_active', true)
      .single();

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({
          error: `Provider ${provider_code} not configured or not active`
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount against provider limits
    if (amount < provider.min_amount || amount > provider.max_amount) {
      return new Response(
        JSON.stringify({
          error: `Amount must be between ${provider.min_amount} and ${provider.max_amount} XOF`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Generate unique transaction reference
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const transactionReference = `MM-${schoolId.substring(0, 8)}-${timestamp}-${random}`;

    // 8. Create transaction record with status 'initiated'
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // +15 minutes

    const { data: transaction, error: transactionError } = await supabase
      .from('mobile_money_transactions')
      .insert({
        school_id: schoolId,
        provider_id: provider.id,
        student_id: student_id,
        fee_schedule_id: fee_schedule_id || null,
        transaction_reference: transactionReference,
        phone_number: phone_number,
        amount: amount,
        currency: 'XOF',
        status: 'initiated',
        initiated_at: new Date().toISOString(),
        expires_at: expiresAt,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error('Error creating transaction:', transactionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Initiate payment with provider
    const providerInstance = getProvider(provider_code);

    const providerResponse = await providerInstance.initiatePayment(provider, {
      amount,
      phone_number: phone_number,
      reference: transactionReference,
      currency: 'XOF',
      metadata: {
        student_id,
        student_name: `${student.first_name} ${student.last_name}`,
        fee_schedule_id,
        ...metadata
      }
    });

    // 10. Update transaction with provider response
    if (providerResponse.success) {
      await supabase
        .from('mobile_money_transactions')
        .update({
          external_transaction_id: providerResponse.external_transaction_id,
          status: 'pending',
          metadata: {
            ...transaction.metadata,
            provider_response: providerResponse
          }
        })
        .eq('id', transaction.id);

      // Log successful initiation
      await supabase
        .from('audit_logs')
        .insert({
          school_id: schoolId,
          user_id: user.id,
          action: 'INSERT',
          resource_type: 'mobile_money_transaction',
          resource_id: transaction.id,
          new_data: {
            transaction_reference: transactionReference,
            amount: amount,
            provider_code: provider_code,
            student_id: student_id
          }
        });

      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: transaction.id,
          transaction_reference: transactionReference,
          external_transaction_id: providerResponse.external_transaction_id,
          status: 'pending',
          expires_at: expiresAt,
          payment_instructions: providerResponse.payment_instructions
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Payment initiation failed
      await supabase
        .from('mobile_money_transactions')
        .update({
          status: 'failed',
          error_code: providerResponse.error_code,
          error_message: providerResponse.error_details?.message || 'Payment initiation failed',
          metadata: {
            ...transaction.metadata,
            provider_error: providerResponse.error_details
          }
        })
        .eq('id', transaction.id);

      return new Response(
        JSON.stringify({
          error: 'Payment initiation failed',
          error_code: providerResponse.error_code,
          details: providerResponse.error_details
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Unexpected error in initiate-mobile-money-payment:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
