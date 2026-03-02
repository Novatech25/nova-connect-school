-- =====================================================
-- Migration: Fix student and parent RLS policies for grades
-- Created: 2026-02-22
-- Description: The existing policies for students and parents relied on get_user_role()
--              and get_user_school_id() which uses the user_roles table. Some student
--              accounts don't have records in user_roles, causing them to not see their grades.
--              We simplify the policies to only check the student_id or parent relationship.
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS grades_select_policy_student ON grades;
DROP POLICY IF EXISTS grades_select_policy_parent ON grades;

-- Recreate policy for students
-- A user can see any published grade that belongs to their student profile
CREATE POLICY grades_select_policy_student
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    student_id = get_user_student_id()
    AND status = 'published'
  );

-- Recreate policy for parents
-- A user can see any published grade that belongs to a student they are linked to as a parent
CREATE POLICY grades_select_policy_parent
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT student_id
      FROM student_parent_relations
      WHERE parent_id = get_user_parent_id()
    )
    AND status = 'published'
  );
