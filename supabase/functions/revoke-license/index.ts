import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    // Verify the requestor is a super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user is super admin
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError || userData?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Unauthorized: Super admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { license_id, reason } = await req.json();

    if (!license_id) {
      return new Response(JSON.stringify({ error: "Missing license_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get license
    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select("*")
      .eq("id", license_id)
      .single();

    if (licenseError || !license) {
      return new Response(JSON.stringify({ error: "License not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update license status to revoked
    const { error: updateError } = await supabase
      .from("licenses")
      .update({
        status: "revoked",
        metadata: {
          ...license.metadata,
          revocation_reason: reason || "No reason provided",
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
        },
      })
      .eq("id", license_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Deactivate all active activations for this license
    const { error: activationsError } = await supabase
      .from("license_activations")
      .update({
        status: "deactivated",
        deactivated_at: new Date().toISOString(),
      })
      .eq("license_id", license_id)
      .eq("status", "active");

    if (activationsError) {
      console.error("Error deactivating activations:", activationsError);
    }

    // TODO: Send notification to school (email/push)

    return new Response(
      JSON.stringify({
        message: "License revoked successfully",
        license_id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
