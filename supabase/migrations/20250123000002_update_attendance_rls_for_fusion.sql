-- Migration: Update RLS Policies for Attendance Fusion
-- This migration updates Row Level Security policies to support the fusion system
-- Date: 2025-01-23

-- ============================================================================
-- 1. Update existing attendance_records policies for fusion
-- ============================================================================

-- Drop existing policy that will be replaced
DROP POLICY IF EXISTS "Teachers can update records in draft sessions" ON attendance_records;

-- Create updated policy for teachers to update records in draft sessions
-- Allow updates to auto/manual records, but not confirmed/overridden (unless the teacher is the one who overrode)
CREATE POLICY "Teachers can update records in draft sessions"
  ON attendance_records FOR UPDATE
  TO authenticated
  USING (
    -- User must be a teacher
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND r.name = 'teacher'
        AND ur.school_id = attendance_records.school_id
    )
    AND -- Session must be in draft status
    EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE attendance_sessions.id = attendance_records.attendance_session_id
        AND attendance_sessions.status = 'draft'
    )
    AND -- Allow updates to auto or manual records, or records they previously merged
    (
      record_status IN ('auto', 'manual')
      OR merged_by = auth.uid()
    )
  )
  WITH CHECK (
    -- Same checks for insert
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid()
        AND r.name = 'teacher'
        AND ur.school_id = attendance_records.school_id
    )
    AND EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE attendance_sessions.id = attendance_records.attendance_session_id
        AND attendance_sessions.status = 'draft'
    )
    AND (
      record_status IN ('auto', 'manual')
      OR merged_by = auth.uid()
    )
  );

COMMENT ON POLICY "Teachers can update records in draft sessions" ON attendance_records IS
  'Teachers can update attendance records in draft sessions, including auto/manual records and records they previously merged';

-- ============================================================================
-- 2. Create policy for students to update their QR records (for fusion)
-- ============================================================================

-- Policy allowing students to update their own QR-scanned records during fusion
CREATE POLICY "Students can update their own QR records for fusion"
  ON attendance_records FOR UPDATE
  TO authenticated
  USING (
    -- Record must be marked by the student
    marked_by = auth.uid()
    AND source = 'qr_scan'
    AND record_status = 'auto'
    AND -- Session must be in draft
    EXISTS (
      SELECT 1 FROM attendance_sessions
      WHERE attendance_sessions.id = attendance_records.attendance_session_id
        AND attendance_sessions.status = 'draft'
    )
    AND -- Student belongs to the school
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = attendance_records.student_id
        AND students.user_id = auth.uid()
    )
  )
  WITH CHECK (
    marked_by = auth.uid()
    AND source = 'qr_scan'
  );

COMMENT ON POLICY "Students can update their own QR records for fusion" ON attendance_records IS
  'Allows students to update their own QR-scanned records (e.g., during auto-merge), but not change source';

-- ============================================================================
-- 3. Create policies for attendance_record_history
-- ============================================================================

-- Enable RLS on attendance_record_history
ALTER TABLE attendance_record_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view history of their school's records
CREATE POLICY "Users can view history of their school's records"
  ON attendance_record_history FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view history of their school's records" ON attendance_record_history IS
  'All authenticated users can view attendance history for their school';

-- Policy: Service role can insert history (trigger function)
CREATE POLICY "Service role can insert history"
  ON attendance_record_history FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON POLICY "Service role can insert history" ON attendance_record_history IS
  'Allows the service role to insert history records via trigger';

-- Policy: Service role can update history
CREATE POLICY "Service role can update history"
  ON attendance_record_history FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. Grant additional permissions
-- ============================================================================

-- Grant usage on new enum types
GRANT USAGE ON TYPE attendance_record_status_enum TO authenticated;
GRANT USAGE ON TYPE attendance_record_status_enum TO service_role;

-- ============================================================================
-- 5. Add helpful comments
-- ============================================================================

COMMENT ON TABLE attendance_record_history IS
  'Audit trail for all attendance record changes. Accessible to all users in the school for transparency.';

COMMENT ON COLUMN attendance_records.record_status IS
  'auto = QR scan only, confirmed = both sources agree, overridden = one source overrode another, manual = teacher only';

COMMENT ON COLUMN attendance_records.original_source IS
  'Tracks the source before merge (e.g., qr_scan if teacher overrode a QR scan)';

COMMENT ON COLUMN attendance_records.merged_at IS
  'Timestamp when this record was merged from multiple sources';

COMMENT ON COLUMN attendance_records.merged_by IS
  'User who performed the merge operation (can be student for QR merge or teacher/admin for manual merge)';
