import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import {
  createFeeTypeSchema,
  updateFeeTypeSchema,
} from "@novaconnect/core";
import { feeTypeQueries } from "@novaconnect/data";

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    const result = await feeTypeQueries.getAll(schoolId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching fee types:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch fee types" },
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
    const validatedData = createFeeTypeSchema.parse(body);

    const result = await feeTypeQueries.create({
      ...validatedData,
      schoolId: body.schoolId,
    });

    await createAuditLog({
      userId: user.id,
      schoolId: body.schoolId,
      action: "INSERT",
      resourceType: "fee_types",
      resourceId: result.id,
      newData: result,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating fee type:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create fee type" },
      { status: 500 }
    );
  }
}
