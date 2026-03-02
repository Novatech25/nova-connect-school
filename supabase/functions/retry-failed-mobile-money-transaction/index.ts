// ============================================================================
// Edge Function: Retry Failed Mobile Money Transaction
// ============================================================================
// Retries a failed transaction with the same parameters
// Includes retry count limits and validation
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { getProvider } from '../_shared/providers/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Create authenticated Supabase client
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

    // 2. Get authenticated user
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

    // 3. Parse request
    const { transaction_id } = await req.json();

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: transaction_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Create service role client for privileged operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Get user's school_id
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

    // 6. Get transaction details with school access control
    const { data: transaction, error: transactionError } = await supabase
      .from('mobile_money_transactions')
      .select(`
        *,
        mobile_money_providers (*)
      `)
      .eq('id', transaction_id)
      .eq('school_id', schoolId)
      .single();

    if (transactionError || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if transaction is failed
    if (transaction.status !== 'failed') {
      return new Response(
        JSON.stringify({
          error: 'Only failed transactions can be retried',
          current_status: transaction.status
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check retry count
    if (transaction.retry_count >= transaction.max_retries) {
      return new Response(
        JSON.stringify({
          error: 'Maximum retry attempts reached',
          retry_count: transaction.retry_count,
          max_retries: transaction.max_retries
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if transaction is too old (24 hours)
    const initiatedAt = new Date(transaction.initiated_at);
    const now = new Date();
    const hoursSinceInitiation = (now.getTime() - initiatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceInitiation > 24) {
      return new Response(
        JSON.stringify({
          error: 'Transaction is too old to retry (maximum 24 hours)',
          initiated_at: transaction.initiated_at
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get provider
    const provider = transaction.mobile_money_providers;
    const providerInstance = getProvider(provider.provider_code);

    // Reset transaction to initiated
    const { data: resetTransaction, error: resetError } = await supabase
      .from('mobile_money_transactions')
      .update({
        status: 'initiated',
        error_code: null,
        error_message: null,
        retry_count: transaction.retry_count + 1,
        metadata: {
          ...transaction.metadata,
          retried_at: new Date().toISOString(),
          previous_attempts: (transaction.metadata?.previous_attempts || 0) + 1
        }
      })
      .eq('id', transaction_id)
      .select()
      .single();

    if (resetError) {
      throw resetError;
    }

    // Re-initiate payment with provider
    try {
      const providerResponse = await providerInstance.initiatePayment(
        provider,
        {
          amount: transaction.amount,
          phone_number: transaction.phone_number,
          reference: transaction.transaction_reference,
          currency: transaction.currency,
          metadata: transaction.metadata
        }
      );

      if (providerResponse.success) {
        // Update with new external transaction ID
        await supabase
          .from('mobile_money_transactions')
          .update({
            status: 'pending',
            external_transaction_id: providerResponse.external_transaction_id,
            metadata: {
              ...resetTransaction.metadata,
              retry_response: providerResponse
            }
          })
          .eq('id', transaction_id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Transaction retried successfully',
            transaction_id: transaction_id,
            external_transaction_id: providerResponse.external_transaction_id,
            retry_count: resetTransaction.retry_count
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Retry failed
        await supabase
          .from('mobile_money_transactions')
          .update({
            status: 'failed',
            error_code: providerResponse.error_code,
            error_message: providerResponse.error_details?.message || 'Retry failed'
          })
          .eq('id', transaction_id);

        return new Response(
          JSON.stringify({
            success: false,
            message: 'Retry failed',
            error: providerResponse.error_details
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error: any) {
      // Provider error
      await supabase
        .from('mobile_money_transactions')
        .update({
          status: 'failed',
          error_code: 'RETRY_FAILED',
          error_message: error.message || 'Provider error during retry'
        })
        .eq('id', transaction_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error retrying transaction:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
