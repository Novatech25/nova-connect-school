import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const { license_key, hardware_fingerprint } = await req.json();

    if (!license_key || !hardware_fingerprint) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get license
    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select("*")
      .eq("license_key", license_key)
      .single();

    if (licenseError || !license) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Invalid license key",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check license status
    if (license.status === "revoked") {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "License has been revoked",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (license.status === "suspended") {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "License has been suspended",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if license is expired
    const nowDate = new Date();
    const expiresAt = new Date(license.expires_at);

    if (expiresAt < nowDate) {
      // Update license status to expired
      await supabase
        .from("licenses")
        .update({ status: "expired" })
        .eq("id", license.id);

      return new Response(
        JSON.stringify({
          valid: false,
          error: "License has expired",
          expires_at: license.expires_at,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if there's an active activation for this hardware fingerprint
    const { data: activation } = await supabase
      .from("license_activations")
      .select("*")
      .eq("license_id", license.id)
      .eq("hardware_fingerprint", hardware_fingerprint)
      .eq("status", "active")
      .single();

    if (!activation) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "No activation found for this hardware fingerprint",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // License is valid
    return new Response(
      JSON.stringify({
        valid: true,
        license: {
          id: license.id,
          license_key: license.license_key,
          license_type: license.license_type,
          expires_at: license.expires_at,
          school_id: license.school_id,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        valid: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
