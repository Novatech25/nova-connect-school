-- Migration: Fix Attendance Audit Triggers old_data column
-- Description: Updates attendance audit triggers to use log_audit_event to avoid old_data column error

-- Audit function for attendance_sessions
CREATE OR REPLACE FUNCTION audit_attendance_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'attendance_session', NEW.id, 'create', 'attendance_sessions', 
      'Attendance session created for date: ' || NEW.session_date, NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'attendance_session', NEW.id, 'update', 'attendance_sessions', 
      'Attendance session updated', NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'attendance_session', OLD.id, 'delete', 'attendance_sessions', 
      'Attendance session deleted', OLD.school_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Audit function for attendance_records
CREATE OR REPLACE FUNCTION audit_attendance_records()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'attendance_record', NEW.id, 'create', 'attendance_records', 
      'Attendance record created for student: ' || NEW.student_id || ' status: ' || NEW.status, NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'attendance_record', NEW.id, 'update', 'attendance_records', 
      'Attendance record updated to status: ' || COALESCE(NEW.status, 'unknown'), NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'attendance_record', OLD.id, 'delete', 'attendance_records', 
      'Attendance record deleted', OLD.school_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Special audit function for attendance session status changes
CREATE OR REPLACE FUNCTION audit_attendance_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_audit_event(
      'attendance_session', NEW.id, 'status_change', 'attendance_sessions', 
      'Status changed: ' || OLD.status || ' → ' || NEW.status, NEW.school_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
