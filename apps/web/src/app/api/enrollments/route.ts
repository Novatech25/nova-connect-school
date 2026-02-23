import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import {
  createEnrollmentSchema,
  updateEnrollmentSchema,
  bulkEnrollStudentsSchema,
} from "@novaconnect/core";
import { enrollmentQueries } from "@novaconnect/data";

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    const academicYearId = searchParams.get("academicYearId");
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");

    if (!schoolId && !studentId && !classId) {
      return NextResponse.json(
        { error: "schoolId, studentId, or classId is required" },
        { status: 400 }
      );
    }

    let result;
    if (studentId) {
      result = await enrollmentQueries.getByStudentId(studentId).queryFn();
    } else if (classId) {
      result = await enrollmentQueries.getByClassId(classId).queryFn();
    } else {
      result = await enrollmentQueries.getAll(
        schoolId!,
        academicYearId || undefined
      ).queryFn();
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching enrollments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch enrollments" },
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
    const validatedData = createEnrollmentSchema.parse(body);

    const result = await enrollmentQueries.create().mutationFn(validatedData);

    await createAuditLog({
      userId: user.id,
      schoolId: validatedData.schoolId,
      action: "INSERT",
      resourceType: "enrollments",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating enrollment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create enrollment" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = updateEnrollmentSchema.parse(body);

    const result = await enrollmentQueries.update().mutationFn(validatedData);

    await createAuditLog({
      userId: user.id,
      schoolId: result.schoolId,
      action: "UPDATE",
      resourceType: "enrollments",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating enrollment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update enrollment" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await enrollmentQueries.delete().mutationFn(id);

    await createAuditLog({
      userId: user.id,
      schoolId: null,
      action: "DELETE",
      resourceType: "enrollments",
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting enrollment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete enrollment" },
      { status: 500 }
    );
  }
}
