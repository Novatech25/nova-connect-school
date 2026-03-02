-- ============================================================================
-- Fix: Ensure documents bucket exists with correct policies
-- ============================================================================

-- Create the documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow uploads to documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow read from documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from documents" ON storage.objects;

-- Policy for authenticated users to upload
CREATE POLICY "Allow uploads to documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Policy for authenticated users to read
CREATE POLICY "Allow read from documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Policy for authenticated users to delete
CREATE POLICY "Allow delete from documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');

-- Verify setup
SELECT 'Documents bucket configured successfully' as status;
