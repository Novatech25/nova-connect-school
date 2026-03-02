-- ============================================
-- Module Premium - API Export Avancé
-- Migration: Audit Triggers for Export Tables
-- ============================================

-- ============================================
-- Trigger Function: Audit log for export_templates
-- ============================================
CREATE OR REPLACE FUNCTION audit_export_templates()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  school_id UUID;
  action_text VARCHAR(50);
  metadata JSONB;
BEGIN
  -- Get user ID from current context (for service role, this will be NULL)
  user_id := auth.uid();

  -- Build metadata
  metadata := jsonb_build_object(
    'template_id', NEW.id,
    'template_name', NEW.name,
    'export_type', NEW.export_type,
    'resource_type', NEW.resource_type,
    'is_active', NEW.is_active
  );

  -- Determine action based on operation
  IF (TG_OP = 'INSERT') THEN
    action_text := 'CREATE_EXPORT_TEMPLATE';
    school_id := NEW.school_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    action_text := 'UPDATE_EXPORT_TEMPLATE';
    school_id := NEW.school_id;
    metadata := metadata || jsonb_build_object(
      'changes', jsonb_build_object(
        'name', CASE WHEN NEW.name != OLD.name THEN NEW.name ELSE NULL END,
        'is_active', CASE WHEN NEW.is_active != OLD.is_active THEN NEW.is_active ELSE NULL END,
        'template_config', CASE WHEN NEW.template_config != OLD.template_config THEN 'modified' ELSE NULL END
      )
    );
  ELSIF (TG_OP = 'DELETE') THEN
    action_text := 'DELETE_EXPORT_TEMPLATE';
    school_id := OLD.school_id;
    metadata := jsonb_build_object(
      'template_id', OLD.id,
      'template_name', OLD.name,
      'export_type', OLD.export_type,
      'resource_type', OLD.resource_type
    );
  END IF;

  -- Insert audit log (if user_id is available)
  IF user_id IS NOT NULL THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, school_id, user_id, metadata, ip_address, user_agent)
    VALUES (
      action_text,
      'export_template',
      COALESCE(NEW.id, OLD.id),
      school_id,
      user_id,
      metadata,
      inet_client_addr()::TEXT,
      current_setting('request.headers')::JSON->>'user-agent'
    );
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for export_templates
CREATE TRIGGER audit_export_templates_insert
  AFTER INSERT ON export_templates
  FOR EACH ROW
  EXECUTE FUNCTION audit_export_templates();

CREATE TRIGGER audit_export_templates_update
  AFTER UPDATE ON export_templates
  FOR EACH ROW
  EXECUTE FUNCTION audit_export_templates();

CREATE TRIGGER audit_export_templates_delete
  AFTER DELETE ON export_templates
  FOR EACH ROW
  EXECUTE FUNCTION audit_export_templates();

-- ============================================
-- Trigger Function: Audit log for export_jobs
-- ============================================
CREATE OR REPLACE FUNCTION audit_export_jobs()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  action_text VARCHAR(50);
  metadata JSONB;
BEGIN
  -- Get user ID from current context
  user_id := COALESCE(NEW.initiated_by, auth.uid());

  -- Build metadata
  metadata := jsonb_build_object(
    'job_id', NEW.id,
    'export_type', NEW.export_type,
    'resource_type', NEW.resource_type,
    'status', NEW.status,
    'row_count', NEW.row_count,
    'file_size_bytes', NEW.file_size_bytes,
    'scheduled_job_id', NEW.scheduled_job_id
  );

  -- Determine action based on operation
  IF (TG_OP = 'INSERT') THEN
    action_text := 'EXPORT_JOB_CREATED';

    -- Add file path if available (for completed jobs)
    IF NEW.file_path IS NOT NULL THEN
      metadata := metadata || jsonb_build_object('file_path', NEW.file_path);
    END IF;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Only log status changes
    IF NEW.status != OLD.status THEN
      action_text := 'EXPORT_JOB_STATUS_CHANGED';
      metadata := metadata || jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'error_message', NEW.error_message
      );

      -- Add duration info if completed
      IF NEW.status = 'completed' AND NEW.completed_at IS NOT NULL AND OLD.started_at IS NOT NULL THEN
        metadata := metadata || jsonb_build_object(
          'duration_seconds', EXTRACT(EPOCH FROM (NEW.completed_at - OLD.started_at))
        );
      END IF;

      -- Add error info if failed
      IF NEW.status = 'failed' AND NEW.error_message IS NOT NULL THEN
        metadata := metadata || jsonb_build_object(
          'error_message', NEW.error_message
        );
      END IF;
    ELSE
      -- Skip logging if no status change
      RETURN NEW;
    END IF;
  END IF;

  -- Insert audit log
  IF user_id IS NOT NULL THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, school_id, user_id, metadata, ip_address, user_agent)
    VALUES (
      action_text,
      'export_job',
      NEW.id,
      NEW.school_id,
      user_id,
      metadata,
      inet_client_addr()::TEXT,
      current_setting('request.headers')::JSON->>'user-agent'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for export_jobs
CREATE TRIGGER audit_export_jobs_insert
  AFTER INSERT ON export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION audit_export_jobs();

CREATE TRIGGER audit_export_jobs_update
  AFTER UPDATE ON export_jobs
  FOR EACH ROW
  WHEN (NEW.status != OLD.status)
  EXECUTE FUNCTION audit_export_jobs();

-- ============================================
-- Trigger Function: Audit log for scheduled_exports
-- ============================================
CREATE OR REPLACE FUNCTION audit_scheduled_exports()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  school_id UUID;
  action_text VARCHAR(50);
  metadata JSONB;
BEGIN
  -- Get user ID from current context
  user_id := auth.uid();

  -- Build metadata
  metadata := jsonb_build_object(
    'scheduled_export_id', COALESCE(NEW.id, OLD.id),
    'name', COALESCE(NEW.name, OLD.name),
    'cron_expression', COALESCE(NEW.cron_expression, OLD.cron_expression),
    'is_active', COALESCE(NEW.is_active, OLD.is_active),
    'recipients', COALESCE(NEW.recipients, OLD.recipients)
  );

  -- Determine action based on operation
  IF (TG_OP = 'INSERT') THEN
    action_text := 'CREATE_SCHEDULED_EXPORT';
    school_id := NEW.school_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    school_id := NEW.school_id;

    -- Check what changed
    IF NEW.is_active != OLD.is_active THEN
      action_text := CASE
        WHEN NEW.is_active = TRUE THEN 'ACTIVATE_SCHEDULED_EXPORT'
        ELSE 'DEACTIVATE_SCHEDULED_EXPORT'
      END;
    ELSE
      action_text := 'UPDATE_SCHEDULED_EXPORT';
      metadata := metadata || jsonb_build_object(
        'changes', jsonb_build_object(
          'name', CASE WHEN NEW.name != OLD.name THEN NEW.name ELSE NULL END,
          'cron_expression', CASE WHEN NEW.cron_expression != OLD.cron_expression THEN NEW.cron_expression ELSE NULL END
        )
      );
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    action_text := 'DELETE_SCHEDULED_EXPORT';
    school_id := OLD.school_id;
  END IF;

  -- Insert audit log (if user_id is available)
  IF user_id IS NOT NULL THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, school_id, user_id, metadata, ip_address, user_agent)
    VALUES (
      action_text,
      'scheduled_export',
      COALESCE(NEW.id, OLD.id),
      school_id,
      user_id,
      metadata,
      inet_client_addr()::TEXT,
      current_setting('request.headers')::JSON->>'user-agent'
    );
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for scheduled_exports
CREATE TRIGGER audit_scheduled_exports_insert
  AFTER INSERT ON scheduled_exports
  FOR EACH ROW
  EXECUTE FUNCTION audit_scheduled_exports();

CREATE TRIGGER audit_scheduled_exports_update
  AFTER UPDATE ON scheduled_exports
  FOR EACH ROW
  EXECUTE FUNCTION audit_scheduled_exports();

CREATE TRIGGER audit_scheduled_exports_delete
  AFTER DELETE ON scheduled_exports
  FOR EACH ROW
  EXECUTE FUNCTION audit_scheduled_exports();

-- ============================================
-- Trigger Function: Audit log for export_api_tokens
-- ============================================
CREATE OR REPLACE FUNCTION audit_export_api_tokens()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  school_id UUID;
  action_text VARCHAR(50);
  metadata JSONB;
BEGIN
  -- Get user ID from current context
  user_id := auth.uid();

  -- Build metadata (never include actual token hash in logs!)
  metadata := jsonb_build_object(
    'token_id', COALESCE(NEW.id, OLD.id),
    'token_name', COALESCE(NEW.name, OLD.name),
    'permissions', COALESCE(NEW.permissions, OLD.permissions),
    'rate_limit_per_hour', COALESCE(NEW.rate_limit_per_hour, OLD.rate_limit_per_hour),
    'expires_at', COALESCE(NEW.expires_at, OLD.expires_at)
  );

  -- Determine action based on operation
  IF (TG_OP = 'INSERT') THEN
    action_text := 'CREATE_API_TOKEN';
    school_id := NEW.school_id;
    metadata := metadata || jsonb_build_object(
      'token_created', true,
      'permissions_count', jsonb_array_length(NEW.permissions)
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    school_id := NEW.school_id;

    -- Check if token was revoked
    IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
      action_text := 'REVOKE_API_TOKEN';
      metadata := metadata || jsonb_build_object('revoked_at', NEW.revoked_at);
    ELSE
      action_text := 'UPDATE_API_TOKEN';
      metadata := metadata || jsonb_build_object(
        'changes', jsonb_build_object(
          'name', CASE WHEN NEW.name != OLD.name THEN NEW.name ELSE NULL END,
          'rate_limit_per_hour', CASE WHEN NEW.rate_limit_per_hour != OLD.rate_limit_per_hour THEN NEW.rate_limit_per_hour ELSE NULL END
        )
      );
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    action_text := 'DELETE_API_TOKEN';
    school_id := OLD.school_id;
  END IF;

  -- Insert audit log (if user_id is available)
  IF user_id IS NOT NULL THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, school_id, user_id, metadata, ip_address, user_agent)
    VALUES (
      action_text,
      'export_api_token',
      COALESCE(NEW.id, OLD.id),
      school_id,
      user_id,
      metadata,
      inet_client_addr()::TEXT,
      current_setting('request.headers')::JSON->>'user-agent'
    );
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for export_api_tokens
CREATE TRIGGER audit_export_api_tokens_insert
  AFTER INSERT ON export_api_tokens
  FOR EACH ROW
  EXECUTE FUNCTION audit_export_api_tokens();

CREATE TRIGGER audit_export_api_tokens_update
  AFTER UPDATE ON export_api_tokens
  FOR EACH ROW
  EXECUTE FUNCTION audit_export_api_tokens();

CREATE TRIGGER audit_export_api_tokens_delete
  AFTER DELETE ON export_api_tokens
  FOR EACH ROW
  EXECUTE FUNCTION audit_export_api_tokens();

-- ============================================
-- Trigger Function: Track API token usage
-- ============================================
CREATE OR REPLACE FUNCTION track_api_token_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update usage count and last used timestamp
  UPDATE export_api_tokens
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = NEW.token_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This trigger will be called from the Edge Function when processing API requests
-- We'll add a manual call in the Edge Function rather than a database trigger

-- ============================================
-- Comments
-- ============================================

COMMENT ON FUNCTION audit_export_templates IS 'Audit trigger for export_templates table';
COMMENT ON FUNCTION audit_export_jobs IS 'Audit trigger for export_jobs table - logs status changes';
COMMENT ON FUNCTION audit_scheduled_exports IS 'Audit trigger for scheduled_exports table';
COMMENT ON FUNCTION audit_export_api_tokens IS 'Audit trigger for export_api_tokens table';
COMMENT ON FUNCTION track_api_token_usage IS 'Track API token usage (called from Edge Functions)';
