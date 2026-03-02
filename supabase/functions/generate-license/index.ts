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
    const { school_id, license_type, expires_at, max_activations, metadata } = await req.json();

    if (!school_id || !license_type || !expires_at) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify school exists
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, name")
      .eq("id", school_id)
      .single();

    if (schoolError || !school) {
      return new Response(JSON.stringify({ error: "School not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate unique license key
    const licenseKey = await generateLicenseKey(supabase);

    // Create license
    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .insert({
        school_id,
        license_key: licenseKey,
        license_type,
        status: "active",
        expires_at: new Date(expires_at).toISOString(),
        max_activations: max_activations || 1,
        metadata: metadata || {},
        created_by: user.id,
      })
      .select()
      .single();

    if (licenseError) {
      return new Response(JSON.stringify({ error: licenseError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ license }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function generateLicenseKey(supabase: any): Promise<string> {
  let isUnique = false;
  let licenseKey = "";

  while (!isUnique) {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      const segment = Math.floor(Math.random() * 65536)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0");
      segments.push(segment);
    }
    licenseKey = `NOVA-${segments.join("-")}`;

    // Check if key is unique
    const { data } = await supabase.from("licenses").select("id").eq("license_key", licenseKey).single();

    if (!data) {
      isUnique = true;
    }
  }

  return licenseKey;
}
