import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { schoolSettingsSchema } from "@novaconnect/core/schemas";
import { createServiceClient, getSupabaseServerClient } from "@novaconnect/data/client/server";
import type { Database } from "@novaconnect/data/types";
import { logAudit } from "@novaconnect/data/helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as any)
      .from("schools")
      .select("settings")
      .eq("id", schoolId)
      .single();

    if (error) throw error;

    // Return settings or empty object if null
    const settings = data?.settings || {};
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser();
    const body: unknown = await request.json();
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");

    console.log('[SETTINGS PUT] Cookie user:', cookieUser ? 'YES' : 'NO', cookieUser?.id);

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    let authUser = cookieUser;
    let accessToken = "";

    // If no user from cookies, try Authorization header
    if (!authUser) {
      const authHeader = request.headers.get("authorization") || "";
      console.log('[SETTINGS PUT] Auth header:', authHeader ? 'Present (' + authHeader.substring(0, 50) + '...)' : 'NOT PRESENT');
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : "";

      console.log('[SETTINGS PUT] Token from header:', token ? token.substring(0, 50) + '...' : 'NO TOKEN');

      if (token) {
        const { data: { user: headerUser }, error: headerError } = await supabase.auth.getUser(token);
        if (headerError) {
          console.log('[SETTINGS PUT] Token lookup failed:', headerError.message);
        }
        if (headerUser) {
          authUser = headerUser;
          accessToken = token;
        }
      }
    }

    if (!authUser) {
      console.log('[SETTINGS PUT] AUTH FAILED - No user found');
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('[SETTINGS PUT] AUTH SUCCESS for user:', authUser.id);

    const userRole = (authUser.user_metadata?.role as string) || "";
    let resolvedSchoolId =
      (authUser.user_metadata as any)?.schoolId ||
      (authUser.user_metadata as any)?.school_id ||
      (authUser.app_metadata as any)?.schoolId ||
      (authUser.app_metadata as any)?.school_id ||
      null;

    if (!resolvedSchoolId) {
      if (accessToken && supabaseUrl && supabaseAnonKey) {
        const tokenClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        const { data: userRow, error: userError } = await tokenClient
          .from("users")
          .select("school_id")
          .eq("id", authUser.id)
          .single();
        if (userError) throw userError;
        resolvedSchoolId = userRow?.school_id ?? null;
      } else {
        const { data: userRow, error: userError } = await (supabase as any)
          .from("users")
          .select("school_id")
          .eq("id", authUser.id)
          .single();
        if (userError) throw userError;
        resolvedSchoolId = userRow?.school_id ?? null;
      }
    }

    if (userRole !== "super_admin" && resolvedSchoolId !== schoolId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Validate with Zod
    const validatedData = schoolSettingsSchema.partial().parse(body);

    // Get current settings
    const { data: currentData } = await (supabase as any)
      .from("schools")
      .select("settings")
      .eq("id", schoolId)
      .single();

    const currentSettings = currentData?.settings || {};

    // Merge settings
    const mergedSettings = { ...currentSettings, ...validatedData };

    // Update settings
    console.time("update-settings");
    const serviceClient = createServiceClient();
    const { data, error } = await (serviceClient as any)
      .from("schools")
      .update({
        settings: mergedSettings,
      })
      .eq("id", schoolId)
      .select()
      .single();
    console.timeEnd("update-settings");

    if (error) {
      console.error("Update settings error:", error);
      throw error;
    }

    // Log audit
    console.time("log-audit");
    try {
      await logAudit({
        action: "UPDATE",
        resourceType: "schools",
        resourceId: schoolId,
        oldData: { settings: currentSettings },
        newData: { settings: mergedSettings },
        userId: authUser.id,
        schoolId: schoolId,
      });
    } catch (auditError) {
      console.error("Audit log failed:", auditError);
      // Don't fail the request if audit fails
    }
    console.timeEnd("log-audit");

    // Return updated settings
    return NextResponse.json(data.settings, { status: 200 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
