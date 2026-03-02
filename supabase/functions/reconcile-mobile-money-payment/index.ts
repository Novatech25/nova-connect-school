// ============================================================================
// Edge Function: Reconcile Mobile Money Webhook
// ============================================================================
// Handles webhooks from Mobile Money providers (Orange, Moov, MTN, Wave)
// Verifies signatures, updates transactions, performs automatic reconciliation
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { verifyWebhook, extractTransactionReference, mapProviderStatus } from '../_shared/webhookVerification.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Extract provider code from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const providerCode = pathParts[pathParts.length - 1]; // Last part of path

    console.log(`Processing webhook for provider: ${providerCode}`);

    // 2. Get webhook signature from headers (provider-specific)
    const signatureHeaders = [
      req.headers.get('x-orange-signature'),
      req.headers.get('x-moov-signature'),
      req.headers.get('x-mtn-signature'),
      req.headers.get('x-wave-signature'),
      req.headers.get('signature')
    ].filter(Boolean);

    const signature = signatureHeaders[0] || '';
    const payload = await req.json();

    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    // 3. Get provider configuration to verify signature
    const { data: providers, error: providerError } = await supabase
      .from('mobile_money_providers')
      .select('*')
      .eq('provider_code', providerCode)
      .eq('is_active', true);

    if (providerError || !providers || providers.length === 0) {
      console.error('Provider not found:', providerCode);
      return new Response(
        JSON.stringify({ error: 'Provider not configured or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try each provider configuration (in case multiple schools have the same provider)
    let verifiedProvider = null;
    let verificationResult = null;

    for (const provider of providers) {
      try {
        verificationResult = await verifyWebhook(provider, signature, payload);
        if (verificationResult.valid) {
          verifiedProvider = provider;
          break;
        }
      } catch (error) {
        console.error(`Signature verification failed for provider ${provider.id}:`, error);
        continue;
      }
    }

    if (!verifiedProvider) {
      console.error('Signature verification failed for all providers');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Webhook verified for provider: ${verifiedProvider.provider_name}`);

    // 4. Extract transaction identifiers
    const externalTransactionId = verificationResult.external_transaction_id ||
      payload.transaction_id ||
      payload.id;
    const transactionReference = extractTransactionReference(payload, providerCode);

    // 5. Find transaction by external_transaction_id or transaction_reference
    let transaction = null;

    if (externalTransactionId) {
      const { data } = await supabase
        .from('mobile_money_transactions')
        .select('*')
        .eq('external_transaction_id', externalTransactionId)
        .single();
      transaction = data;
    }

    if (!transaction && transactionReference) {
      const { data } = await supabase
        .from('mobile_money_transactions')
        .select('*')
        .eq('transaction_reference', transactionReference)
        .single();
      transaction = data;
    }

    // 6. Idempotence check - if webhook already processed, return success
    if (transaction && transaction.webhook_received_at) {
      console.log(`Webhook already processed for transaction ${transaction.id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook already processed',
          transaction_id: transaction.id,
          status: transaction.status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Map provider status to internal status
    const providerStatus = verificationResult.status || payload.status;
    const internalStatus = mapProviderStatus(providerStatus, providerCode);

    console.log(`Provider status: ${providerStatus} -> Internal status: ${internalStatus}`);

    // 8. If transaction found, update it
    if (transaction) {
      const updateData: any = {
        status: internalStatus,
        webhook_received_at: new Date().toISOString(),
        metadata: {
          ...transaction.metadata,
          webhook_payload: payload,
          provider_status: providerStatus
        }
      };

      if (internalStatus === 'success') {
        updateData.completed_at = new Date().toISOString();
      } else if (internalStatus === 'failed') {
        updateData.completed_at = new Date().toISOString();
        updateData.error_code = payload.error_code || 'PAYMENT_FAILED';
        updateData.error_message = payload.error_message || 'Payment failed';
      }

      const { data: updatedTransaction, error: updateError } = await supabase
        .from('mobile_money_transactions')
        .update(updateData)
        .eq('id', transaction.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating transaction:', updateError);
        throw updateError;
      }

      console.log(`Transaction updated: ${updatedTransaction.id}`);

      // 9. Automatic reconciliation if payment succeeded
      if (internalStatus === 'success' && !transaction.payment_id) {
        const reconciliationSuccess = await performAutomaticReconciliation(
          supabase,
          updatedTransaction,
          payload
        );

        if (reconciliationSuccess) {
          console.log(`Automatic reconciliation successful for transaction ${updatedTransaction.id}`);
        } else {
          console.log(`Automatic reconciliation pending for transaction ${updatedTransaction.id}`);
        }
      }

      // 10. Send notification
      if (internalStatus === 'success' || internalStatus === 'failed') {
        await sendPaymentNotification(supabase, transaction, internalStatus);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook processed successfully',
          transaction_id: transaction.id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 11. If transaction not found by ID, try phone number lookup (legacy support)
    const phoneNumber = payload.phone_number || payload.customer_msisdn || payload.msisdn;

    if (phoneNumber && internalStatus === 'success') {
      console.log('Transaction not found, attempting phone number lookup');

      const { data: students } = await supabase
        .from('students')
        .select('id, school_id')
        .eq('phone', phoneNumber)
        .limit(1);

      if (students && students.length > 0) {
        const student = students[0];

        // Create transaction record for this webhook
        const { data: newTransaction } = await supabase
          .from('mobile_money_transactions')
          .insert({
            school_id: student.school_id,
            provider_id: verifiedProvider.id,
            student_id: student.id,
            transaction_reference: `MM-WEBHOOK-${Date.now()}`,
            external_transaction_id: externalTransactionId,
            phone_number: phoneNumber,
            amount: verificationResult.amount || payload.amount,
            currency: 'XOF',
            status: 'success',
            initiated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            webhook_received_at: new Date().toISOString(),
            reconciliation_status: 'pending',
            metadata: {
              webhook_payload: payload,
              created_from_webhook: true
            }
          })
          .select()
          .single();

        // Attempt automatic reconciliation
        await performAutomaticReconciliation(supabase, newTransaction, payload);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Transaction created from webhook',
            transaction_id: newTransaction.id
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 12. If we reach here, transaction could not be reconciled
    console.error('Could not reconcile webhook - no matching transaction found');
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Could not match webhook to any transaction',
        external_transaction_id: externalTransactionId
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Perform automatic reconciliation for a successful transaction
 */
async function performAutomaticReconciliation(
  supabase: any,
  transaction: any,
  webhookPayload: any
): Promise<boolean> {
  try {
    let feeScheduleId = transaction.fee_schedule_id;

    // If no fee_schedule_id in transaction, try to find one
    if (!feeScheduleId) {
      const { data: pendingSchedules } = await supabase
        .from('fee_schedules')
        .select('*')
        .eq('student_id', transaction.student_id)
        .in('status', ['pending', 'partial'])
        .order('due_date', { ascending: true })
        .limit(1);

      if (pendingSchedules && pendingSchedules.length > 0) {
        feeScheduleId = pendingSchedules[0].id;
      }
    }

    // If still no fee schedule, mark as pending manual reconciliation
    if (!feeScheduleId) {
      await supabase
        .from('mobile_money_transactions')
        .update({ reconciliation_status: 'pending' })
        .eq('id', transaction.id);

      return false;
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        school_id: transaction.school_id,
        student_id: transaction.student_id,
        fee_schedule_id: feeScheduleId,
        amount: transaction.amount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'mobile_money',
        reference_number: transaction.transaction_reference,
        received_by: null,
        notes: `Mobile Money payment - Provider: ${transaction.provider_id}`,
        metadata: {
          mobile_money_transaction_id: transaction.id,
          external_transaction_id: transaction.external_transaction_id,
          provider_code: webhookPayload.provider_code
        }
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      await supabase
        .from('mobile_money_transactions')
        .update({ reconciliation_status: 'failed' })
        .eq('id', transaction.id);
      return false;
    }

    // Update fee_schedule
    await supabase.rpc('update_fee_schedule_payment', {
      p_fee_schedule_id: feeScheduleId,
      p_payment_amount: transaction.amount
    });

    // Update transaction with payment_id and reconciliation status
    await supabase
      .from('mobile_money_transactions')
      .update({
        payment_id: payment.id,
        fee_schedule_id: feeScheduleId,
        reconciliation_status: 'auto',
        reconciled_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    // Generate receipt
    await supabase.functions.invoke('generate-payment-receipt', {
      body: { paymentId: payment.id }
    });

    // Log audit
    await supabase
      .from('audit_logs')
      .insert({
        school_id: transaction.school_id,
        action: 'INSERT',
        resource_type: 'mobile_money_reconciliation',
        resource_id: transaction.id,
        new_data: {
          payment_id: payment.id,
          fee_schedule_id: feeScheduleId,
          reconciliation_type: 'automatic'
        }
      });

    return true;
  } catch (error) {
    console.error('Error in automatic reconciliation:', error);
    await supabase
      .from('mobile_money_transactions')
      .update({ reconciliation_status: 'failed' })
      .eq('id', transaction.id);
    return false;
  }
}

/**
 * Send payment notification to student/parent
 */
async function sendPaymentNotification(
  supabase: any,
  transaction: any,
  status: string
): Promise<void> {
  try {
    const { data: student } = await supabase
      .from('students')
      .select('user_id')
      .eq('id', transaction.student_id)
      .single();

    if (!student?.user_id) {
      return;
    }

    let title, body;

    if (status === 'success') {
      title = 'Paiement reçu';
      body = `Votre paiement de ${transaction.amount.toLocaleString('fr-FR')} FCFA a été confirmé avec succès.`;
    } else {
      title = 'Paiement échoué';
      body = `Votre paiement de ${transaction.amount.toLocaleString('fr-FR')} FCFA a échoué. Veuillez réessayer.`;
    }

    await supabase.functions.invoke('send-notification', {
      body: {
        notifications: [{
          userId: student.user_id,
          type: status === 'success' ? 'payment_confirmed' : 'payment_failed',
          title,
          body,
          data: {
            transactionId: transaction.id,
            amount: transaction.amount,
            status: status
          },
          priority: status === 'success' ? 'normal' : 'high',
          channels: ['in_app', 'push']
        }],
        schoolId: transaction.school_id
      }
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}
