-- Migration: Fix RLS Policy for Teacher Attendance Session Submission
-- Description: Updates teacher UPDATE policy to allow submitting sessions (draft → submitted)
-- Created: 2025-01-21

-- Drop the old restrictive teacher update policies
DROP POLICY IF EXISTS "Teachers can update their draft sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Teachers can submit their sessions" ON attendance_sessions;
DROP POLICY IF EXISTS "Teachers can update their draft sessions and submit" ON attendance_sessions;

-- Create unified policy allowing draft modification and submission
CREATE POLICY "Teachers can update their draft sessions and submit"
  ON attendance_sessions FOR UPDATE
  USING (
    teacher_id = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND status IN ('draft', 'submitted')
  );

-- Note: Policy comments removed for Supabase compatibility

-- Security guarantees:
-- Teachers CAN:
-- - Modify their own draft sessions (status = 'draft')
-- - Submit their draft sessions (change status from 'draft' to 'submitted')
-- Teachers CANNOT:
-- - Update sessions that are already submitted or validated
-- - Set status to 'validated' (only admins can do that)
-- - Modify other teachers' sessions
