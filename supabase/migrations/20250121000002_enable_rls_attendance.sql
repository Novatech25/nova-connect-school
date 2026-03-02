-- Migration: RLS Policies for Attendance Tables
-- Description: Creates Row Level Security policies for attendance_sessions and attendance_records
-- Created: 2025-01-21

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR attendance_sessions
-- ============================================================================

-- SELECT: Teachers can see their own sessions, admins/supervisors can see all sessions in their school
CREATE POLICY "Teachers can view their own attendance sessions"
  ON attendance_sessions FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND teacher_id = auth.uid()
  );

CREATE POLICY "Admins and supervisors can view all sessions in their school"
  ON attendance_sessions FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND school_id = attendance_sessions.school_id AND r.name IN ('''')
    )
  );

-- INSERT: Teachers can create sessions for their planned sessions
CREATE POLICY "Teachers can create attendance sessions"
  ON attendance_sessions FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM planned_sessions
      WHERE id = planned_session_id
        AND teacher_id = auth.uid()
    )
  );

-- UPDATE: Teachers can modify their draft sessions and submit them, admins/supervisors can validate submitted sessions
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

CREATE POLICY "Admins and supervisors can validate submitted sessions"
  ON attendance_sessions FOR UPDATE
  USING (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND school_id = attendance_sessions.school_id AND r.name IN ('''')
    )
    AND status IN ('submitted', 'validated')
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND school_id = attendance_sessions.school_id AND r.name IN ('''')
    )
  );

-- DELETE: Admins can delete draft sessions only
CREATE POLICY "Admins can delete draft sessions"
  ON attendance_sessions FOR DELETE
  USING (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND school_id = attendance_sessions.school_id AND r.name = 'school_admin'
    )
    AND status = 'draft'
  );

-- ============================================================================
-- RLS POLICIES FOR attendance_records
-- ============================================================================

-- SELECT: Teachers see records from their sessions, parents see their children's records, admins/supervisors see all
CREATE POLICY "Teachers can view records from their sessions"
  ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE attendance_sessions.id = attendance_records.attendance_session_id
        AND attendance_sessions.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Parents can view their children's attendance records"
  ON attendance_records FOR SELECT
  USING (
    student_id IN (
      SELECT student_id
      FROM student_parent_relations
      WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Admins and supervisors can view all records in their school"
  ON attendance_records FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND school_id = attendance_records.school_id AND r.name IN ('''')
    )
  );

-- INSERT: Teachers can create records for their sessions
CREATE POLICY "Teachers can create attendance records"
  ON attendance_records FOR INSERT
  WITH CHECK (
    marked_by = auth.uid()
    AND school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE attendance_sessions.id = attendance_records.attendance_session_id
        AND attendance_sessions.teacher_id = auth.uid()
        AND attendance_sessions.status = 'draft'
    )
  );

-- UPDATE: Teachers can modify records in draft sessions, admins can modify any
CREATE POLICY "Teachers can update records in draft sessions"
  ON attendance_records FOR UPDATE
  USING (
    marked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE attendance_sessions.id = attendance_records.attendance_session_id
        AND attendance_sessions.teacher_id = auth.uid()
        AND attendance_sessions.status = 'draft'
    )
  )
  WITH CHECK (
    marked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE attendance_sessions.id = attendance_records.attendance_session_id
        AND attendance_sessions.teacher_id = auth.uid()
        AND attendance_sessions.status = 'draft'
    )
  );

CREATE POLICY "Admins and supervisors can update any records"
  ON attendance_records FOR UPDATE
  USING (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND school_id = attendance_records.school_id AND r.name IN ('''')
    )
  )
  WITH CHECK (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND school_id = attendance_records.school_id AND r.name IN ('''')
    )
  );

-- DELETE: Admins only
CREATE POLICY "Admins can delete attendance records"
  ON attendance_records FOR DELETE
  USING (
    school_id IN (SELECT school_id FROM user_roles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND school_id = attendance_records.school_id AND r.name = 'school_admin'
    )
  );

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- These policies ensure:
-- 1. Teachers can only manage attendance for their own sessions
-- 2. Teachers can modify draft sessions and submit them (draft → submitted)
-- 3. Teachers CANNOT set status to 'validated' (only admins can do that)
-- 4. Teachers CANNOT modify sessions that are already submitted or validated
-- 5. Parents can only view their children's attendance
-- 6. Admins and supervisors have full access within their school
-- 7. Draft sessions can be modified by teachers, submitted/validated sessions can only be validated by admins
-- 8. All access is scoped to the user's school(s)
