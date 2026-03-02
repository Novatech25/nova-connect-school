-- =====================================================
-- Migration: Fix RLS policies for students and parents viewing grades
-- Created: 2025-03-02
-- Description: Fixes the issue where students and parents cannot see grades because
--              the policy was comparing grades.student_id (students.id) with auth.uid() (users.id)
--              This migration creates helper functions and updates the RLS policies
-- =====================================================

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get student ID for currently logged-in student user
-- Returns the student.id (from students table) for the authenticated user
CREATE OR REPLACE FUNCTION get_user_student_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM students
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get parent ID for currently logged-in parent user
-- Returns the parent.id (from parents table) for the authenticated user
CREATE OR REPLACE FUNCTION get_user_parent_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM parents
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Drop existing policies (will be recreated)
-- =====================================================

DROP POLICY IF EXISTS grades_select_policy_student ON grades;
DROP POLICY IF EXISTS grades_select_policy_parent ON grades;

-- =====================================================
-- Recreate policies with correct student_id reference
-- =====================================================

-- Policy: Select grades - students can see their own grades (only published ones)
-- FIXED: Now correctly maps auth.uid() (users.id) to student_id (students.id)
CREATE POLICY grades_select_policy_student
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'student'
    AND student_id = get_user_student_id()  -- FIXED: Use helper function
    AND status = 'published'
  );

-- Policy: Select grades - parents can see their children's grades (only published ones)
-- FIXED: Now correctly maps auth.uid() (users.id) to parent_id (parents.id)
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
      WHERE parent_id = get_user_parent_id()  -- FIXED: Use helper function
    )
    AND status = 'published'
  );

-- =====================================================
-- Add comments for documentation
-- =====================================================

COMMENT ON FUNCTION get_user_student_id() IS 'Returns the student.id (from students table) for the currently authenticated student user. Maps auth.uid() (users.id) to students.id via students.user_id.';

COMMENT ON FUNCTION get_user_parent_id() IS 'Returns the parent.id (from parents table) for the currently authenticated parent user. Maps auth.uid() (users.id) to parents.id via parents.user_id.';

-- =====================================================
-- Security Notes
-- =====================================================

-- 1. The original policies compared grades.student_id (which references students.id) directly with auth.uid() (which is users.id)
-- 2. These are different IDs! The correct path is: users.id -> students.user_id -> students.id -> grades.student_id
-- 3. The helper functions get_user_student_id() and get_user_parent_id() perform this mapping correctly
-- 4. Students and parents can only see published grades (status = 'published')
-- 5. Multi-tenant isolation is maintained via school_id = get_user_school_id()
