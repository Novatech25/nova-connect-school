import { NextRequest, NextResponse } from "next/server";
import { updateGradingScaleSchema } from "@novaconnect/core";
import { getSupabaseServerClient } from "@novaconnect/data/client/server";
import { logAudit, camelToSnakeKeys, snakeToCamelKeys } from "@novaconnect/data/helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await (supabase as any)
      .from("grading_scales")
      .select("*")
      .eq("id", params.id)
      .single();

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const body: unknown = await request.json();

    // Get old data for audit
    const { data: oldData } = await (supabase as any)
      .from("grading_scales")
      .select("*")
      .eq("id", params.id)
      .single();

    // Validate with Zod
    const validatedData = updateGradingScaleSchema.parse(body);

    const { data, error } = await (supabase as any)
      .from("grading_scales")
      .update(camelToSnakeKeys(validatedData))
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await logAudit({
      action: "UPDATE",
      resourceType: "grading_scales",
      resourceId: data.id,
      oldData,
      newData: data,
    });

    // Convert snake_case to camelCase for API response
    const camelCaseData = data ? snakeToCamelKeys(data) : data;
    return NextResponse.json(camelCaseData);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServerClient();

    // Get data for audit before deletion
    const { data: oldData } = await (supabase as any)
      .from("grading_scales")
      .select("*")
      .eq("id", params.id)
      .single();

    const { error } = await (supabase as any)
      .from("grading_scales")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    // Log audit
    await logAudit({
      action: "DELETE",
      resourceType: "grading_scales",
      resourceId: params.id,
      oldData,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
