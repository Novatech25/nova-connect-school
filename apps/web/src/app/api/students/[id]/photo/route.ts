import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { createAuditLog } from "@novaconnect/data";
import { studentQueries } from "@novaconnect/data";
import { uploadStudentPhoto, deleteStudentPhoto } from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get student to retrieve schoolId
    const student = await studentQueries.getById(params.id).queryFn();

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Delete old photo if exists
    if (student.photoUrl) {
      try {
        await deleteStudentPhoto(student.photoUrl);
      } catch (error) {
        console.error("Error deleting old photo:", error);
      }
    }

    // Upload new photo
    const { url: photoUrl } = await uploadStudentPhoto(
      student.schoolId,
      student.id,
      file
    );

    // Update student record
    const result = await studentQueries.update().mutationFn({
      id: params.id,
      photoUrl,
    });

    await createAuditLog({
      userId: user.id,
      schoolId: student.schoolId,
      action: "UPDATE",
      resourceType: "students",
      resourceId: params.id,
      newData: { photoUrl },
    });

    return NextResponse.json({ photoUrl });
  } catch (error: any) {
    console.error("Error uploading photo:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload photo" },
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

    // Get student to retrieve photoUrl
    const student = await studentQueries.getById(params.id).queryFn();

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (!student.photoUrl) {
      return NextResponse.json({ error: "No photo to delete" }, { status: 400 });
    }

    // Delete photo from storage
    await deleteStudentPhoto(student.photoUrl);

    // Update student record
    const result = await studentQueries.update().mutationFn({
      id: params.id,
      photoUrl: null,
    });

    await createAuditLog({
      userId: user.id,
      schoolId: student.schoolId,
      action: "UPDATE",
      resourceType: "students",
      resourceId: params.id,
      newData: { photoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete photo" },
      { status: 500 }
    );
  }
}
