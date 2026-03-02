-- Ensure audit logging functions can write despite RLS on audit_logs

CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow audit insert from trigger even when RLS is enabled
  PERFORM set_config('row_security', 'off', true);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, new_data)
    VALUES (
      NEW.school_id,
      auth.uid(),
      'INSERT',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, old_data, new_data)
    VALUES (
      COALESCE(NEW.school_id, OLD.school_id),
      auth.uid(),
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, old_data)
    VALUES (
      OLD.school_id,
      auth.uid(),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION log_custom_action(
  p_action audit_action_enum,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_school_id UUID;
  v_audit_log_id UUID;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  v_user_id := auth.uid();

  SELECT school_id INTO v_school_id
  FROM users
  WHERE id = v_user_id;

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
$$;
