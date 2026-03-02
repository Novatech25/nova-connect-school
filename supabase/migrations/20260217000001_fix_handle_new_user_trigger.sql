-- Migration: Fix ALL broken triggers AND remove conflicting functions
-- Created: 2026-02-17
-- Description: 
-- This updated migration script cleans up existing conflicting function signatures for helper functions
-- BUT uses CREATE OR REPLACE for trigger functions to preserve existing triggers on other tables.

-- ============================================================================
-- CLEANUP: Remove conflicting function signatures for HELPER functions
-- ============================================================================

-- Drop old signature of log_custom_action (conflicting)
DROP FUNCTION IF EXISTS log_custom_action(audit_action_enum, TEXT, UUID, JSONB);
-- Drop new signature if it was created incorrectly
DROP FUNCTION IF EXISTS log_custom_action(TEXT, TEXT, UUID, JSONB);

-- ============================================================================
-- Fix 1: Update audit_trigger_function() in-place
-- We use CREATE OR REPLACE to avoid dropping all dependent triggers on other tables
-- (students, parents, enrollments, etc.)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_school_id UUID;
BEGIN
  -- Get current user ID (may be NULL for system operations)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Try to get school_id from the row
  BEGIN
    IF (TG_OP = 'DELETE') THEN
      v_school_id := OLD.school_id;
    ELSE
      v_school_id := NEW.school_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := NULL;
  END;

  -- Insert audit log with the NEW schema (entity_type, entity_id, action, table_name, description)
  BEGIN
    IF (TG_OP = 'DELETE') THEN
      INSERT INTO audit_logs (entity_type, entity_id, action, table_name, description, school_id, user_id)
      VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', TG_TABLE_NAME, 'Deleted record', v_school_id, v_user_id);
      RETURN OLD;

    ELSIF (TG_OP = 'UPDATE') THEN
      INSERT INTO audit_logs (entity_type, entity_id, action, table_name, description, school_id, user_id)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', TG_TABLE_NAME, 'Updated record', v_school_id, v_user_id);
      RETURN NEW;

    ELSIF (TG_OP = 'INSERT') THEN
      INSERT INTO audit_logs (entity_type, entity_id, action, table_name, description, school_id, user_id)
      VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', TG_TABLE_NAME, 'Created record', v_school_id, v_user_id);
      RETURN NEW;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Audit trigger failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;

  -- CRITICAL: Always return the row, never NULL (NULL cancels the operation for AFTER triggers)
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- Fix 2: Update handle_new_user() in-place
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
    new_user_id uuid := NEW.id;
    new_email text := NEW.email;
    new_first_name text := COALESCE(NEW.raw_user_meta_data->>'first_name', 'Prenom');
    new_last_name text := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nom');
    new_role_key text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
    new_school_code text := NEW.raw_user_meta_data->>'school_code';
    target_school_id uuid := NULL;
    target_role_id uuid;
BEGIN
    IF new_role_key = 'super_admin' THEN
        target_school_id := NULL;
    ELSE
        IF new_school_code IS NULL OR new_school_code = '' THEN
            RAISE WARNING 'No school_code for user %, skipping profile', new_user_id;
            RETURN NEW;
        END IF;

        SELECT id INTO target_school_id FROM schools WHERE code = new_school_code AND status = 'active';
        IF target_school_id IS NULL THEN
            RAISE WARNING 'Invalid school_code % for user %', new_school_code, new_user_id;
            RETURN NEW;
        END IF;
    END IF;

    SELECT id INTO target_role_id FROM roles WHERE name = new_role_key;
    IF target_role_id IS NULL THEN
        RAISE WARNING 'Invalid role % for user %', new_role_key, new_user_id;
        RETURN NEW;
    END IF;

    INSERT INTO users (id, email, first_name, last_name, school_id, is_active, created_at, updated_at)
    VALUES (new_user_id, new_email, new_first_name, new_last_name, target_school_id,
            COALESCE((NEW.email_confirmed_at IS NOT NULL), false), NOW(), NOW());

    INSERT INTO user_roles (user_id, role_id, school_id, assigned_by, assigned_at)
    VALUES (new_user_id, target_role_id, target_school_id, new_user_id, NOW());

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed for %: %', new_user_id, SQLERRM;
        RETURN NEW;
END;
$$;


-- ============================================================================
-- Fix 3: Recreate log_custom_action() compatible with NEW audit_logs schema
-- ============================================================================

CREATE OR REPLACE FUNCTION log_custom_action(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_school_id UUID;
  v_audit_log_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT school_id INTO v_school_id FROM users WHERE id = v_user_id;

  INSERT INTO audit_logs (entity_type, entity_id, action, table_name, description, school_id, user_id)
  VALUES (
    p_resource_type,
    COALESCE(p_resource_id, gen_random_uuid()),
    p_action,
    p_resource_type,
    p_metadata::TEXT,
    v_school_id,
    v_user_id
  ) RETURNING id INTO v_audit_log_id;

  RETURN v_audit_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT INSERT ON audit_logs TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_custom_action TO authenticated;
