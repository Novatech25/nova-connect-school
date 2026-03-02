-- ============================================================================
-- AUDIT TRIGGER FUNCTION
-- ============================================================================

-- Generic audit trigger function that logs all changes
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  school_id UUID;
  resource_type TEXT;
  action audit_action_enum;
BEGIN
  -- Get current user ID
  user_id := auth.uid();

  -- Determine resource type from table name
  resource_type := TG_TABLE_NAME;

  -- Determine action based on operation
  IF (TG_OP = 'DELETE') THEN
    action := 'DELETE';
    school_id := OLD.school_id;

    -- Insert audit log for delete
    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      resource_type,
      resource_id,
      old_data,
      metadata
    ) VALUES (
      school_id,
      user_id,
      action,
      resource_type,
      OLD.id,
      to_jsonb(OLD),
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP
      )
    );

    RETURN OLD;

  ELSIF (TG_OP = 'UPDATE') THEN
    action := 'UPDATE';
    school_id := COALESCE(NEW.school_id, OLD.school_id);

    -- Insert audit log for update
    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      resource_type,
      resource_id,
      old_data,
      new_data,
      metadata
    ) VALUES (
      school_id,
      user_id,
      action,
      resource_type,
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'changed_fields',
        (
          SELECT jsonb_object_keys(to_jsonb(NEW) - to_jsonb(OLD))
        )
      )
    );

    RETURN NEW;

  ELSIF (TG_OP = 'INSERT') THEN
    action := 'INSERT';
    school_id := NEW.school_id;

    -- Insert audit log for insert
    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      resource_type,
      resource_id,
      new_data,
      metadata
    ) VALUES (
      school_id,
      user_id,
      action,
      resource_type,
      NEW.id,
      to_jsonb(NEW),
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP
      )
    );

    RETURN NEW;
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Audit trigger failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUDIT TRIGGERS ON CORE TABLES
-- ============================================================================

-- Audit trigger on schools
CREATE TRIGGER audit_schools
AFTER INSERT OR UPDATE OR DELETE ON schools
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger on users
CREATE TRIGGER audit_users
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger on user_roles
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- CUSTOM AUDIT LOGGING FUNCTION
-- ============================================================================

-- Function to log custom actions (LOGIN, LOGOUT, EXPORT, VALIDATE, etc.)
CREATE OR REPLACE FUNCTION log_custom_action(
  p_action audit_action_enum,
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
  -- Get current user ID
  v_user_id := auth.uid();

  -- Get current user's school_id
  SELECT school_id INTO v_school_id
  FROM users
  WHERE id = v_user_id;

  -- Insert audit log
  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    v_school_id,
    v_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    inet_client_addr(),
    current_setting('request.headers', TRUE)::JSON->>'user-agent'
  ) RETURNING id INTO v_audit_log_id;

  RETURN v_audit_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS FOR AUDIT FUNCTIONS
-- ============================================================================

-- Grant execute on audit functions to authenticated users
GRANT EXECUTE ON FUNCTION log_custom_action TO authenticated;

-- Grant insert on audit_logs (triggers run with definer rights, so this is for manual logging)
GRANT INSERT ON audit_logs TO authenticated;

-- Grant select on audit_logs (via RLS policies)
GRANT SELECT ON audit_logs TO authenticated;

-- ============================================================================
-- HELPER FUNCTIONS FOR SPECIFIC AUDIT SCENARIOS
-- ============================================================================

-- Log user login
CREATE OR REPLACE FUNCTION log_login()
RETURNS UUID AS $$
BEGIN
  RETURN log_custom_action(
    'LOGIN',
    'auth',
    auth.uid(),
    jsonb_build_object('timestamp', NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log user logout
CREATE OR REPLACE FUNCTION log_logout()
RETURNS UUID AS $$
BEGIN
  RETURN log_custom_action(
    'LOGOUT',
    'auth',
    auth.uid(),
    jsonb_build_object('timestamp', NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log data export
CREATE OR REPLACE FUNCTION log_export(
  p_resource_type TEXT,
  p_filters JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
BEGIN
  RETURN log_custom_action(
    'EXPORT',
    p_resource_type,
    NULL,
    jsonb_build_object(
      'filters', p_filters,
      'timestamp', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log data validation
CREATE OR REPLACE FUNCTION log_validation(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_validation_result JSONB
)
RETURNS UUID AS $$
BEGIN
  RETURN log_custom_action(
    'VALIDATE',
    p_resource_type,
    p_resource_id,
    jsonb_build_object(
      'validation_result', p_validation_result,
      'timestamp', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS FOR HELPER FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION log_login TO authenticated;
GRANT EXECUTE ON FUNCTION log_logout TO authenticated;
GRANT EXECUTE ON FUNCTION log_export TO authenticated;
GRANT EXECUTE ON FUNCTION log_validation TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION audit_trigger_function() IS 'Generic trigger function that automatically logs all INSERT/UPDATE/DELETE operations';
COMMENT ON FUNCTION log_custom_action(audit_action_enum, TEXT, UUID, JSONB) IS 'Log custom actions like LOGIN, LOGOUT, EXPORT, VALIDATE';
COMMENT ON FUNCTION log_login() IS 'Log user login event';
COMMENT ON FUNCTION log_logout() IS 'Log user logout event';
COMMENT ON FUNCTION log_export(TEXT, JSONB) IS 'Log data export event';
COMMENT ON FUNCTION log_validation(TEXT, UUID, JSONB) IS 'Log data validation event';

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Manual custom logging:
-- SELECT log_custom_action('LOGIN', 'auth', NULL, '{"ip": "192.168.1.1"}'::jsonb);
-- SELECT log_custom_action('EXPORT', 'students', NULL, '{"format": "csv", "count": 150}'::jsonb);
-- SELECT log_validation('grades', 'grade-uuid', '{"valid": true, "validator": "teacher-uuid"}'::jsonb);

-- Automatic logging via triggers (INSERT/UPDATE/DELETE):
-- INSERT INTO schools (name, code) VALUES ('Test School', 'TEST');
-- UPDATE users SET first_name = 'John' WHERE id = 'user-uuid';
-- DELETE FROM user_roles WHERE id = 'role-uuid';
