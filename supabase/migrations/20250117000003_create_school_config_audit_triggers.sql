-- Migration: Audit Triggers for School Configuration Tables
-- Description: Creates audit triggers and business logic triggers for school config tables
-- Created: 2025-01-17

-- ============================================
-- AUDIT TRIGGERS
-- ============================================

-- Note: This assumes the create_audit_log() function already exists.
-- If it doesn't exist, you'll need to create it first:
/*
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, old_data, new_data, metadata)
    VALUES (
      COALESCE(OLD.school_id, NEW.school_id),
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      COALESCE(OLD.id, NEW.id),
      row_to_json(OLD),
      row_to_json(NEW),
      '{}'::jsonb
    );
    RETURN OLD;
  ELSE
    INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, old_data, new_data, metadata)
    VALUES (
      COALESCE(OLD.school_id, NEW.school_id),
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      COALESCE(OLD.id, NEW.id),
      row_to_json(OLD),
      row_to_json(NEW),
      '{}'::jsonb
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

-- Create audit triggers for all school config tables
CREATE TRIGGER academic_years_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON academic_years
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER levels_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON levels
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER classes_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON classes
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER subjects_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON subjects
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER periods_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON periods
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER grading_scales_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON grading_scales
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER campuses_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON campuses
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER rooms_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON rooms
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER teacher_assignments_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- ============================================
-- BUSINESS LOGIC TRIGGERS
-- ============================================

-- ============================================
-- Trigger: Ensure only ONE current academic year per school
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_current_academic_year()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting is_current to true, set all other years for this school to false
  IF NEW.is_current = true AND (TG_OP = 'INSERT' OR OLD.is_current = false) THEN
    UPDATE academic_years
    SET is_current = false
    WHERE school_id = NEW.school_id
    AND id != NEW.id
    AND is_current = true;
  END IF;

  -- If updating to false, that's fine (no current year is valid state temporarily)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER academic_years_ensure_single_current
  BEFORE INSERT OR UPDATE ON academic_years
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION ensure_single_current_academic_year();

-- ============================================
-- Trigger: Ensure only ONE default grading scale per school
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_default_grading_scale()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting is_default to true, set all other scales for this school to false
  IF NEW.is_default = true AND (TG_OP = 'INSERT' OR OLD.is_default = false) THEN
    UPDATE grading_scales
    SET is_default = false
    WHERE school_id = NEW.school_id
    AND id != NEW.id
    AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER grading_scales_ensure_single_default
  BEFORE INSERT OR UPDATE ON grading_scales
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_grading_scale();

-- ============================================
-- Trigger: Ensure only ONE main campus per school
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_main_campus()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting is_main to true, set all other campuses for this school to false
  IF NEW.is_main = true AND (TG_OP = 'INSERT' OR OLD.is_main = false) THEN
    UPDATE campuses
    SET is_main = false
    WHERE school_id = NEW.school_id
    AND id != NEW.id
    AND is_main = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER campuses_ensure_single_main
  BEFORE INSERT OR UPDATE ON campuses
  FOR EACH ROW
  WHEN (NEW.is_main = true)
  EXECUTE FUNCTION ensure_single_main_campus();

-- ============================================
-- Trigger: Prevent deletion of current academic year
-- ============================================

CREATE OR REPLACE FUNCTION prevent_delete_current_academic_year()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_current = true THEN
    RAISE EXCEPTION 'Cannot delete the current academic year. Please set another year as current first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER academic_years_prevent_delete_current
  BEFORE DELETE ON academic_years
  FOR EACH ROW
  WHEN (OLD.is_current = true)
  EXECUTE FUNCTION prevent_delete_current_academic_year();

-- ============================================
-- Trigger: Prevent deletion of default grading scale
-- ============================================

CREATE OR REPLACE FUNCTION prevent_delete_default_grading_scale()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_default = true THEN
    RAISE EXCEPTION 'Cannot delete the default grading scale. Please set another scale as default first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER grading_scales_prevent_delete_default
  BEFORE DELETE ON grading_scales
  FOR EACH ROW
  WHEN (OLD.is_default = true)
  EXECUTE FUNCTION prevent_delete_default_grading_scale();

-- ============================================
-- Trigger: Prevent deletion of main campus
-- ============================================

CREATE OR REPLACE FUNCTION prevent_delete_main_campus()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_main = true THEN
    RAISE EXCEPTION 'Cannot delete the main campus. Please set another campus as main first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER campuses_prevent_delete_main
  BEFORE DELETE ON campuses
  FOR EACH ROW
  WHEN (OLD.is_main = true)
  EXECUTE FUNCTION prevent_delete_main_campus();

-- ============================================
-- Trigger: Validate teacher role on assignment
-- ============================================

CREATE OR REPLACE FUNCTION validate_teacher_role_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate that teacher_id references a user with role 'teacher'
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = NEW.teacher_id
    AND r.name = 'teacher'
  ) THEN
    RAISE EXCEPTION 'Teacher assignment must reference a user with role "teacher"';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER teacher_assignments_validate_teacher_role
  BEFORE INSERT OR UPDATE ON teacher_assignments
  FOR EACH ROW
  EXECUTE FUNCTION validate_teacher_role_on_assignment();

-- ============================================
-- Trigger: Prevent deletion of academic year with associated classes
-- ============================================

CREATE OR REPLACE FUNCTION prevent_delete_academic_year_with_classes()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM classes
    WHERE classes.academic_year_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete academic year that has associated classes. Please delete or reassign the classes first.';
  END IF;

  -- Also check for periods
  IF EXISTS (
    SELECT 1 FROM periods
    WHERE periods.academic_year_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete academic year that has associated periods. Please delete the periods first.';
  END IF;

  -- Also check for teacher assignments
  IF EXISTS (
    SELECT 1 FROM teacher_assignments
    WHERE teacher_assignments.academic_year_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete academic year that has associated teacher assignments. Please delete the assignments first.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER academic_years_prevent_delete_with_dependencies
  BEFORE DELETE ON academic_years
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_academic_year_with_classes();

-- ============================================
-- Trigger: Prevent deletion of level with associated classes
-- ============================================

CREATE OR REPLACE FUNCTION prevent_delete_level_with_classes()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM classes
    WHERE classes.level_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete level that has associated classes. Please delete or reassign the classes first.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER levels_prevent_delete_with_dependencies
  BEFORE DELETE ON levels
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_level_with_classes();

-- ============================================
-- Trigger: Prevent deletion of subject with associated teacher assignments
-- ============================================

CREATE OR REPLACE FUNCTION prevent_delete_subject_with_assignments()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM teacher_assignments
    WHERE teacher_assignments.subject_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete subject that has associated teacher assignments. Please delete the assignments first.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER subjects_prevent_delete_with_dependencies
  BEFORE DELETE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_subject_with_assignments();

-- ============================================
-- Trigger: Prevent deletion of campus with associated rooms
-- ============================================

CREATE OR REPLACE FUNCTION prevent_delete_campus_with_rooms()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.campus_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot delete campus that has associated rooms. Please delete or reassign the rooms first.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER campuses_prevent_delete_with_dependencies
  BEFORE DELETE ON campuses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_campus_with_rooms();

-- ============================================
-- Trigger: Auto-update room availability if room is deleted
-- (Classes should have room_id set to NULL if room is deleted)
-- This is handled by ON DELETE SET NULL in the FK constraint
-- ============================================

-- ============================================
-- END OF MIGRATION
-- ============================================
