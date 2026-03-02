// ============================================================================
// Edge Function: Check Mobile Money Transaction Status
// ============================================================================
// Checks the status of a Mobile Money transaction with the provider
// Supports retry mechanism and expiration handling
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { getProvider } from '../_shared/providers/index.ts';

// CORS headers
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

    // 4. Check if already completed
    if (transaction.status === 'success' || transaction.status === 'failed') {
      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: transaction.id,
          status: transaction.status,
          message: `Transaction already ${transaction.status}`,
          can_retry: false,
          completed_at: transaction.completed_at
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check if expired
    const now = new Date();
    const expiresAt = new Date(transaction.expires_at);

    if (now > expiresAt && transaction.status === 'pending') {
      await supabase
        .from('mobile_money_transactions')
        .update({
          status: 'expired',
          completed_at: now.toISOString(),
          error_message: 'Transaction expired waiting for confirmation'
        })
        .eq('id', transaction_id);

      return new Response(
        JSON.stringify({
          success: true,
          transaction_id: transaction.id,
          status: 'expired',
          message: 'Transaction has expired',
          can_retry: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Check retry count
    if (transaction.retry_count >= transaction.max_retries) {
      return new Response(
        JSON.stringify({
          success: false,
          transaction_id: transaction.id,
          status: transaction.status,
          message: 'Maximum retry attempts reached',
          can_retry: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Get provider and check status with provider API
    const provider = transaction.mobile_money_providers;
    const providerInstance = getProvider(provider.provider_code);

    // Increment retry count
    await supabase
      .from('mobile_money_transactions')
      .update({ retry_count: transaction.retry_count + 1 })
      .eq('id', transaction_id);

    // Check status with provider
    let providerStatus;
    try {
      if (!transaction.external_transaction_id) {
        throw new Error('No external transaction ID available');
      }

      providerStatus = await providerInstance.checkStatus(
        provider,
        transaction.external_transaction_id
      );
    } catch (error) {
      console.error('Error checking status with provider:', error);

      return new Response(
        JSON.stringify({
          success: false,
          transaction_id: transaction.id,
          status: transaction.status,
          message: 'Failed to check status with provider',
          error: error instanceof Error ? error.message : 'Unknown error',
          can_retry: transaction.retry_count + 1 < transaction.max_retries
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Update transaction based on provider response
    const updateData: any = {
      metadata: {
        ...transaction.metadata,
        status_checks: [
          ...(transaction.metadata?.status_checks || []),
          {
            timestamp: new Date().toISOString(),
            provider_status: providerStatus.status,
            provider_response: providerStatus.provider_response
          }
        ]
      }
    };

    let newStatus = transaction.status;
    let completedAt = transaction.completed_at;

    if (providerStatus.status === 'success') {
      newStatus = 'success';
      completedAt = providerStatus.completed_at || new Date().toISOString();
      updateData.completed_at = completedAt;
      updateData.error_code = null;
      updateData.error_message = null;
    } else if (providerStatus.status === 'failed') {
      newStatus = 'failed';
      completedAt = new Date().toISOString();
      updateData.completed_at = completedAt;
      updateData.error_code = providerStatus.error_code || 'PAYMENT_FAILED';
      updateData.error_message = providerStatus.error_message || 'Payment failed';
    } else if (providerStatus.status === 'pending') {
      // Still pending, check if expired
      if (now > expiresAt) {
        newStatus = 'expired';
        updateData.completed_at = now.toISOString();
        updateData.error_message = 'Transaction expired waiting for confirmation';
      }
    }

    updateData.status = newStatus;

    // Update transaction
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('mobile_money_transactions')
      .update(updateData)
      .eq('id', transaction_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      throw updateError;
    }

    // 9. Return response
    const isFinal = ['success', 'failed', 'expired'].includes(newStatus);
    const canRetry = !isFinal && transaction.retry_count + 1 < transaction.max_retries;

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: updatedTransaction.id,
        status: newStatus,
        external_status: providerStatus.status,
        message: isFinal
          ? `Transaction ${newStatus}`
          : `Transaction still pending (${transaction.retry_count + 1}/${transaction.max_retries} checks)`,
        can_retry: canRetry,
        completed_at: completedAt,
        provider_response: providerStatus.provider_response
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error checking transaction status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
