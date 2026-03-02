import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface NotificationLog {
  id: string;
  notification_id: string;
  channel: string;
  status: string;
  error_message?: string;
  sent_at: string;
  metadata: Record<string, unknown>;
  retry_count: number;
  next_retry_at: string | null;
}

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

// Calculer le délai avant le prochain retry avec exponential backoff
function calculateNextRetryDelay(retryCount: number): number {
  // Exponential backoff: 5min, 15min, 1h
  const delays = [5, 15, 60]; // en minutes
  return delays[Math.min(retryCount, delays.length - 1)] * 60 * 1000; // en ms
}

// Créer le timestamp du prochain retry
function calculateNextRetryAt(retryCount: number): Date {
  const delay = calculateNextRetryDelay(retryCount);
  return new Date(Date.now() + delay);
}

serve(async (req) => {
  try {
    // Vérifier l'authentification (cron job ou appel interne)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isInternalCall = token === supabaseServiceKey;

    if (!isInternalCall) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting retry of failed notifications...");

    // Récupérer les logs échoués qui peuvent être retryés
    // Conditions:
    // 1. status = 'failed'
    // 2. retry_count < 3
    // 3. Soit next_retry_at est NULL (première tentative), soit next_retry_at <= NOW()
    // 4. Créé il y a au moins 5 minutes (éviter retry immédiat après échec)
    const { data: failedLogs, error: logsError } = await supabase
      .from("notification_logs")
      .select("*")
      .eq("status", "failed")
      .lt("retry_count", 3)
      .or("next_retry_at.is.null,next_retry_at.lte." + new Date().toISOString())
      .lte("sent_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order("sent_at", { ascending: true })
      .limit(100);

    if (logsError) {
      console.error("Error fetching failed logs:", logsError);
      throw logsError;
    }

    if (!failedLogs || failedLogs.length === 0) {
      console.log("No failed notifications to retry");
      return new Response(
        JSON.stringify({
          success: true,
          retried: 0,
          message: "No failed notifications to retry",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${failedLogs.length} failed notifications to retry`);

    let successCount = 0;
    let permanentFailureCount = 0;
    let willRetryCount = 0;

    // Traiter chaque log échoué
    for (const log of failedLogs as unknown as NotificationLog[]) {
      try {
        // Récupérer la notification associée
        const { data: notification, error: notificationError } = await supabase
          .from("notifications")
          .select("*")
          .eq("id", log.notification_id)
          .single();

        if (notificationError || !notification) {
          console.error(`Notification ${log.notification_id} not found, skipping retry`);
          // Marquer comme échec permanent
          await supabase
            .from("notification_logs")
            .update({ retry_count: 3 }) // Marquer comme max retry atteint
            .eq("id", log.id);
          permanentFailureCount++;
          continue;
        }

        let retrySuccess = false;
        let errorMessage: string | undefined;

        // Retry selon le canal
        if (log.channel === "push") {
          retrySuccess = await retryPushNotification(supabase, notification, log);
        } else if (log.channel === "email") {
          retrySuccess = await retryEmailNotification(supabase, notification, log);
        } else if (log.channel === "sms" || log.channel === "whatsapp") {
          retrySuccess = await retrySMSNotification(
            supabase,
            notification,
            log,
            log.channel
          );
        }

        if (retrySuccess) {
          // Marquer comme envoyé avec succès
          await supabase
            .from("notification_logs")
            .update({
              status: "sent",
              retry_count: log.retry_count + 1,
              next_retry_at: null,
              sent_at: new Date().toISOString(),
            })
            .eq("id", log.id);

          successCount++;
          console.log(
            `Successfully retried ${log.channel} notification ${log.notification_id}`
          );
        } else {
          // Calculer le prochain retry ou marquer comme échec permanent
          const newRetryCount = log.retry_count + 1;

          if (newRetryCount >= 3) {
            // Échec permanent
            await supabase
              .from("notification_logs")
              .update({
                retry_count: newRetryCount,
                next_retry_at: null,
                metadata: {
                  ...log.metadata,
                  final_failure: true,
                  total_retries: newRetryCount,
                },
              })
              .eq("id", log.id);

            permanentFailureCount++;
            console.log(
              `Permanent failure for ${log.channel} notification ${log.notification_id} after ${newRetryCount} retries`
            );
          } else {
            // Planifier un prochain retry
            const nextRetryAt = calculateNextRetryAt(newRetryCount);

            await supabase
              .from("notification_logs")
              .update({
                retry_count: newRetryCount,
                next_retry_at: nextRetryAt.toISOString(),
                metadata: {
                  ...log.metadata,
                  next_retry_at: nextRetryAt.toISOString(),
                },
              })
              .eq("id", log.id);

            willRetryCount++;
            console.log(
              `Scheduled next retry (${newRetryCount}/3) for ${log.channel} notification ${log.notification_id} at ${nextRetryAt.toISOString()}`
            );
          }
        }
      } catch (error) {
        console.error(
          `Error retrying notification ${log.notification_id}:`,
          error
        );
        // Continuer avec les autres notifications
      }
    }

    console.log(
      `Retry completed: ${successCount} succeeded, ${willRetryCount} scheduled for retry, ${permanentFailureCount} permanent failures`
    );

    return new Response(
      JSON.stringify({
        success: true,
        retried: failedLogs.length,
        succeeded: successCount,
        willRetry: willRetryCount,
        permanentFailures: permanentFailureCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Retry failed notifications error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

// Fonction helper pour retry push notification
async function retryPushNotification(
  supabase: any,
  notification: Notification,
  log: NotificationLog
): Promise<boolean> {
  try {
    // Récupérer le push token de l'utilisateur
    const { data: user } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", notification.user_id)
      .single();

    const pushToken = user?.metadata?.push_token;
    if (!pushToken) {
      return false;
    }

    // Envoyer via Expo Push API
    const expoPushUrl = "https://exp.host/--/api/v2/push/send";
    const pushResponse = await fetch(expoPushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: notification.data,
      }),
    });

    const pushResult = await pushResponse.json();
    return pushResult.data?.[0]?.status === "ok";
  } catch (error) {
    console.error("Error retrying push notification:", error);
    return false;
  }
}

// Fonction helper pour retry email notification
async function retryEmailNotification(
  supabase: any,
  notification: Notification,
  log: NotificationLog
): Promise<boolean> {
  try {
    // Récupérer l'email de l'utilisateur
    const { data: user } = await supabase
      .from("users")
      .select("email, first_name")
      .eq("id", notification.user_id)
      .single();

    if (!user?.email) {
      return false;
    }

    // Appeler l'Edge Function d'envoi d'email
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: user.email,
        subject: notification.title,
        html: `
          <p>Bonjour ${user.first_name},</p>
          <p>${notification.body}</p>
        `,
        notificationId: notification.id,
      }),
    });

    const emailResult = await emailResponse.json();
    return emailResult.success === true;
  } catch (error) {
    console.error("Error retrying email notification:", error);
    return false;
  }
}

// Fonction helper pour retry SMS/WhatsApp notification
async function retrySMSNotification(
  supabase: any,
  notification: Notification,
  log: NotificationLog,
  channel: "sms" | "whatsapp"
): Promise<boolean> {
  try {
    // Récupérer le numéro de téléphone de l'utilisateur
    const { data: user } = await supabase
      .from("users")
      .select("metadata")
      .eq("id", notification.user_id)
      .single();

    const phoneNumber = user?.metadata?.phone_number;
    if (!phoneNumber) {
      return false;
    }

    // Appeler l'Edge Function d'envoi SMS
    const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: phoneNumber,
        message: channel === "whatsapp"
          ? `*${notification.title}*\n\n${notification.body}`
          : `${notification.title}\n\n${notification.body}`,
        channel: channel,
        notificationId: notification.id,
      }),
    });

    const smsResult = await smsResponse.json();
    return smsResult.success === true;
  } catch (error) {
    console.error(`Error retrying ${channel} notification:`, error);
    return false;
  }
}
