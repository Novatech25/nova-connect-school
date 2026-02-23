import { NextRequest, NextResponse } from "next/server";
import { updatePeriodSchema } from "@novaconnect/core";
import { getSupabaseServerClient } from "@novaconnect/data/client/server";
import { logAudit, camelToSnakeKeys, snakeToCamelKeys } from "@novaconnect/data/helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await (supabase as any)
      .from("periods")
      .select("*, academic_year:academic_years(*)")
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
      .from("periods")
      .select("*")
      .eq("id", params.id)
      .single();

    // Validate with Zod
    const validatedData = updatePeriodSchema.parse(body);

    const { data, error } = await (supabase as any)
      .from("periods")
      .update(camelToSnakeKeys(validatedData))
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await logAudit({
      action: "UPDATE",
      resourceType: "periods",
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
      .from("periods")
      .select("*")
      .eq("id", params.id)
      .single();

    const { error } = await (supabase as any)
      .from("periods")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    // Log audit
    await logAudit({
      action: "DELETE",
      resourceType: "periods",
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
