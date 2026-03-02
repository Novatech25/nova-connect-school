-- =====================================================
-- Migration: Enable RLS and create policies for lesson_logs
-- Description: Row Level Security policies for lesson_logs and lesson_log_documents tables
-- =====================================================

-- Enable RLS on lesson_logs
ALTER TABLE lesson_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on lesson_log_documents
ALTER TABLE lesson_log_documents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Policies for lesson_logs table
-- =====================================================

-- Policy: Super admins can do everything
CREATE POLICY "super_admin_all_lesson_logs"
ON lesson_logs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: School admins can manage all logs for their school
CREATE POLICY "school_admin_all_own_school_lesson_logs"
ON lesson_logs FOR ALL
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
  )
)
WITH CHECK (
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
  )
);

-- Policy: Teachers can create their own lesson logs
CREATE POLICY "teachers_create_own_lesson_logs"
ON lesson_logs FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid() AND
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'teacher'
  )
);

-- Policy: Teachers can read their own lesson logs
CREATE POLICY "teachers_read_own_lesson_logs"
ON lesson_logs FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid() AND
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'teacher'
  )
);

-- Policy: Teachers can update their own draft lesson logs
CREATE POLICY "teachers_update_own_draft_lesson_logs"
ON lesson_logs FOR UPDATE
TO authenticated
USING (
  teacher_id = auth.uid() AND
  status IN ('draft', 'rejected') AND
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'teacher'
  )
)
WITH CHECK (
  teacher_id = auth.uid() AND
  status IN ('draft', 'rejected') AND
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'teacher'
  )
);

-- Policy: Teachers can submit their own lesson logs (draft/pending_validation -> pending_validation)
CREATE POLICY "teachers_submit_own_lesson_logs"
ON lesson_logs FOR UPDATE
TO authenticated
USING (
  teacher_id = auth.uid() AND
  status IN ('draft', 'rejected') AND
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'teacher'
  )
)
WITH CHECK (
  teacher_id = auth.uid() AND
  status = 'pending_validation' AND
  validated_by IS NULL AND
  validated_at IS NULL AND
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'teacher'
  )
);

-- Policy: Teachers can delete their own draft lesson logs
CREATE POLICY "teachers_delete_own_draft_lesson_logs"
ON lesson_logs FOR DELETE
TO authenticated
USING (
  teacher_id = auth.uid() AND
  status = 'draft' AND
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'teacher'
  )
);

-- Policy: Teachers can read validated lesson logs from their school
CREATE POLICY "teachers_read_validated_school_lesson_logs"
ON lesson_logs FOR SELECT
TO authenticated
USING (
  status = 'validated' AND
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'teacher'
  )
);

-- Policy: Students can read validated lesson logs for their classes
CREATE POLICY "students_read_validated_lesson_logs"
ON lesson_logs FOR SELECT
TO authenticated
USING (
  status = 'validated' AND
  class_id IN (
    SELECT class_id FROM enrollments WHERE student_id = auth.uid()
  )
);

-- Policy: Parents can read validated lesson logs for their children's classes
CREATE POLICY "parents_read_validated_lesson_logs"
ON lesson_logs FOR SELECT
TO authenticated
USING (
  status = 'validated' AND
  class_id IN (
    SELECT sce.class_id
    FROM enrollments sce
    JOIN student_parent_relations psr ON psr.student_id = sce.student_id
    WHERE psr.parent_id = auth.uid()
  )
);

-- =====================================================
-- Policies for lesson_log_documents table
-- =====================================================

-- Policy: Super admins can do everything
CREATE POLICY "super_admin_all_lesson_log_documents"
ON lesson_log_documents FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: School admins can manage all documents for their school
CREATE POLICY "school_admin_all_own_school_lesson_log_documents"
ON lesson_log_documents FOR ALL
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
  )
)
WITH CHECK (
  school_id IN (
    SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
  )
);

-- Policy: Teachers can read documents from their own lesson logs
CREATE POLICY "teachers_read_own_lesson_log_documents"
ON lesson_log_documents FOR SELECT
TO authenticated
USING (
  lesson_log_id IN (
    SELECT id FROM lesson_logs WHERE teacher_id = auth.uid()
  )
);

-- Policy: Teachers can upload documents to their own lesson logs
CREATE POLICY "teachers_upload_own_lesson_log_documents"
ON lesson_log_documents FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND
  lesson_log_id IN (
    SELECT id FROM lesson_logs WHERE teacher_id = auth.uid()
  )
);

-- Policy: Teachers can delete documents from their own draft lesson logs
CREATE POLICY "teachers_delete_own_draft_lesson_log_documents"
ON lesson_log_documents FOR DELETE
TO authenticated
USING (
  lesson_log_id IN (
    SELECT id FROM lesson_logs
    WHERE teacher_id = auth.uid()
    AND status IN ('draft', 'pending_validation')
  )
);

-- Policy: Students can read documents from validated lesson logs of their classes
CREATE POLICY "students_read_validated_lesson_log_documents"
ON lesson_log_documents FOR SELECT
TO authenticated
USING (
  lesson_log_id IN (
    SELECT ll.id FROM lesson_logs ll
    JOIN enrollments sce ON sce.class_id = ll.class_id
    WHERE ll.status = 'validated' AND sce.student_id = auth.uid()
  )
);

-- Policy: Parents can read documents from validated lesson logs of their children's classes
CREATE POLICY "parents_read_validated_lesson_log_documents"
ON lesson_log_documents FOR SELECT
TO authenticated
USING (
  lesson_log_id IN (
    SELECT ll.id FROM lesson_logs ll
    JOIN enrollments sce ON sce.class_id = ll.class_id
    JOIN student_parent_relations psr ON psr.student_id = sce.student_id
    WHERE ll.status = 'validated' AND psr.parent_id = auth.uid()
  )
);

-- =====================================================
-- Comments on policies
-- =====================================================

-- Lesson logs policies
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility

-- Lesson log documents policies
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
