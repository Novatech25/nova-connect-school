-- Allow students to upload documents to their own folder
-- Students can INSERT (upload) files to their folder: school_id/student_id/document_type/file_name

DROP POLICY IF EXISTS "students_upload_own_documents" ON storage.objects;
CREATE POLICY "students_upload_own_documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow students to UPDATE (replace) their own documents
DROP POLICY IF EXISTS "students_update_own_documents" ON storage.objects;
CREATE POLICY "students_update_own_documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow students to DELETE their own documents
DROP POLICY IF EXISTS "students_delete_own_documents" ON storage.objects;
CREATE POLICY "students_delete_own_documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow parents to upload documents for their children
DROP POLICY IF EXISTS "parents_upload_children_documents" ON storage.objects;
CREATE POLICY "parents_upload_children_documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-documents'
  AND EXISTS (
    SELECT 1 FROM students
    WHERE students.id::text = (storage.foldername(name))[2]
    AND students.school_id = get_current_user_school_id()
    AND EXISTS (
      SELECT 1 FROM parents
      JOIN student_parent_relations ON parents.id = student_parent_relations.parent_id
      WHERE student_parent_relations.student_id = students.id
      AND parents.user_id = auth.uid()
    )
  )
);
