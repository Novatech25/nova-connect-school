import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:" + (Deno.env.get("TWILIO_PHONE_NUMBER") || "");

interface SendSMSRequest {
  to: string;
  message: string;
  channel: "sms" | "whatsapp";
  notificationId?: string;
}

interface NotificationLog {
  notification_id: string;
  channel: string;
  status: string;
  error_message?: string;
  sent_at: string;
  metadata: Record<string, unknown>;
}

// Normaliser le numéro de téléphone au format international
function normalizePhoneNumber(phone: string): string {
  // Supprimer tous les caractères non numériques
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Ajouter le préfixe + si absent
  if (!cleaned.startsWith("+")) {
    // Si le numéro commence par 00, remplacer par +
    if (cleaned.startsWith("00")) {
      cleaned = "+" + cleaned.substring(2);
    } else {
      // Sinon, on suppose que c'est un numéro local ou à format international
      cleaned = "+" + cleaned;
    }
  }

  return cleaned;
}

// Valider le numéro de téléphone (format E.164)
function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Format E.164: commence par + et contient 10-15 chiffres
  const phoneRegex = /^\+\d{10,15}$/;
  return phoneRegex.test(normalized);
}

// Tronquer le message si trop long pour SMS (160 caractères)
function truncateSMSMessage(message: string, maxLength: number = 160): string {
  if (message.length <= maxLength) {
    return message;
  }
  return message.substring(0, maxLength - 3) + "...";
}

// Envoyer via l'API Twilio REST
async function sendViaTwilio(
  to: string,
  message: string,
  channel: "sms" | "whatsapp"
): Promise<{ success: boolean; messageId?: string; error?: string; cost?: number }> {
  try {
    // Normaliser le destinataire selon le canal
    let normalizedTo = normalizePhoneNumber(to);
    if (channel === "whatsapp") {
      if (!normalizedTo.startsWith("whatsapp:")) {
        normalizedTo = "whatsapp:" + normalizedTo;
      }
    }

    // Déterminer le numéro d'envoi selon le canal
    let fromNumber = channel === "whatsapp" ? twilioWhatsAppNumber : twilioPhoneNumber;
    if (channel === "whatsapp" && !fromNumber.startsWith("whatsapp:")) {
      fromNumber = "whatsapp:" + fromNumber;
    }

    // Construire les paramètres pour l'API Twilio
    const params = new URLSearchParams({
      To: normalizedTo,
      From: fromNumber || "",
      Body: channel === "sms" ? truncateSMSMessage(message) : message,
    });

    // Appeler l'API Twilio REST
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const result = await response.json();

    if (response.ok && result.sid) {
      // Calculer le coût estimé (varie selon le pays et le canal)
      const estimatedCost = channel === "sms" ? 0.0075 : 0.05; // USD estimé

      return {
        success: true,
        messageId: result.sid,
        cost: estimatedCost,
      };
    } else {
      return {
        success: false,
        error: result.message || result.error_message || "Twilio API error",
      };
    }
  } catch (error) {
    console.error("Twilio API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

serve(async (req) => {
  try {
    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Vérifier que Twilio est configuré
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return new Response(
        JSON.stringify({ error: "SMS/WhatsApp service not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier l'autorisation (service role uniquement)
    const token = authHeader.replace("Bearer ", "");
    const isInternalCall = token === supabaseServiceKey;

    if (!isInternalCall) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const requestBody: SendSMSRequest = await req.json();

    // Valider les paramètres requis
    if (!requestBody.to || !requestBody.message || !requestBody.channel) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: to, message, and channel are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Valider le canal
    if (!["sms", "whatsapp"].includes(requestBody.channel)) {
      return new Response(
        JSON.stringify({ error: "Invalid channel. Must be 'sms' or 'whatsapp'" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Valider le numéro de téléphone
    if (!isValidPhoneNumber(requestBody.to)) {
      return new Response(
        JSON.stringify({
          error: "Invalid phone number format. Must be in E.164 format (e.g., +1234567890)",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Vérifier la longueur du message pour SMS
    const messageLength = requestBody.message.length;
    if (requestBody.channel === "sms" && messageLength > 160) {
      console.warn(`SMS message exceeds 160 characters (${messageLength} chars). Will be truncated.`);
    }

    // Pour WhatsApp, vérifier si le numéro est enregistré sur WhatsApp
    // Note: Twilio renverra une erreur si le numéro n'est pas inscrit

    // Envoyer le message
    const result = await sendViaTwilio(
      requestBody.to,
      requestBody.message,
      requestBody.channel
    );

    // Logger le résultat
    const log: NotificationLog = {
      notification_id: requestBody.notificationId || "",
      channel: requestBody.channel,
      status: result.success ? "sent" : "failed",
      error_message: result.error,
      sent_at: new Date().toISOString(),
      metadata: {
        to: requestBody.to,
        message: requestBody.message,
        message_length: messageLength,
        truncated: requestBody.channel === "sms" && messageLength > 160,
        message_id: result.messageId,
        estimated_cost_usd: result.cost,
        twilio_response: result,
      },
    };

    await supabase.from("notification_logs").insert(log);

    if (!result.success) {
      console.error(`${requestBody.channel.toUpperCase()} sending error:`, result.error);

      // Vérifier si c'est une erreur temporaire (retry possible)
      const isTemporaryError =
        result.error?.includes("rate limit") ||
        result.error?.includes("timeout") ||
        result.error?.includes("temporarily") ||
        result.error?.includes("queued");

      if (isTemporaryError && requestBody.notificationId) {
        // Marquer pour retry automatique
        await supabase
          .from("notification_logs")
          .update({
            metadata: {
              ...log.metadata,
              should_retry: true,
              retry_after: "5m",
            },
          })
          .eq("notification_id", requestBody.notificationId)
          .eq("channel", requestBody.channel);
      }

      // Erreurs spécifiques à WhatsApp
      if (requestBody.channel === "whatsapp") {
        if (result.error?.includes("has no WhatsApp account") || result.error?.includes("not subscribed")) {
          // Le numéro n'est pas inscrit à WhatsApp - pas de retry
          return new Response(
            JSON.stringify({
              success: false,
              error: "Phone number not registered on WhatsApp",
              isPermanentError: true,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          isTemporaryError,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`${requestBody.channel.toUpperCase()} sent successfully:`, result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        to: requestBody.to,
        channel: requestBody.channel,
        estimatedCost: result.cost,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Send SMS/WhatsApp notification error:", error);

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
