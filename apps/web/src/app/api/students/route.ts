import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import {
  createStudentSchema,
  updateStudentSchema,
  bulkEnrollStudentsSchema,
} from "@novaconnect/core";
import { studentQueries } from "@novaconnect/data";

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    const status = searchParams.get("status");
    const classId = searchParams.get("classId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    const filters: { status?: string; classId?: string } = {};
    if (status) filters.status = status;
    if (classId) filters.classId = classId;

    const result = await studentQueries.getAll(schoolId, filters).queryFn();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch students" },
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
    const validatedData = createStudentSchema.parse(body);

    const result = await studentQueries.create().mutationFn(validatedData);

    await createAuditLog({
      userId: user.id,
      schoolId: validatedData.schoolId,
      action: "INSERT",
      resourceType: "students",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create student" },
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
    const validatedData = updateStudentSchema.parse(body);

    const result = await studentQueries.update().mutationFn(validatedData);

    await createAuditLog({
      userId: user.id,
      schoolId: result.schoolId,
      action: "UPDATE",
      resourceType: "students",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update student" },
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

    await studentQueries.delete().mutationFn(id);

    await createAuditLog({
      userId: user.id,
      schoolId: null,
      action: "DELETE",
      resourceType: "students",
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete student" },
      { status: 500 }
    );
  }
}
