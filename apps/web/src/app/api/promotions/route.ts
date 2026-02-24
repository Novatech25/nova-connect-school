import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database";
import { bulkPromotionRequestSchema } from "@novaconnect/core";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { searchParams } = new URL(request.url);

    const schoolId = searchParams.get("schoolId");
    const currentYearId = searchParams.get("currentYearId");

    if (!schoolId || !currentYearId) {
      return NextResponse.json(
        { error: "Missing required parameters: schoolId and currentYearId" },
        { status: 400 }
      );
    }

    // Get promotion eligibility
    const { data, error } = await supabase.rpc("get_promotion_eligibility", {
      p_school_id: schoolId,
      p_current_year_id: currentYearId,
    });

    if (error) {
      console.error("Error fetching promotion eligibility:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Error in GET /api/promotions:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const body = await request.json();

    // Validate request body
    const validationResult = bulkPromotionRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { schoolId, currentYearId, nextYearId, promotions } = validationResult.data;

    // Verify user has permission to promote students for this school
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's school_id from their profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("user_id", user.id)
      .single();

    const userSchoolId = profile?.school_id;

    // Check if user is super_admin or belongs to the school
    const { data: userRole } = await supabase
      .from("user_role_assignments")
      .select(`
        role_id,
        roles (
          name
        )
      `)
      .eq("user_id", user.id)
      .single();

    const isAdmin = userRole?.roles?.name === "super_admin" || userSchoolId === schoolId;

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You don't have permission to promote students for this school" },
        { status: 403 }
      );
    }

    // Execute bulk promotion
    const { data, error } = await supabase.rpc("promote_students_bulk", {
      p_school_id: schoolId,
      p_current_year_id: currentYearId,
      p_next_year_id: nextYearId,
      p_promotions: promotions,
    });

    if (error) {
      console.error("Error executing bulk promotion:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const results = data as any[];
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      data: {
        total: results.length,
        successful,
        failed,
        results,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/promotions:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
