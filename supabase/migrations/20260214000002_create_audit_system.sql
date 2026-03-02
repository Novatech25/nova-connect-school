-- Migration: Create complete audit system for student cards
-- Created: 2026-02-14
-- Description: Properly create audit_logs table and log_audit_event function

-- Create audit_logs table if not exists
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  description TEXT,
  school_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing function if exists (to recreate properly)
DROP FUNCTION IF EXISTS log_audit_event(TEXT, UUID, TEXT, TEXT, TEXT, UUID);

-- Create log_audit_event function
CREATE OR REPLACE FUNCTION log_audit_event(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_table_name TEXT,
  p_description TEXT,
  p_school_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Insert audit log
  INSERT INTO audit_logs (
    entity_type,
    entity_id,
    action,
    table_name,
    description,
    school_id,
    user_id
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_action,
    p_table_name,
    p_description,
    p_school_id,
    v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policy for audit_logs
DROP POLICY IF EXISTS "Audit logs viewable by admins" ON audit_logs;
CREATE POLICY "Audit logs viewable by admins" ON audit_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT ur.user_id FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name IN ('super_admin', 'school_admin')
      AND (ur.school_id = audit_logs.school_id OR r.name = 'super_admin')
    )
  );

-- Recreate audit triggers for card_templates
CREATE OR REPLACE FUNCTION audit_card_templates()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'card_template',
      NEW.id,
      'create',
      'card_templates',
      'Created card template: ' || COALESCE(NEW.name, 'Unnamed'),
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'card_template',
      NEW.id,
      'update',
      'card_templates',
      'Updated card template: ' || COALESCE(NEW.name, 'Unnamed'),
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'card_template',
      OLD.id,
      'delete',
      'card_templates',
      'Deleted card template: ' || COALESCE(OLD.name, 'Unnamed'),
      OLD.school_id
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for card_templates
DROP TRIGGER IF EXISTS card_templates_audit_trigger ON card_templates;
CREATE TRIGGER card_templates_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON card_templates
  FOR EACH ROW
  EXECUTE FUNCTION audit_card_templates();

-- Recreate audit triggers for student_cards
CREATE OR REPLACE FUNCTION audit_student_cards()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'student_card',
      NEW.id,
      'create',
      'student_cards',
      'Created student card for student: ' || NEW.student_id,
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log status changes
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM log_audit_event(
        'student_card',
        NEW.id,
        'update',
        'student_cards',
        'Changed card status from ' || OLD.status || ' to ' || NEW.status,
        NEW.school_id
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'student_card',
      OLD.id,
      'delete',
      'student_cards',
      'Deleted student card',
      OLD.school_id
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for student_cards
DROP TRIGGER IF EXISTS student_cards_audit_trigger ON student_cards;
CREATE TRIGGER student_cards_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON student_cards
  FOR EACH ROW
  EXECUTE FUNCTION audit_student_cards();

COMMENT ON FUNCTION log_audit_event IS 'Logs audit events for student card operations';
