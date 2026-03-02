-- ============================================
-- Module Premium - API Export Avancé
-- Migration: RLS Policies for Export Tables
-- ============================================

-- Enable RLS on all export tables
ALTER TABLE export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_api_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Policies: export_templates
-- ============================================

-- School admins can view templates from their school
CREATE POLICY "School admins can view their export templates"
  ON export_templates FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Accountants can view templates from their school
CREATE POLICY "Accountants can view their export templates"
  ON export_templates FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- School admins can create templates for their school
CREATE POLICY "School admins can create export templates"
  ON export_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- School admins can update templates from their school
CREATE POLICY "School admins can update export templates"
  ON export_templates FOR UPDATE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- School admins can delete templates from their school
CREATE POLICY "School admins can delete export templates"
  ON export_templates FOR DELETE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Super admins have full access (via service role, no policy needed for service_role)

-- ============================================
-- Policies: export_jobs
-- ============================================

-- School admins can view export jobs from their school
CREATE POLICY "School admins can view their export jobs"
  ON export_jobs FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Accountants can view export jobs from their school
CREATE POLICY "Accountants can view their export jobs"
  ON export_jobs FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Users can view export jobs they initiated
CREATE POLICY "Users can view their initiated export jobs"
  ON export_jobs FOR SELECT
  TO authenticated
  USING (initiated_by = auth.uid());

-- Service role can insert jobs (via Edge Functions)
CREATE POLICY "Service role can insert export jobs"
  ON export_jobs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- School admins can insert export jobs for their school
CREATE POLICY "School admins can insert export jobs"
  ON export_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND initiated_by = auth.uid()
  );

-- Accountants can insert export jobs for their school
CREATE POLICY "Accountants can insert export jobs"
  ON export_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND initiated_by = auth.uid()
  );

-- Service role can update jobs (via Edge Functions)
CREATE POLICY "Service role can update export jobs"
  ON export_jobs FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- School admins can update export jobs for their school
CREATE POLICY "School admins can update export jobs"
  ON export_jobs FOR UPDATE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Accountants can update export jobs for their school
CREATE POLICY "Accountants can update export jobs"
  ON export_jobs FOR UPDATE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- School admins can delete (soft delete) jobs from their school
CREATE POLICY "School admins can delete export jobs"
  ON export_jobs FOR DELETE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Policies: scheduled_exports
-- ============================================

-- School admins can view scheduled exports from their school
CREATE POLICY "School admins can view their scheduled exports"
  ON scheduled_exports FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Accountants can view scheduled exports from their school
CREATE POLICY "Accountants can view their scheduled exports"
  ON scheduled_exports FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- School admins can create scheduled exports for their school
CREATE POLICY "School admins can create scheduled exports"
  ON scheduled_exports FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- School admins can update scheduled exports from their school
CREATE POLICY "School admins can update scheduled exports"
  ON scheduled_exports FOR UPDATE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- School admins can delete scheduled exports from their school
CREATE POLICY "School admins can delete scheduled exports"
  ON scheduled_exports FOR DELETE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Policies: export_api_tokens
-- ============================================

-- School admins can view API tokens from their school
CREATE POLICY "School admins can view their API tokens"
  ON export_api_tokens FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- School admins can create API tokens for their school
CREATE POLICY "School admins can create API tokens"
  ON export_api_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- School admins can update API tokens from their school
CREATE POLICY "School admins can update API tokens"
  ON export_api_tokens FOR UPDATE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- School admins can revoke (delete) API tokens from their school
CREATE POLICY "School admins can revoke API tokens"
  ON export_api_tokens FOR DELETE
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Service role needs to update API tokens (for usage tracking)
CREATE POLICY "Service role can update API tokens"
  ON export_api_tokens FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Security Helper Functions
-- ============================================

-- Function to check if user can access export system for a school
CREATE OR REPLACE FUNCTION can_access_export_system(user_id UUID, school_id UUID)
RETURNS BOOLEAN AS $$
  DECLARE
    is_school_admin BOOLEAN := FALSE;
    is_accountant BOOLEAN := FALSE;
  BEGIN
    -- Check if user is school admin
    SELECT EXISTS(
      SELECT 1 FROM school_admins
      WHERE school_admins.user_id = can_access_export_system.user_id
      AND school_admins.school_id = can_access_export_system.school_id
    ) INTO is_school_admin;

    -- Check if user is accountant
    SELECT EXISTS(
      SELECT 1 FROM school_accountants
      WHERE school_accountants.user_id = can_access_export_system.user_id
      AND school_accountants.school_id = can_access_export_system.school_id
    ) INTO is_accountant;

    RETURN is_school_admin OR is_accountant;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if API token is valid and has permission
CREATE OR REPLACE FUNCTION validate_export_token(token_hash TEXT, resource_type export_resource_enum)
RETURNS TABLE(
  school_id UUID,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
  DECLARE
    token_record RECORD;
    now_tz TIMESTAMPTZ := NOW();
  BEGIN
    -- Get token record
    SELECT * INTO token_record
    FROM export_api_tokens
    WHERE export_api_tokens.token_hash = validate_export_token.token_hash
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now_tz);

    -- Token not found or expired/revoked
    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid or expired token'::TEXT;
      RETURN;
    END IF;

    -- Check permissions
    IF NOT (token_record.permissions @> JSONB_BUILD_ARRAY(resource_type)) THEN
      RETURN QUERY SELECT token_record.school_id, FALSE, 'Insufficient permissions for this resource type'::TEXT;
      RETURN;
    END IF;

    -- Check rate limit
    IF token_record.rate_limit_per_hour > 0 THEN
      IF EXISTS(
        SELECT 1
        FROM audit_logs
        WHERE action = 'EXPORT_API_REQUEST'
        AND school_id = token_record.school_id
        AND created_at > now_tz - INTERVAL '1 hour'
        GROUP BY (metadata->>'token_id')::UUID
        HAVING COUNT(*) >= token_record.rate_limit_per_hour
      ) THEN
        RETURN QUERY SELECT token_record.school_id, FALSE, 'Rate limit exceeded'::TEXT;
        RETURN;
      END IF;
    END IF;

    -- Token is valid
    RETURN QUERY SELECT token_record.school_id, TRUE, NULL::TEXT;
    RETURN;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Comments
-- ============================================

COMMENT ON FUNCTION can_access_export_system IS 'Check if user (school admin or accountant) can access export system for a school';
COMMENT ON FUNCTION validate_export_token IS 'Validate API token and check permissions and rate limits';
