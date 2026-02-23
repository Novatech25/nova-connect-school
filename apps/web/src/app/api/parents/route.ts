import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import {
  createParentSchema,
  updateParentSchema,
} from "@novaconnect/core";
import { parentQueries } from "@novaconnect/data";

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    const studentId = searchParams.get("studentId");

    if (!schoolId && !studentId) {
      return NextResponse.json(
        { error: "schoolId or studentId is required" },
        { status: 400 }
      );
    }

    let result;
    if (studentId) {
      result = await parentQueries.getByStudentId(studentId).queryFn();
    } else {
      result = await parentQueries.getAll(schoolId!).queryFn();
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching parents:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch parents" },
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
    const validatedData = createParentSchema.parse(body);

    const result = await parentQueries.create().mutationFn(validatedData);

    await createAuditLog({
      userId: user.id,
      schoolId: validatedData.schoolId,
      action: "INSERT",
      resourceType: "parents",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create parent" },
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
    const validatedData = updateParentSchema.parse(body);

    const result = await parentQueries.update().mutationFn(validatedData);

    await createAuditLog({
      userId: user.id,
      schoolId: result.schoolId,
      action: "UPDATE",
      resourceType: "parents",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update parent" },
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

    await parentQueries.delete().mutationFn(id);

    await createAuditLog({
      userId: user.id,
      schoolId: null,
      action: "DELETE",
      resourceType: "parents",
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete parent" },
      { status: 500 }
    );
  }
}
