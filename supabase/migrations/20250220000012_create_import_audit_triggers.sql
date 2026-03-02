-- Audit trigger for import_templates
CREATE OR REPLACE FUNCTION log_import_template_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      action, resource_type, resource_id, user_id, school_id, details
    )
    VALUES (
      'import_template_created',
      'import_template',
      NEW.id,
      NEW.created_by,
      NEW.school_id,
      jsonb_build_object(
        'name', NEW.name,
        'import_type', NEW.import_type,
        'column_mapping', NEW.column_mapping
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      action, resource_type, resource_id, user_id, school_id, details
    )
    VALUES (
      'import_template_updated',
      'import_template',
      NEW.id,
      NEW.created_by,
      NEW.school_id,
      jsonb_build_object(
        'name', NEW.name,
        'changes', jsonb_build_object(
          'old', jsonb_build_object('column_mapping', OLD.column_mapping),
          'new', jsonb_build_object('column_mapping', NEW.column_mapping)
        )
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      action, resource_type, resource_id, user_id, school_id, details
    )
    VALUES (
      'import_template_deleted',
      'import_template',
      OLD.id,
      OLD.created_by,
      OLD.school_id,
      jsonb_build_object('name', OLD.name)
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER import_template_audit
  AFTER INSERT OR UPDATE OR DELETE ON import_templates
  FOR EACH ROW EXECUTE FUNCTION log_import_template_changes();

-- Audit trigger for import_jobs status changes
CREATE OR REPLACE FUNCTION log_import_job_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO audit_logs (
      action, resource_type, resource_id, user_id, school_id, details
    )
    SELECT
      CASE
        WHEN NEW.status = 'parsing' THEN 'import_started'
        WHEN NEW.status = 'completed' THEN 'import_completed'
        WHEN NEW.status = 'failed' THEN 'import_failed'
        WHEN NEW.status = 'rolled_back' THEN 'import_rolled_back'
        ELSE 'import_status_changed'
      END,
      'import_job',
      NEW.id,
      NEW.initiated_by,
      NEW.school_id,
      jsonb_build_object(
        'import_type', NEW.import_type,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'total_rows', NEW.total_rows,
        'valid_rows', NEW.valid_rows,
        'imported_rows', NEW.imported_rows,
        'error_message', NEW.error_message
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER import_job_status_audit
  AFTER UPDATE OF status ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION log_import_job_status_changes();

-- Audit trigger for initial import job creation
CREATE OR REPLACE FUNCTION log_import_job_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action, resource_type, resource_id, user_id, school_id, details
  )
  VALUES (
    'import_job_created',
    'import_job',
    NEW.id,
    NEW.initiated_by,
    NEW.school_id,
    jsonb_build_object(
      'import_type', NEW.import_type,
      'file_name', NEW.file_name,
      'file_size_bytes', NEW.file_size_bytes
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER import_job_creation_audit
  AFTER INSERT ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION log_import_job_creation();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_import_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_import_updated_at();

CREATE TRIGGER update_import_templates_updated_at
  BEFORE UPDATE ON import_templates
  FOR EACH ROW EXECUTE FUNCTION update_import_updated_at();
