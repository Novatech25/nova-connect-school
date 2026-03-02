// ============================================================================
// Edge Function: Manual Mobile Money Transaction Reconciliation
// ============================================================================
// Allows accountants/school_admins to manually reconcile transactions
// Creates payment records and links them to fee schedules
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
    const { transaction_id, payment_id, notes } = await req.json();

    if (!transaction_id || !payment_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: transaction_id, payment_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Create service role client for privileged operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Get user's school_id and role
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

    // 6. Get user's role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .eq('school_id', schoolId);

    const roles = userRoles || [];
    const roleIds = roles.map(r => r.role_id);

    const { data: roleData } = await supabase
      .from('roles')
      .select('name')
      .in('id', roleIds.length > 0 ? roleIds : ['00000000-0000-0000-0000-000000000000']); // Dummy ID for empty array

    const roleNames = roleData?.map(r => r.name) || [];

    // Check if user is accountant or school_admin
    if (!roleNames.includes('accountant') && !roleNames.includes('school_admin')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only accountants and school administrators can reconcile transactions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Get transaction details
    const { data: transaction, error: transactionError } = await supabase
      .from('mobile_money_transactions')
      .select('*')
      .eq('id', transaction_id)
      .eq('school_id', schoolId)
      .single();

    if (transactionError || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if transaction is successful
    if (transaction.status !== 'success') {
      return new Response(
        JSON.stringify({ error: 'Only successful transactions can be reconciled', status: transaction.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already reconciled
    if (transaction.payment_id) {
      return new Response(
        JSON.stringify({ error: 'Transaction already reconciled', payment_id: transaction.payment_id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Get payment details to validate
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, fee_schedules (*)')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payment belongs to the same school and student
    if (payment.school_id !== schoolId) {
      return new Response(
        JSON.stringify({ error: 'Payment does not belong to your school' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payment.student_id !== transaction.student_id) {
      return new Response(
        JSON.stringify({ error: 'Payment student does not match transaction student' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 9. Update transaction with payment link
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('mobile_money_transactions')
      .update({
        payment_id: payment_id,
        fee_schedule_id: payment.fee_schedule_id,
        reconciliation_status: 'manual',
        reconciled_at: new Date().toISOString(),
        reconciled_by: user.id,
        metadata: {
          ...transaction.metadata,
          manual_reconciliation_notes: notes
        }
      })
      .eq('id', transaction_id)
      .select()
      .single();

    if (updateError || !updatedTransaction) {
      console.error('Error updating transaction:', updateError);
      throw updateError;
    }

    // 10. Log audit
    await supabase
      .from('audit_logs')
      .insert({
        school_id: schoolId,
        user_id: user.id,
        action: 'INSERT',
        resource_type: 'mobile_money_reconciliation',
        resource_id: transaction_id,
        new_data: {
          payment_id: payment_id,
          fee_schedule_id: payment.fee_schedule_id,
          reconciliation_type: 'manual',
          notes: notes
        }
      });

    // 11. Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Transaction reconciled successfully',
        transaction: updatedTransaction,
        payment: payment
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in manual reconciliation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
