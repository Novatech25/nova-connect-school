-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "students_upload_own_documents" ON storage.objects;
DROP POLICY IF EXISTS "students_update_own_documents" ON storage.objects;
DROP POLICY IF EXISTS "students_delete_own_documents" ON storage.objects;
DROP POLICY IF EXISTS "parents_upload_children_documents" ON storage.objects;

-- Create simpler policies that check if the student_id in the path matches auth.uid()
-- Path format: school_id/student_id/document_type/file_name

CREATE POLICY "students_upload_own_documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "students_update_own_documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "students_delete_own_documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Parents can upload to their children's folders
CREATE POLICY "parents_upload_children_documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-documents'
  AND EXISTS (
    SELECT 1 FROM student_parent_relations
    WHERE student_parent_relations.student_id::text = (storage.foldername(name))[2]
    AND student_parent_relations.parent_id IN (
      SELECT id FROM parents WHERE user_id = auth.uid()
    )
  )
);
