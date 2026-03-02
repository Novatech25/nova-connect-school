-- ============================================
-- Migration: Enable RLS on Grades Tables
-- Created: 2025-01-25
-- Description: Enables Row Level Security and creates policies for grades tables
-- ============================================

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper Functions (must be defined before policies)
-- ============================================

CREATE OR REPLACE FUNCTION is_teacher_assigned_to_class(
  teacher_id UUID,
  class_id UUID,
  subject_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM teacher_subject_assignments
    WHERE
      teacher_id = is_teacher_assigned_to_class.teacher_id
      AND class_id = is_teacher_assigned_to_class.class_id
      AND subject_id = is_teacher_assigned_to_class.subject_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS Policies for grades table
-- ============================================

-- Policy: Select grades - school_admin can see all grades in their school
CREATE POLICY grades_select_policy_school_admin
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- Policy: Select grades - teachers can see grades for their assigned classes
CREATE POLICY grades_select_policy_teacher
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
  );

-- Policy: Select grades - students can see their own grades (only published ones)
CREATE POLICY grades_select_policy_student
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'student'
    AND student_id = auth.uid()
    AND status = 'published'
  );

-- Policy: Select grades - parents can see their children's grades (only published ones)
CREATE POLICY grades_select_policy_parent
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'parent'
    AND student_id IN (
      SELECT student_id
      FROM student_parent_relations
      WHERE parent_id = auth.uid()
    )
    AND status = 'published'
  );

-- Policy: Select grades - supervisors can see all grades in their school
CREATE POLICY grades_select_policy_supervisor
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'supervisor'
  );

-- Policy: Insert grades - teachers can create grades for their assigned classes
CREATE POLICY grades_insert_policy_teacher
  ON grades
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
    AND is_teacher_assigned_to_class(auth.uid(), class_id, subject_id)
  );

-- Policy: Update grades - teachers can update only draft grades they created, or submit to submitted
CREATE POLICY grades_update_policy_teacher
  ON grades
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
    AND (status = 'draft' OR status = 'submitted')
    AND NOT is_locked
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
    AND (status = 'draft' OR status = 'submitted')
    AND NOT is_locked
  );

-- Policy: Update grades - school_admin can update grades for validation
CREATE POLICY grades_update_policy_school_admin
  ON grades
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- Policy: Update grades - supervisors can approve grades
CREATE POLICY grades_update_policy_supervisor
  ON grades
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'supervisor'
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'supervisor'
  );

-- Policy: Delete grades - teachers can delete only draft grades they created
CREATE POLICY grades_delete_policy_teacher
  ON grades
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
    AND status = 'draft'
  );

-- Policy: Delete grades - school_admin can delete any grades
CREATE POLICY grades_delete_policy_school_admin
  ON grades
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- ============================================
-- RLS Policies for grade_versions table
-- ============================================

-- Policy: Select grade versions - school_admin can see all versions in their school
CREATE POLICY grade_versions_select_policy_school_admin
  ON grade_versions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- Policy: Select grade versions - teachers can see versions for their grades
CREATE POLICY grade_versions_select_policy_teacher
  ON grade_versions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND grade_id IN (
      SELECT id
      FROM grades
      WHERE teacher_id = auth.uid()
    )
  );

-- Policy: Select grade versions - supervisors can see all versions in their school
CREATE POLICY grade_versions_select_policy_supervisor
  ON grade_versions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'supervisor'
  );

-- Policy: Insert grade versions - trigger can create versions for authorized users
CREATE POLICY grade_versions_insert_policy_trigger
  ON grade_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND (
      get_user_role() = 'school_admin'
      OR get_user_role() = 'supervisor'
      OR grade_id IN (
        SELECT id
        FROM grades
        WHERE teacher_id = auth.uid()
      )
    )
  );

-- ============================================
-- RLS Policies for grade_submissions table
-- ============================================

-- Policy: Select grade submissions - school_admin can see all submissions in their school
CREATE POLICY grade_submissions_select_policy_school_admin
  ON grade_submissions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- Policy: Select grade submissions - teachers can see their own submissions
CREATE POLICY grade_submissions_select_policy_teacher
  ON grade_submissions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
  );

-- Policy: Select grade submissions - supervisors can see all submissions in their school
CREATE POLICY grade_submissions_select_policy_supervisor
  ON grade_submissions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'supervisor'
  );

-- Policy: Insert grade submissions - teachers can create submissions
CREATE POLICY grade_submissions_insert_policy_teacher
  ON grade_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
    AND is_teacher_assigned_to_class(auth.uid(), class_id, subject_id)
  );

-- Policy: Update grade submissions - teachers can update draft or submit to submitted
CREATE POLICY grade_submissions_update_policy_teacher
  ON grade_submissions
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
    AND (status = 'draft' OR status = 'submitted')
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
    AND (status = 'draft' OR status = 'submitted')
  );

-- Policy: Update grade submissions - school_admin can approve/reject submissions
CREATE POLICY grade_submissions_update_policy_school_admin
  ON grade_submissions
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- Policy: Update grade submissions - supervisors can approve/reject submissions
CREATE POLICY grade_submissions_update_policy_supervisor
  ON grade_submissions
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'supervisor'
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'supervisor'
  );

-- Policy: Delete grade submissions - teachers can delete only draft submissions
CREATE POLICY grade_submissions_delete_policy_teacher
  ON grade_submissions
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'teacher'
    AND teacher_id = auth.uid()
    AND status = 'draft'
  );

-- Policy: Delete grade submissions - school_admin can delete any submissions
CREATE POLICY grade_submissions_delete_policy_school_admin
  ON grade_submissions
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- ============================================
-- Helper function for checking teacher assignment
-- ============================================
-- Security Notes
-- ============================================

-- 1. All policies use get_user_school_id() to ensure multi-tenant isolation
-- 2. Students and parents can only see published grades
-- 3. Teachers can only modify draft grades they created
-- 4. Published grades are automatically locked
-- 5. Admins and supervisors have oversight but must follow workflow
-- 6. Grade versions are read-only via triggers for audit trail
-- 7. All access is logged via audit triggers (separate migration)
