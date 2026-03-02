-- Migration: Create class-documents storage bucket
-- Purpose: Store PDF documents shared by teachers with their classes

-- Create the class-documents bucket (public for download, signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'class-documents',
  'class-documents',
  true,  -- Public so students can access via public URL
  20971520,  -- 20MB max file size
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for class-documents bucket

-- Teachers can upload files (INSERT)
CREATE POLICY "Teachers can upload class documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'class-documents'
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'teacher'
  )
);

-- Teachers can update/delete their own files
CREATE POLICY "Teachers can manage their own class documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'class-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- All authenticated users can read (download) class documents
CREATE POLICY "Authenticated users can read class documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'class-documents');
