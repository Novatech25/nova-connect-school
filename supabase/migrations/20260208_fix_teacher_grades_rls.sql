-- =====================================================
-- Migration: Fix teacher grades RLS policy
-- Created: 2026-02-08
-- Description: Fixes the is_teacher_assigned_to_class function to use 
--              the correct table name (teacher_assignments instead of 
--              teacher_subject_assignments which doesn't exist)
-- =====================================================

-- =====================================================
-- Step 1: Drop policies that depend on the function
-- =====================================================

DROP POLICY IF EXISTS grades_insert_policy_teacher ON grades;
DROP POLICY IF EXISTS grade_submissions_insert_policy_teacher ON grade_submissions;

-- =====================================================
-- Step 2: Drop and recreate the helper function
-- =====================================================

DROP FUNCTION IF EXISTS is_teacher_assigned_to_class(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION is_teacher_assigned_to_class(
  p_teacher_id UUID,
  p_class_id UUID,
  p_subject_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM teacher_assignments  -- FIXED: was teacher_subject_assignments
    WHERE
      teacher_id = p_teacher_id
      AND class_id = p_class_id
      AND subject_id = p_subject_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Recreate teacher insert policy for grades
-- =====================================================

-- Drop existing policy if exists
DROP POLICY IF EXISTS grades_insert_policy_teacher ON grades;

-- Create new policy with correct function
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

-- =====================================================
-- Recreate teacher insert policy for grade_submissions
-- =====================================================

-- Drop existing policy if exists
DROP POLICY IF EXISTS grade_submissions_insert_policy_teacher ON grade_submissions;

-- Create new policy with correct function
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

-- =====================================================
-- Add comment for documentation
-- =====================================================

COMMENT ON FUNCTION is_teacher_assigned_to_class(UUID, UUID, UUID) IS 
'Checks if a teacher is assigned to teach a specific subject in a specific class. 
Uses the teacher_assignments table (not teacher_subject_assignments which was incorrect).';

-- =====================================================
-- Step 4: Fix SELECT policy for teachers
-- The existing policy requires get_user_role() = 'teacher' AND get_user_school_id() match
-- This can fail if user_roles is not properly configured
-- New policy: teachers can see grades where they are the teacher_id
-- =====================================================

DROP POLICY IF EXISTS grades_select_policy_teacher ON grades;

CREATE POLICY grades_select_policy_teacher
  ON grades
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
  );
