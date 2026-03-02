import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limiting: max 5 activations per hour per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Clean up expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000); // Check every minute

serve(async (req) => {
  try {
    const { license_key, hardware_fingerprint, ip_address } = await req.json();

    if (!license_key || !hardware_fingerprint) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Rate limiting
    const clientIp = ip_address || req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitData = rateLimitMap.get(clientIp);
    const now = Date.now();

    if (rateLimitData) {
      if (now < rateLimitData.resetTime && rateLimitData.count >= 5) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "3600" },
        });
      }
      if (now >= rateLimitData.resetTime) {
        // Reset the counter
        rateLimitMap.set(clientIp, { count: 1, resetTime: now + 3600000 });
      } else {
        rateLimitData.count++;
      }
    } else {
      rateLimitMap.set(clientIp, { count: 1, resetTime: now + 3600000 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get license
    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select(`
        *,
        school:schools(id, name)
      `)
      .eq("license_key", license_key)
      .single();

    if (licenseError || !license) {
      return new Response(JSON.stringify({ error: "Invalid license key" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check license status
    if (license.status === "revoked") {
      return new Response(JSON.stringify({ error: "License has been revoked" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (license.status === "suspended") {
      return new Response(JSON.stringify({ error: "License has been suspended" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
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

      return new Response(JSON.stringify({ error: "License has expired" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check activation limit
    if (license.activation_count >= license.max_activations) {
      // Check if this hardware fingerprint is already activated
      const { data: existingActivation } = await supabase
        .from("license_activations")
        .select("*")
        .eq("license_id", license.id)
        .eq("hardware_fingerprint", hardware_fingerprint)
        .eq("status", "active")
        .single();

      if (existingActivation) {
        // Same machine, allow reactivation
        return new Response(
          JSON.stringify({
            message: "License reactivated successfully",
            license: {
              id: license.id,
              license_key: license.license_key,
              license_type: license.license_type,
              expires_at: license.expires_at,
              school: license.school,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Maximum activation limit reached",
          max_activations: license.max_activations,
          current_activations: license.activation_count,
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create new activation
    const { data: activation, error: activationError } = await supabase
      .from("license_activations")
      .insert({
        license_id: license.id,
        school_id: license.school_id,
        hardware_fingerprint,
        ip_address: clientIp,
        status: "active",
      })
      .select()
      .single();

    if (activationError) {
      return new Response(JSON.stringify({ error: activationError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update license activated_at if first activation
    if (!license.activated_at) {
      await supabase
        .from("licenses")
        .update({ activated_at: new Date().toISOString() })
        .eq("id", license.id);
    }

    return new Response(
      JSON.stringify({
        message: "License activated successfully",
        activation,
        license: {
          id: license.id,
          license_key: license.license_key,
          license_type: license.license_type,
          expires_at: license.expires_at,
          school: license.school,
        },
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
