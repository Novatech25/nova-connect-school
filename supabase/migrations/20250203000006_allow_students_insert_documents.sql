-- Drop existing policies
DROP POLICY IF EXISTS "students_can_view_own_documents" ON student_documents;
DROP POLICY IF EXISTS "students_can_insert_own_documents" ON student_documents;

-- Allow students to view their own documents
CREATE POLICY "students_can_view_own_documents"
ON student_documents FOR SELECT
USING (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

-- Allow students to insert their own documents
CREATE POLICY "students_can_insert_own_documents"
ON student_documents FOR INSERT
WITH CHECK (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

-- Allow students to update their own documents
DROP POLICY IF EXISTS "students_can_update_own_documents" ON student_documents;
CREATE POLICY "students_can_update_own_documents"
ON student_documents FOR UPDATE
USING (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

-- Allow students to delete their own documents
DROP POLICY IF EXISTS "students_can_delete_own_documents" ON student_documents;
CREATE POLICY "students_can_delete_own_documents"
ON student_documents FOR DELETE
USING (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);
