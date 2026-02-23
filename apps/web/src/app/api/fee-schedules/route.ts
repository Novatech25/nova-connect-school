import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import {
  createFeeScheduleSchema,
  updateFeeScheduleSchema,
} from "@novaconnect/core";
import { feeScheduleQueries } from "@novaconnect/data";

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    const studentId = searchParams.get("studentId");
    const academicYearId = searchParams.get("academicYearId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    const filters: any = { schoolId };
    if (studentId) filters.studentId = studentId;
    if (academicYearId) filters.academicYearId = academicYearId;

    const result = await feeScheduleQueries.getAll(filters);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching fee schedules:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch fee schedules" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createFeeScheduleSchema.parse(body);

    // Get schoolId from the student
    const { getSupabaseClient } = await import("@novaconnect/data/client");
    const supabase = (await import("@novaconnect/data/client")).getSupabaseClient();
    const { data: student } = await supabase
      .from("students")
      .select("school_id")
      .eq("id", validatedData.studentId)
      .single();

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const result = await feeScheduleQueries.create({
      ...validatedData,
      schoolId: student.school_id,
    });

    await createAuditLog({
      userId: user.id,
      schoolId: student.school_id,
      action: "INSERT",
      resourceType: "fee_schedules",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating fee schedule:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create fee schedule" },
      { status: 500 }
    );
  }
}
