import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PayrollNotificationRequest {
  teacherId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  try {
    // This function is called by database triggers, so we use service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { teacherId, title, message, data }: PayrollNotificationRequest = await req.json();

    if (!teacherId || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: teacherId, title, message" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get teacher's push token from users metadata
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, metadata, school_id")
      .eq("id", teacherId)
      .single();

    if (userError || !user) {
      console.error("Teacher not found:", teacherId, userError);
      return new Response(JSON.stringify({ error: "Teacher not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user has push token
    const pushToken = user.metadata?.push_token;

    if (!pushToken) {
      console.log(`No push token found for teacher ${teacherId}, skipping push notification`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "No push token, notification created in database only",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Send push notification via Expo
    const expoPushUrl = "https://exp.host/--/api/v2/push/send";
    const pushMessage = {
      to: pushToken,
      sound: "default",
      title: title,
      body: message,
      data: data || {},
      priority: "default",
    };

    const pushResponse = await fetch(expoPushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(pushMessage),
    });

    const pushResult = await pushResponse.json();
    console.log("Payroll push notification sent:", pushResult);

    // Check if push was successful
    const pushStatus = pushResult.data?.status;

    if (pushStatus === "ok" || pushStatus === "error") {
      // If Expo returns an error (like invalid token), log it
      if (pushStatus === "error") {
        console.error("Push notification error:", pushResult.data?.message);

        // If token is invalid, remove it from user metadata
        if (pushResult.data?.message?.includes("DeviceNotRegistered")) {
          console.log(`Removing invalid push token for teacher ${teacherId}`);
          await supabase
            .from("users")
            .update({
              metadata: {
                ...user.metadata,
                push_token: null,
              },
            })
            .eq("id", teacherId);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pushResult,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Send payroll notification error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
