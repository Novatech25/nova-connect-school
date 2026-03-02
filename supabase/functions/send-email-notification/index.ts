import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "notifications@novaconnect.app";

interface SendEmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
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

// Template HTML de base pour les emails NovaConnectSchool
function generateEmailTemplate(htmlContent: string, subject: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px;
    }
    .content p {
      margin: 0 0 16px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      margin-top: 16px;
    }
    .button:hover {
      background-color: #5568d3;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #6c757d;
      border-top: 1px solid #e9ecef;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>NovaConnectSchool</h1>
    </div>
    <div class="content">
      ${htmlContent}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} NovaConnectSchool. Tous droits réservés.</p>
      <p>
        <a href="${supabaseUrl?.replace('/api', '')}/settings/notifications">Gérer les préférences de notification</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Valider le format d'email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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

    // Vérifier que Resend est configuré
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier l'autorisation (service role uniquement)
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    // Pour les appels internes, on peut utiliser le service role key
    // Vérifier si c'est un appel interne (service role)
    const isInternalCall = token === supabaseServiceKey;

    if (authError && !isInternalCall) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const requestBody: SendEmailRequest = await req.json();

    // Valider les paramètres requis
    if (!requestBody.to || !requestBody.subject || !requestBody.html) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: to, subject, and html are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Normaliser les destinataires en tableau
    const recipients = Array.isArray(requestBody.to) ? requestBody.to : [requestBody.to];

    // Valider chaque adresse email
    const invalidEmails = recipients.filter((email) => !isValidEmail(email));
    if (invalidEmails.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid email addresses",
          invalidEmails,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Générer le template HTML
    const emailHtml = generateEmailTemplate(requestBody.html, requestBody.subject);

    // Initialiser Resend
    const resend = new Resend(resendApiKey);

    // Envoyer l'email
    const { data, error } = await resend.emails.send({
      from: requestBody.from || fromEmail,
      to: recipients,
      subject: requestBody.subject,
      html: emailHtml,
      text: requestBody.text,
      replyTo: requestBody.replyTo,
    });

    // Logger le résultat
    const log: NotificationLog = {
      notification_id: requestBody.notificationId || "",
      channel: "email",
      status: error ? "failed" : "sent",
      error_message: error?.message || error?.toString(),
      sent_at: new Date().toISOString(),
      metadata: {
        recipients,
        message_id: data?.id,
        resend_response: error ? { error } : { data },
      },
    };

    await supabase.from("notification_logs").insert(log);

    if (error) {
      console.error("Email sending error:", error);

      // Vérifier si c'est une erreur temporaire (retry possible)
      const isTemporaryError =
        error.message?.includes("rate limit") ||
        error.message?.includes("timeout") ||
        error.message?.includes("temporarily");

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
          .eq("channel", "email");
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          isTemporaryError,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log("Email sent successfully:", data);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: data?.id,
        recipients,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Send email notification error:", error);

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
