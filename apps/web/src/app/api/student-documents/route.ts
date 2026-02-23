import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import {
  createStudentDocumentSchema,
  updateStudentDocumentSchema,
} from "@novaconnect/core";
import { studentDocumentQueries } from "@novaconnect/data";

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }

    const result = await studentDocumentQueries.getByStudentId(
      studentId
    ).queryFn();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching student documents:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch student documents" },
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
    const validatedData = createStudentDocumentSchema.parse(body);

    const result = await studentDocumentQueries.create().mutationFn(
      validatedData
    );

    await createAuditLog({
      userId: user.id,
      schoolId: validatedData.schoolId,
      action: "INSERT",
      resourceType: "student_documents",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating student document:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create student document" },
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

    await studentDocumentQueries.delete().mutationFn(id);

    await createAuditLog({
      userId: user.id,
      schoolId: null,
      action: "DELETE",
      resourceType: "student_documents",
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting student document:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete student document" },
      { status: 500 }
    );
  }
}
