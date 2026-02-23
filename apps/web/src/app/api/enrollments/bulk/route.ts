import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import { bulkEnrollStudentsSchema } from "@novaconnect/core";
import { getSupabaseClient } from "@novaconnect/data";

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = bulkEnrollStudentsSchema.parse(body);

    const supabase = getSupabaseClient();
    const enrollments = validatedData.studentIds.map((studentId) => ({
      school_id: validatedData.schoolId,
      student_id: studentId,
      class_id: validatedData.classId,
      academic_year_id: validatedData.academicYearId,
      enrollment_date: validatedData.enrollmentDate
        ? new Date(validatedData.enrollmentDate).toISOString()
        : new Date().toISOString(),
    }));

    const { data: result, error } = await supabase
      .from("enrollments")
      .insert(enrollments)
      .select();

    if (error) throw error;

    await createAuditLog({
      userId: user.id,
      schoolId: validatedData.schoolId,
      action: "INSERT",
      resourceType: "enrollments",
      resourceId: null,
      newData: { count: result.length, enrollments: result },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error bulk enrolling students:", error);
    return NextResponse.json(
      { error: error.message || "Failed to bulk enroll students" },
      { status: 500 }
    );
  }
}
