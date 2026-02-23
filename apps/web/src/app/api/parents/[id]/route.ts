import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import { parentQueries } from "@novaconnect/data";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await parentQueries.getById(params.id).queryFn();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch parent" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = { id: params.id, ...body };

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await parentQueries.delete().mutationFn(params.id);

    await createAuditLog({
      userId: user.id,
      schoolId: null,
      action: "DELETE",
      resourceType: "parents",
      resourceId: params.id,
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
