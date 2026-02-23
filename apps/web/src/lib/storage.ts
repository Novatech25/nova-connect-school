import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function uploadStudentDocument(
  schoolId: string,
  studentId: string,
  file: File
): Promise<{ url: string; path: string }> {
  console.log("uploadStudentDocument called:", { schoolId, studentId, fileName: file.name, fileSize: file.size });
  
  if (!supabaseServiceKey || supabaseServiceKey === "undefined") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${schoolId}/${studentId}/${fileName}`;

  console.log("Uploading to path:", filePath);
  
  const { data, error } = await supabase.storage
    .from("documents")
    .upload(filePath, file);

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  console.log("Upload successful:", data?.path);

  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
  };
}

export async function deleteStudentDocument(fileUrl: string): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(fileUrl);
  const pathParts = url.pathname.split("/documents/");
  const filePath = pathParts[pathParts.length - 1];

  const { error } = await supabase.storage
    .from("documents")
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

export async function uploadStudentPhoto(
  schoolId: string,
  studentId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${schoolId}/${studentId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("documents")
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload photo: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
  };
}

export async function deleteStudentPhoto(photoUrl: string): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(photoUrl);
  const pathParts = url.pathname.split("/documents/");
  const filePath = pathParts[pathParts.length - 1];

  const { error } = await supabase.storage
    .from("documents")
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
}
