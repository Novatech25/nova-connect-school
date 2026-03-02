-- Migration: Enable RLS for QR Attendance Tables
-- Description: Row Level Security policies for QR code attendance system

-- Enable RLS on both tables
ALTER TABLE public.qr_attendance_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scan_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES FOR qr_attendance_codes
-- ============================================================================

-- SELECT: Admins/supervisors see all codes in their school;
--         Teachers see codes for their classes
CREATE POLICY "Allow admins to view all school QR codes"
  ON public.qr_attendance_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.school_id = qr_attendance_codes.school_id
        AND user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
    )
  );

CREATE POLICY "Allow teachers to view their class QR codes"
  ON public.qr_attendance_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM planned_sessions WHERE class_id = qr_attendance_codes.class_id AND teacher_id = auth.uid()
    )
  );

-- INSERT: Only admins/supervisors can generate QR codes (via Edge Function)
CREATE POLICY "Allow admins to create QR codes"
  ON public.qr_attendance_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.school_id = qr_attendance_codes.school_id
        AND user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- UPDATE: Only admins/supervisors can modify QR codes (deactivation, etc.)
CREATE POLICY "Allow admins to update QR codes"
  ON public.qr_attendance_codes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.school_id = qr_attendance_codes.school_id
        AND user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.school_id = qr_attendance_codes.school_id
        AND user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- DELETE: Only admins can delete QR codes
CREATE POLICY "Allow admins to delete QR codes"
  ON public.qr_attendance_codes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.school_id = qr_attendance_codes.school_id
        AND user_id = auth.uid()
        AND r.name = 'school_admin'
    )
  );

-- ============================================================================
-- POLICIES FOR qr_scan_logs
-- ============================================================================

-- SELECT: Admins/supervisors see all logs in their school;
--         Students see only their own scan logs
CREATE POLICY "Allow admins to view all school scan logs"
  ON public.qr_scan_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.school_id = qr_scan_logs.school_id
        AND user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
    )
  );

CREATE POLICY "Allow students to view their own scan logs"
  ON public.qr_scan_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id = qr_scan_logs.student_id
        AND user_id = auth.uid()
    )
  );

-- INSERT: Students can create their own scan logs (via Edge Function)
--         Also allow service role to insert logs during validation
CREATE POLICY "Allow students to create their scan logs"
  ON public.qr_scan_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students
      WHERE id = qr_scan_logs.student_id
        AND user_id = auth.uid()
    )
    OR -- Allow service role insertion from Edge Functions
    (false -- service_role bypasses RLS anyway)
  );

-- UPDATE: Prevent all updates (append-only table)
CREATE POLICY "Prevent updates to scan logs"
  ON public.qr_scan_logs FOR UPDATE
  USING (false);

-- DELETE: Prevent all deletions (append-only table)
CREATE POLICY "Prevent deletions to scan logs"
  ON public.qr_scan_logs FOR DELETE
  USING (false);

-- ============================================================================
-- SECURITY DEFINED FUNCTIONS (if needed for complex checks)
-- ============================================================================

-- Helper function to check if user is teacher of a class
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(class_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM planned_sessions
    WHERE class_teachers.class_id = $1
      AND class_teachers.teacher_id = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin/supervisor of school
CREATE OR REPLACE FUNCTION public.is_admin_of_school(school_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE school_members.school_id = $1
      AND school_members.user_id = $2
      AND school_members.role_id IN ('school_admin', 'supervisor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.qr_attendance_codes IS 'RLS enabled: admins/supervisors full access, teachers read-only for their classes';
COMMENT ON TABLE public.qr_scan_logs IS 'RLS enabled: admins/supervisors full read, students read-only own logs, append-only for inserts';
COMMENT ON FUNCTION public.is_teacher_of_class IS 'Helper function to check if user is a teacher of a specific class';
COMMENT ON FUNCTION public.is_admin_of_school IS 'Helper function to check if user is admin/supervisor of a school';
