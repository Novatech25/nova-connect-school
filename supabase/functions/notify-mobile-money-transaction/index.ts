// ============================================================================
// Edge Function: Notify Mobile Money Transaction
// ============================================================================
// Sends notifications for Mobile Money transaction events
// Supports in-app, push, and email notifications
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  transaction_id: string;
  event_type: 'initiated' | 'pending' | 'success' | 'failed' | 'expired' | 'reconciled';
  custom_message?: string;
}

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
    const { transaction_id, event_type, custom_message }: NotificationRequest = await req.json();

    if (!transaction_id || !event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: transaction_id, event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Create service role client for privileged operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Get transaction details with school access control
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

    // 6. Get transaction details
    const { data: transaction, error: transactionError } = await supabase
      .from('mobile_money_transactions')
      .select(`
        *,
        mobile_money_providers (
          provider_name,
          provider_code
        ),
        students (
          id,
          first_name,
          last_name,
          student_id
        ),
        fee_schedules (
          fee_type
        )
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

    // 7. Get student's parents for notification
    const { data: parents } = await supabase
      .from('student_parents')
      .select(`
        parent_id,
        users (
          id,
          email,
          phone,
          first_name,
          last_name
        )
      `)
      .eq('student_id', transaction.student_id);

    const parentIds = parents?.map(p => p.users?.id).filter(Boolean) || [];

    // 8. Get notification preferences for parents
    const { data: notificationPrefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('school_id', schoolId)
      .in('user_id', parentIds);

    // 9. Build notification content based on event type
    const notificationContent = buildNotificationContent(event_type, transaction, custom_message);

    // 10. Send notifications to parents
    const notificationResults = [];

    for (const parent of parents || []) {
      if (!parent.users) continue;

      const prefs = notificationPrefs?.find(p => p.user_id === parent.users.id);
      if (!prefs?.enabled) continue; // Skip if notifications disabled

      const result = await sendNotification(
        supabase,
        schoolId,
        parent.users.id,
        notificationContent,
        prefs,
        transaction
      );

      notificationResults.push(result);
    }

    // 11. Notify accountants if payment failed
    if (event_type === 'failed' || event_type === 'expired') {
      const { data: accountants } = await supabase
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'accountant');

      for (const accountant of accountants || []) {
        await sendNotification(
          supabase,
          schoolId,
          accountant.id,
          {
            title: `Paiement Mobile Money échoué`,
            body: `Le paiement de ${transaction.amount} ${transaction.currency} pour l'élève ${transaction.students?.first_name} ${transaction.students?.last_name} a échoué.`,
            type: 'mobile_money_failed',
            data: {
              transaction_id: transaction.id,
              student_id: transaction.student_id,
              amount: transaction.amount
            }
          },
          {
            in_app: true,
            email: false,
            push: false
          },
          transaction
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notifications sent successfully',
        notified_parents: notificationResults.filter(r => r.success).length,
        results: notificationResults
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function buildNotificationContent(
  event_type: string,
  transaction: any,
  custom_message?: string
) {
  const studentName = `${transaction.students?.first_name || ''} ${transaction.students?.last_name || ''}`.trim();
  const providerName = transaction.mobile_money_providers?.provider_name || 'Mobile Money';
  const amount = `${transaction.amount?.toLocaleString('fr-FR')} ${transaction.currency}`;

  switch (event_type) {
    case 'initiated':
      return {
        title: 'Paiement Mobile Money initié',
        body: `Vous avez initié un paiement de ${amount} pour ${studentName} via ${providerName}. Veuillez compléter le paiement sur votre téléphone.`,
        type: 'mobile_money_initiated',
        data: {
          transaction_id: transaction.id,
          student_id: transaction.student_id,
          amount: transaction.amount
        }
      };

    case 'pending':
      return {
        title: 'Paiement en attente',
        body: `Votre paiement de ${amount} pour ${studentName} est en attente de confirmation.`,
        type: 'mobile_money_pending',
        data: {
          transaction_id: transaction.id,
          student_id: transaction.student_id,
          amount: transaction.amount
        }
      };

    case 'success':
      return {
        title: 'Paiement réussi !',
        body: `Votre paiement de ${amount} pour ${studentName} a été confirmé avec succès.`,
        type: 'mobile_money_success',
        data: {
          transaction_id: transaction.id,
          student_id: transaction.student_id,
          amount: transaction.amount,
          payment_id: transaction.payment_id
        }
      };

    case 'failed':
      return {
        title: 'Paiement échoué',
        body: custom_message || `Votre paiement de ${amount} pour ${studentName} a échoué. Veuillez réessayer.`,
        type: 'mobile_money_failed',
        data: {
          transaction_id: transaction.id,
          student_id: transaction.student_id,
          amount: transaction.amount,
          error_code: transaction.error_code
        }
      };

    case 'expired':
      return {
        title: 'Paiement expiré',
        body: `Votre paiement de ${amount} pour ${studentName} a expiré. Veuillez réessayer.`,
        type: 'mobile_money_expired',
        data: {
          transaction_id: transaction.id,
          student_id: transaction.student_id,
          amount: transaction.amount
        }
      };

    case 'reconciled':
      return {
        title: 'Paiement réconcilié',
        body: `Le paiement de ${amount} pour ${studentName} a été réconcilié avec succès.`,
        type: 'mobile_money_reconciled',
        data: {
          transaction_id: transaction.id,
          student_id: transaction.student_id,
          amount: transaction.amount,
          payment_id: transaction.payment_id
        }
      };

    default:
      return {
        title: 'Notification Mobile Money',
        body: custom_message || `Une mise à jour est disponible pour votre paiement de ${amount}.`,
        type: 'mobile_money_update',
        data: {
          transaction_id: transaction.id
        }
      };
  }
}

async function sendNotification(
  supabase: any,
  schoolId: string,
  userId: string,
  content: any,
  prefs: any,
  transaction: any
) {
  const results = {
    in_app: false,
    email: false,
    push: false,
    success: false
  };

  try {
    // In-app notification
    if (prefs.in_app) {
      const { error: inAppError } = await supabase
        .from('notifications')
        .insert({
          school_id: schoolId,
          user_id: userId,
          title: content.title,
          message: content.body,
          type: content.type,
          data: content.data,
          read: false,
          created_at: new Date().toISOString()
        });

      if (!inAppError) {
        results.in_app = true;
      }
    }

    // Email notification (would integrate with email service)
    if (prefs.email && prefs.email_address) {
      // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
      // For now, just log
      console.log(`[EMAIL] To: ${prefs.email_address}, Subject: ${content.title}`);
      results.email = true;
    }

    // Push notification (would integrate with FCM/OneSignal)
    if (prefs.push && prefs.push_token) {
      // TODO: Integrate with push notification service
      // For now, just log
      console.log(`[PUSH] To: ${userId}, Title: ${content.title}`);
      results.push = true;
    }

    results.success = results.in_app || results.email || results.push;
  } catch (error) {
    console.error('Error sending notification to user', userId, error);
  }

  return results;
}
