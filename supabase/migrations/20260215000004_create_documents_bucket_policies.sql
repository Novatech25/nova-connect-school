-- ============================================================================
-- Create documents bucket and policies
-- ============================================================================

-- Create bucket if not exists
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
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

-- Drop old student-documents bucket if exists
DELETE FROM storage.buckets WHERE id = 'student-documents';
DELETE FROM storage.buckets WHERE id = 'student-photos';

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow uploads to documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow read from documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from documents" ON storage.objects;

-- Create policies for documents bucket
CREATE POLICY "Allow uploads to documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow read from documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Allow delete from documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');

SELECT 'Documents bucket and policies created successfully' as status;
