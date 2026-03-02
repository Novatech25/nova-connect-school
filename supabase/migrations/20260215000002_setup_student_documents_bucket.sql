-- ============================================================================
-- Setup student-documents bucket and policies
-- ============================================================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-documents',
  'student-documents',
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

-- Enable RLS on objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to upload documents
DROP POLICY IF EXISTS "Allow authenticated uploads to student-documents" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to student-documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT school_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Policy for authenticated users to read documents
DROP POLICY IF EXISTS "Allow authenticated read from student-documents" ON storage.objects;
CREATE POLICY "Allow authenticated read from student-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'student-documents');

-- Policy for authenticated users to delete their documents
DROP POLICY IF EXISTS "Allow authenticated delete from student-documents" ON storage.objects;
CREATE POLICY "Allow authenticated delete from student-documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT school_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Also ensure student-photos bucket exists for photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies for student-photos
DROP POLICY IF EXISTS "Allow authenticated uploads to student-photos" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to student-photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "Allow authenticated read from student-photos" ON storage.objects;
CREATE POLICY "Allow authenticated read from student-photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "Allow authenticated delete from student-photos" ON storage.objects;
CREATE POLICY "Allow authenticated delete from student-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'student-photos');
