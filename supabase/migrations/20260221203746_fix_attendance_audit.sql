-- Migration: Fix Attendance Audit Triggers
-- Description: Updates attendance audit triggers to use entity_id and entity_type instead of the old record_id column
-- Created: 2026-02-21

-- ============================================================================
-- AUDIT FUNCTIONS
-- ============================================================================

-- Audit function for attendance_sessions
CREATE OR REPLACE FUNCTION audit_attendance_sessions()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  school_uuid UUID;
BEGIN
  -- Get the current user from auth.uid()
  user_id := auth.uid();

  -- Get school_id from the record
  IF TG_OP = 'DELETE' THEN
    school_uuid := OLD.school_id;
  ELSE
    school_uuid := NEW.school_id;
  END IF;

  -- Log the action
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      table_name,
      entity_id,
      entity_type,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_sessions',
      NEW.id,
      'attendance_session',
      'INSERT',
      NULL::jsonb,
      to_jsonb(NEW),
      user_id,
      NOW(),
      school_uuid
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name,
      entity_id,
      entity_type,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_sessions',
      NEW.id,
      'attendance_session',
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      user_id,
      NOW(),
      school_uuid
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name,
      entity_id,
      entity_type,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_sessions',
      OLD.id,
      'attendance_session',
      'DELETE',
      to_jsonb(OLD),
      NULL::jsonb,
      user_id,
      NOW(),
      school_uuid
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Audit function for attendance_records
CREATE OR REPLACE FUNCTION audit_attendance_records()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  school_uuid UUID;
BEGIN
  -- Get the current user from auth.uid()
  user_id := auth.uid();

  -- Get school_id from the record
  IF TG_OP = 'DELETE' THEN
    school_uuid := OLD.school_id;
  ELSE
    school_uuid := NEW.school_id;
  END IF;

  -- Log the action
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      table_name,
      entity_id,
      entity_type,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_records',
      NEW.id,
      'attendance_record',
      'INSERT',
      NULL::jsonb,
      to_jsonb(NEW),
      user_id,
      NOW(),
      school_uuid
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name,
      entity_id,
      entity_type,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_records',
      NEW.id,
      'attendance_record',
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      user_id,
      NOW(),
      school_uuid
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name,
      entity_id,
      entity_type,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_records',
      OLD.id,
      'attendance_record',
      'DELETE',
      to_jsonb(OLD),
      NULL::jsonb,
      user_id,
      NOW(),
      school_uuid
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT FUNCTIONS FOR STATUS CHANGES
-- ============================================================================

-- Special audit function for attendance session status changes (draft -> submitted -> validated)
CREATE OR REPLACE FUNCTION audit_attendance_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (
      table_name,
      entity_id,
      entity_type,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_sessions',
      NEW.id,
      'attendance_session',
      'STATUS_CHANGE',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      to_jsonb(NEW),
      auth.uid(),
      NOW(),
      NEW.school_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
