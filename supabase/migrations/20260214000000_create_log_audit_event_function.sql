-- Migration: Create log_audit_event function
-- Created: 2026-02-14
-- Description: Function to log audit events for student card operations

-- Create the audit_logs table if it doesn't exist
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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create the log_audit_event function
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
  -- Get current user ID from auth
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

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for audit_logs
CREATE POLICY "Audit logs are viewable by school admins" ON audit_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name IN ('super_admin', 'school_admin')
      AND (ur.school_id = audit_logs.school_id OR r.name = 'super_admin')
    )
  );

COMMENT ON FUNCTION log_audit_event IS 'Logs an audit event for tracking changes to student cards and templates';
