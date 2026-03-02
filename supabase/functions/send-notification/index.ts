import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendNotificationRequest {
  notifications: Array<{
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    priority?: string;
    channels?: string[];
  }>;
  schoolId: string;
}

interface NotificationLog {
  notification_id: string;
  channel: string;
  status: string;
  error_message?: string;
  sent_at: string;
  metadata: Record<string, unknown>;
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Détecter un appel interne (service role)
    const isInternalCall = token === supabaseServiceKey;

    let user: any = null;
    let userRoles: any[] = [];

    if (isInternalCall) {
      // Appel interne depuis triggers SQL ou cron jobs - autoriser sans vérification user
      console.log("Internal call detected - skipping user auth check");
    } else {
      // Appel normal - vérifier l'authentification et les rôles
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: "Invalid authentication" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      user = authUser;

      // Authorization check: user must have admin or supervisor role
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role, school_id")
        .eq("user_id", user.id);

      if (roleError || !roles || roles.length === 0) {
        return new Response(JSON.stringify({ error: "User roles not found" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      userRoles = roles;

      const hasPermission = userRoles.some(
        (role: any) => ["super_admin", "school_admin", "supervisor"].includes(role.role)
      );

      if (!hasPermission) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions to send notifications" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    const { notifications, schoolId }: SendNotificationRequest = await req.json();

    // Verify school context: user can only send notifications to their own school
    if (!isInternalCall) {
      const userSchoolId = userRoles[0]?.school_id;
      if (!userSchoolId || userSchoolId !== schoolId) {
        return new Response(
          JSON.stringify({ error: "Cannot send notifications to a different school" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } else {
      // Internal call from triggers/cron jobs - trust the provided schoolId
      console.log(`Internal notification batch for school ${schoolId}`);
    }

    if (!notifications || notifications.length === 0) {
      return new Response(JSON.stringify({ error: "No notifications provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Récupérer les préférences des utilisateurs
    const userIds = notifications.map((n) => n.userId);
    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("*")
      .in("user_id", userIds);

    const preferencesMap = new Map(
      preferences?.map((p) => [`${p.user_id}_${p.notification_type}`, p]) || []
    );

    // Créer les notifications en base
    const notificationsToInsert = notifications.map((n) => {
      const pref = preferencesMap.get(`${n.userId}_${n.type}`);

      // Récupérer les canaux depuis les préférences ou utiliser ceux fournis
      let channels = pref?.enabled_channels || n.channels || ["in_app"];

      // Vérifier que enabled_channels n'est pas vide
      if (pref?.enabled_channels && pref.enabled_channels.length === 0) {
        console.warn(`User ${n.userId} has empty enabled_channels for type ${n.type}, using fallback`);
        channels = n.channels || ["in_app"];
      }

      return {
        school_id: schoolId,
        user_id: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data || {},
        priority: n.priority || "normal",
        channels,
      };
    });

    const { data: createdNotifications, error: insertError } = await supabase
      .from("notifications")
      .insert(notificationsToInsert)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create notifications" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Envoyer via Realtime (in_app) - automatique via Supabase
    // Les clients abonnés au canal `notifications:user_id` recevront les nouvelles notifications

    // Envoyer push notifications (Expo)
    const pushNotifications = createdNotifications.filter((n) =>
      n.channels.includes("push")
    );

    if (pushNotifications.length > 0) {
      // Récupérer les push tokens des utilisateurs
      const userIds = pushNotifications.map((n) => n.user_id);
      const { data: users } = await supabase
        .from("users")
        .select("id, metadata")
        .in("id", userIds);

      // Créer un map pour lookup rapide des tokens par user_id
      const userTokenMap = new Map(
        users
          ?.filter((u) => u.metadata?.push_token)
          .map((u) => [u.id, u.metadata.push_token]) || []
      );

      // Construire les push messages directement depuis createdNotifications
      // Chaque notification correspond à exactement un push message
      const pushMessagesWithNotificationId = pushNotifications
        .filter((n) => userTokenMap.has(n.user_id))
        .map((notification) => ({
          notificationId: notification.id,
          pushMessage: {
            to: userTokenMap.get(notification.user_id),
            sound: "default",
            title: notification.title,
            body: notification.body,
            data: notification.data,
            priority: notification.priority === "urgent" ? "high" : "default",
          },
        }));

      if (pushMessagesWithNotificationId.length > 0) {
        // Envoyer via Expo Push API
        const expoPushUrl = "https://exp.host/--/api/v2/push/send";
        const pushResponse = await fetch(expoPushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(pushMessagesWithNotificationId.map((item) => item.pushMessage)),
        });

        const pushResult = await pushResponse.json();
        console.log("Push notifications sent:", pushResult);

        // Logger les résultats - chaque log correspond au bon notification_id
        const logs: NotificationLog[] = pushMessagesWithNotificationId.map((item, idx) => ({
          notification_id: item.notificationId,
          channel: "push",
          status: pushResult.data?.[idx]?.status === "ok" ? "sent" : "failed",
          error_message: pushResult.data?.[idx]?.message,
          sent_at: new Date().toISOString(),
          metadata: { ticket_id: pushResult.data?.[idx]?.id },
        }));

        await supabase.from("notification_logs").insert(logs);
      }
    }

    // Envoyer emails
    const emailNotifications = createdNotifications.filter((n) =>
      n.channels.includes("email")
    );

    if (emailNotifications.length > 0) {
      const emailUserIds = emailNotifications.map((n) => n.user_id);
      const { data: emailUsers } = await supabase
        .from("users")
        .select("id, email, first_name, last_name")
        .in("id", emailUserIds);

      for (const notification of emailNotifications) {
        const user = emailUsers?.find((u) => u.id === notification.user_id);
        if (user?.email) {
          try {
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
            console.log("Email sent to user:", user.id, emailResult);
          } catch (error) {
            console.error("Failed to send email to user:", user.id, error);
          }
        }
      }
    }

    // Envoyer SMS
    const smsNotifications = createdNotifications.filter((n) =>
      n.channels.includes("sms")
    );

    if (smsNotifications.length > 0) {
      const smsUserIds = smsNotifications.map((n) => n.user_id);
      const { data: smsUsers } = await supabase
        .from("users")
        .select("id, metadata")
        .in("id", smsUserIds);

      for (const notification of smsNotifications) {
        const user = smsUsers?.find((u) => u.id === notification.user_id);
        const phoneNumber = user?.metadata?.phone_number;

        if (phoneNumber) {
          try {
            const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms-notification`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: phoneNumber,
                message: `${notification.title}\n\n${notification.body}`,
                channel: "sms",
                notificationId: notification.id,
              }),
            });

            const smsResult = await smsResponse.json();
            console.log("SMS sent to user:", user.id, smsResult);
          } catch (error) {
            console.error("Failed to send SMS to user:", user.id, error);
          }
        }
      }
    }

    // Envoyer WhatsApp
    const whatsappNotifications = createdNotifications.filter((n) =>
      n.channels.includes("whatsapp")
    );

    if (whatsappNotifications.length > 0) {
      const whatsappUserIds = whatsappNotifications.map((n) => n.user_id);
      const { data: whatsappUsers } = await supabase
        .from("users")
        .select("id, metadata")
        .in("id", whatsappUserIds);

      for (const notification of whatsappNotifications) {
        const user = whatsappUsers?.find((u) => u.id === notification.user_id);
        const phoneNumber = user?.metadata?.phone_number;

        if (phoneNumber) {
          try {
            const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms-notification`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: phoneNumber,
                message: `*${notification.title}*\n\n${notification.body}`,
                channel: "whatsapp",
                notificationId: notification.id,
              }),
            });

            const whatsappResult = await whatsappResponse.json();
            console.log("WhatsApp sent to user:", user.id, whatsappResult);
          } catch (error) {
            console.error("Failed to send WhatsApp to user:", user.id, error);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: createdNotifications.length,
        notifications: createdNotifications,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Send notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
