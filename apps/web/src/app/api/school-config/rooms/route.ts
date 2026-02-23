import { NextRequest, NextResponse } from "next/server";
import { createRoomSchema, updateRoomSchema } from "@novaconnect/core";
import { getSupabaseServerClient } from "@novaconnect/data/client/server";
import { logAudit, camelToSnakeKeys, snakeToCamelKeys } from "@novaconnect/data/helpers";

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    const campusId = searchParams.get("campusId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("rooms")
      .select("*, campus:campuses(*)")
      .eq("school_id", schoolId);

    if (campusId) {
      query = query.eq("campus_id", campusId);
    }

    const { data, error } = await query.order("name", { ascending: true });
    if (error) throw error;

    // Convert snake_case to camelCase for API response
    const camelCaseData = data ? snakeToCamelKeys(data) : data;
    return NextResponse.json(camelCaseData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const body: unknown = await request.json();

    // Validate with Zod
    const validatedData = createRoomSchema.parse(body);

    const { data, error } = await (supabase as any)
      .from("rooms")
      .insert(camelToSnakeKeys(validatedData))
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await logAudit({
      action: "INSERT",
      resourceType: "rooms",
      resourceId: data.id,
      newData: data,
    });

    // Convert snake_case to camelCase for API response
    const camelCaseData = snakeToCamelKeys(data);
    return NextResponse.json(camelCaseData, { status: 201 });
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
