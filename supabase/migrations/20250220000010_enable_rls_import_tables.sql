-- Enable RLS on all import tables

-- import_jobs
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins can view their import jobs"
  ON import_jobs FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = import_jobs.school_id
    )
  );

CREATE POLICY "School admins can create import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND initiated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = import_jobs.school_id
    )
  );

CREATE POLICY "School admins can update their import jobs"
  ON import_jobs FOR UPDATE
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = import_jobs.school_id
    )
  );

CREATE POLICY "School admins can delete failed or completed import jobs"
  ON import_jobs FOR DELETE
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND status IN ('failed', 'completed', 'rolled_back')
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = import_jobs.school_id
    )
  );

-- import_templates
ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins can view their import templates"
  ON import_templates FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
        AND ur.school_id = import_templates.school_id
      )
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name = 'accountant'
        AND ur.school_id = import_templates.school_id
      )
    )
  );

CREATE POLICY "School admins can create import templates"
  ON import_templates FOR INSERT
  WITH CHECK (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = import_templates.school_id
    )
  );

CREATE POLICY "School admins can update import templates"
  ON import_templates FOR UPDATE
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = import_templates.school_id
    )
  );

CREATE POLICY "School admins can delete import templates"
  ON import_templates FOR DELETE
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = import_templates.school_id
    )
  );

-- import_history
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins can view import history"
  ON import_history FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = import_history.school_id
    )
  );

-- import_history is read-only (no INSERT/UPDATE/DELETE policies)
