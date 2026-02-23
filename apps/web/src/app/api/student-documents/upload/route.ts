import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuditLog } from "@novaconnect/data";
import type { Database } from "@novaconnect/data";
import {
  uploadStudentDocument,
  deleteStudentDocument,
} from "@/lib/storage";

// Client avec service role pour les opérations admin
const createServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
};

// Helper pour vérifier l'authentification
async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  console.log("POST /api/student-documents/upload called");
  try {
    // Vérifier l'authentification
    const user = await getUserFromToken(req);
    console.log("Server user:", user?.id);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parser le FormData
    const formData = await req.formData();
    const schoolId = formData.get("schoolId") as string;
    const studentId = formData.get("studentId") as string;
    const documentType = formData.get("documentType") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const file = formData.get("file") as File;

    console.log("Form fields:", { schoolId, studentId, documentType, title, hasFile: !!file, fileName: file?.name });

    if (!schoolId || !studentId || !documentType || !title || !file) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Upload fichier vers Supabase Storage
    console.log("Uploading file to storage...");
    const { url: fileUrl, path } = await uploadStudentDocument(
      schoolId,
      studentId,
      file
    );
    console.log("File uploaded, path:", path);

    // Créer le record dans la DB avec le service role
    console.log("Creating document record...");
    const serviceClient = createServiceClient();
    const { data: documentData, error: dbError } = await serviceClient
      .from("student_documents")
      .insert({
        school_id: schoolId,
        student_id: studentId,
        document_type: documentType,
        title,
        description: description || null,
        file_url: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      // Supprimer le fichier si l'insertion échoue
      await deleteStudentDocument(fileUrl);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log("Document created:", documentData.id);

    // Audit log
    await createAuditLog({
      userId: user.id,
      schoolId,
      action: "INSERT",
      resourceType: "student_documents",
      resourceId: documentData.id,
      newData: documentData,
    });

    return NextResponse.json(documentData, { status: 201 });
  } catch (error: any) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload document" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    // Get document to retrieve file URL
    const serviceClient = createServiceClient();
    const { data: document, error: fetchError } = await serviceClient
      .from("student_documents")
      .select("file_url, school_id")
      .eq("id", documentId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete file from Supabase Storage
    await deleteStudentDocument(document.file_url);

    // Delete document record
    const { error: deleteError } = await serviceClient
      .from("student_documents")
      .delete()
      .eq("id", documentId);

    if (deleteError) {
      throw new Error(`Failed to delete record: ${deleteError.message}`);
    }

    await createAuditLog({
      userId: user.id,
      schoolId: document.school_id,
      action: "DELETE",
      resourceType: "student_documents",
      resourceId: documentId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
