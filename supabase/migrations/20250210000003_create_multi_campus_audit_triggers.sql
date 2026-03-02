-- Migration: Multi-Campus Audit Triggers
-- Description: Create audit triggers for multi-campus tables
-- Version: 1.0.0

-- ============================================================================
-- AUDIT FUNCTION
-- ============================================================================

-- Function to log changes to audit_logs table
CREATE OR REPLACE FUNCTION audit_multi_campus_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_school_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_action VARCHAR(10);
  v_resource_type VARCHAR(50);
BEGIN
  -- Get current user from auth
  v_user_id := auth.uid();

  -- Determine action type
  IF (TG_OP = 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_action := 'DELETE';
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_action := 'UPDATE';
  ELSIF (TG_OP = 'INSERT') THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_action := 'INSERT';
  END IF;

  -- Determine resource type and school_id based on table
  IF (TG_TABLE_NAME = 'user_campus_access') THEN
    v_resource_type := 'campus_access';
    IF (TG_OP = 'DELETE') THEN
      v_school_id := OLD.school_id;
    ELSE
      v_school_id := NEW.school_id;
    END IF;
  ELSIF (TG_TABLE_NAME = 'campus_schedules') THEN
    v_resource_type := 'campus_schedule';
    IF (TG_OP = 'DELETE') THEN
      v_school_id := OLD.school_id;
    ELSE
      v_school_id := NEW.school_id;
    END IF;
  ELSIF (TG_TABLE_NAME = 'classes') THEN
    v_resource_type := 'campus_assignment';
    IF (TG_OP = 'DELETE') THEN
      v_school_id := OLD.school_id;
    ELSE
      v_school_id := NEW.school_id;
    END IF;
  ELSE
    -- Unknown table, skip audit
    IF (TG_OP = 'DELETE') THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    user_id,
    school_id,
    created_at
  ) VALUES (
    v_action,
    v_resource_type,
    COALESCE(
      CASE
        WHEN TG_OP = 'DELETE' THEN OLD.id
        ELSE NEW.id
      END,
      gen_random_uuid()
    ),
    v_old_data,
    v_new_data,
    v_user_id,
    v_school_id,
    NOW()
  );

  -- Return appropriate record
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the operation
    RAISE WARNING 'Audit logging failed for % on %: %', TG_OP, TG_TABLE_NAME, SQLERRM;
    IF (TG_OP = 'DELETE') THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: USER_CAMPUS_ACCESS AUDIT
-- ============================================================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS audit_user_campus_access_insert ON user_campus_access;
DROP TRIGGER IF EXISTS audit_user_campus_access_update ON user_campus_access;
DROP TRIGGER IF EXISTS audit_user_campus_access_delete ON user_campus_access;

-- Create triggers for user_campus_access
CREATE TRIGGER audit_user_campus_access_insert
  AFTER INSERT ON user_campus_access
  FOR EACH ROW
  EXECUTE FUNCTION audit_multi_campus_changes();

CREATE TRIGGER audit_user_campus_access_update
  AFTER UPDATE ON user_campus_access
  FOR EACH ROW
  WHEN (
    OLD.can_access IS DISTINCT FROM NEW.can_access
    OR OLD.access_type IS DISTINCT FROM NEW.access_type
    OR OLD.campus_id IS DISTINCT FROM NEW.campus_id
  )
  EXECUTE FUNCTION audit_multi_campus_changes();

CREATE TRIGGER audit_user_campus_access_delete
  AFTER DELETE ON user_campus_access
  FOR EACH ROW
  EXECUTE FUNCTION audit_multi_campus_changes();

-- ============================================================================
-- TRIGGER: CAMPUS_SCHEDULES AUDIT
-- ============================================================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS audit_campus_schedules_insert ON campus_schedules;
DROP TRIGGER IF EXISTS audit_campus_schedules_update ON campus_schedules;
DROP TRIGGER IF EXISTS audit_campus_schedules_delete ON campus_schedules;

-- Create triggers for campus_schedules
CREATE TRIGGER audit_campus_schedules_insert
  AFTER INSERT ON campus_schedules
  FOR EACH ROW
  EXECUTE FUNCTION audit_multi_campus_changes();

CREATE TRIGGER audit_campus_schedules_update
  AFTER UPDATE ON campus_schedules
  FOR EACH ROW
  WHEN (
    OLD.campus_id IS DISTINCT FROM NEW.campus_id
    OR OLD.schedule_id IS DISTINCT FROM NEW.schedule_id
    OR OLD.specific_constraints IS DISTINCT FROM NEW.specific_constraints
  )
  EXECUTE FUNCTION audit_multi_campus_changes();

CREATE TRIGGER audit_campus_schedules_delete
  AFTER DELETE ON campus_schedules
  FOR EACH ROW
  EXECUTE FUNCTION audit_multi_campus_changes();

-- ============================================================================
-- TRIGGER: CLASSES CAMPUS_ASSIGNMENT AUDIT
-- ============================================================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS audit_campus_assignment_update ON classes;

-- Create trigger for classes campus_id changes
CREATE TRIGGER audit_campus_assignment_update
  AFTER UPDATE ON classes
  FOR EACH ROW
  WHEN (
    OLD.campus_id IS DISTINCT FROM NEW.campus_id
  )
  EXECUTE FUNCTION audit_multi_campus_changes();

-- ============================================================================
-- TRIGGER: PLANNED_SESSIONS CAMPUS_ASSIGNMENT AUDIT
-- ============================================================================

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS audit_session_campus_assignment_update ON planned_sessions;

-- Create trigger for planned_sessions campus_id changes
CREATE TRIGGER audit_session_campus_assignment_update
  AFTER UPDATE ON planned_sessions
  FOR EACH ROW
  WHEN (
    OLD.campus_id IS DISTINCT FROM NEW.campus_id
  )
  EXECUTE FUNCTION audit_multi_campus_changes();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION audit_multi_campus_changes() IS 'Audit trigger function for multi-campus changes';
COMMENT ON TRIGGER audit_user_campus_access_insert ON user_campus_access IS 'Log new campus access grants';
COMMENT ON TRIGGER audit_user_campus_access_update ON user_campus_access IS 'Log campus access modifications';
COMMENT ON TRIGGER audit_user_campus_access_delete ON user_campus_access IS 'Log campus access revocations';
COMMENT ON TRIGGER audit_campus_schedules_insert ON campus_schedules IS 'Log new campus schedule associations';
COMMENT ON TRIGGER audit_campus_schedules_update ON campus_schedules IS 'Log campus schedule modifications';
COMMENT ON TRIGGER audit_campus_schedules_delete ON campus_schedules IS 'Log campus schedule removals';
COMMENT ON TRIGGER audit_campus_assignment_update ON classes IS 'Log class campus assignments';
COMMENT ON TRIGGER audit_session_campus_assignment_update ON planned_sessions IS 'Log session campus assignments';
