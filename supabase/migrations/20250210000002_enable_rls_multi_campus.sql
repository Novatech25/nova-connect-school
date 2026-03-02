-- Migration: Multi-Campus RLS Policies with Premium Verification
-- Description: Implement Row Level Security policies for multi-campus features
-- Version: 1.0.0

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Check if multi-campus module is enabled for a school
CREATE OR REPLACE FUNCTION check_multi_campus_enabled(p_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM licenses l
    JOIN schools s ON s.id = l.school_id
    WHERE l.school_id = p_school_id
      AND l.status = 'active'
      AND l.expires_at >= NOW()
      AND l.license_type IN ('premium', 'enterprise')
      AND 'multi_campus' = ANY(s.enabled_modules)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user has access to a specific campus
CREATE OR REPLACE FUNCTION check_user_campus_access(p_user_id UUID, p_campus_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_school_id UUID;
  v_campus_school_id UUID;
BEGIN
  -- Check if user has explicit access
  IF EXISTS (
    SELECT 1
    FROM user_campus_access uca
    JOIN users u ON u.id = uca.user_id
    JOIN campuses c ON c.id = uca.campus_id
    WHERE uca.user_id = p_user_id
      AND uca.campus_id = p_campus_id
      AND uca.can_access = true
      AND u.school_id = c.school_id
  ) THEN
    RETURN true;
  END IF;

  -- Get user's school_id
  SELECT school_id INTO v_user_school_id
  FROM users
  WHERE id = p_user_id
  LIMIT 1;

  -- Get campus's school_id
  SELECT school_id INTO v_campus_school_id
  FROM campuses
  WHERE id = p_campus_id
  LIMIT 1;

  -- Check if user is admin AND belongs to the same school as the campus
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE id = p_user_id
      AND r.name IN ('school_admin', 'supervisor')
      AND school_id = v_campus_school_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user's school ID
CREATE OR REPLACE FUNCTION get_user_school_id(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT school_id
    FROM users
    WHERE id = p_user_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES: USER_CAMPUS_ACCESS
-- ============================================================================

-- Policy: Users can see their own campus access
DROP POLICY IF EXISTS user_campus_access_select_own ON user_campus_access;
CREATE POLICY user_campus_access_select_own
  ON user_campus_access
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      check_multi_campus_enabled(get_user_school_id(auth.uid())) = false
      AND school_id = get_user_school_id(auth.uid())
    )
  );

-- Policy: School admins can see all campus access for their school
DROP POLICY IF EXISTS user_campus_access_select_school_admin ON user_campus_access;
CREATE POLICY user_campus_access_select_school_admin
  ON user_campus_access
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = user_campus_access.school_id
    )
  );

-- Policy: School admins can insert campus access (only if multi-campus enabled)
DROP POLICY IF EXISTS user_campus_access_insert_school_admin ON user_campus_access;
CREATE POLICY user_campus_access_insert_school_admin
  ON user_campus_access
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = user_campus_access.school_id
        AND check_multi_campus_enabled(user_campus_access.school_id) = true
    )
  );

-- Policy: School admins can update campus access
DROP POLICY IF EXISTS user_campus_access_update_school_admin ON user_campus_access;
CREATE POLICY user_campus_access_update_school_admin
  ON user_campus_access
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = user_campus_access.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = user_campus_access.school_id
    )
  );

-- Policy: School admins can delete campus access
DROP POLICY IF EXISTS user_campus_access_delete_school_admin ON user_campus_access;
CREATE POLICY user_campus_access_delete_school_admin
  ON user_campus_access
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = user_campus_access.school_id
    )
  );

-- ============================================================================
-- RLS POLICIES: CAMPUS_SCHEDULES
-- ============================================================================

-- Policy: Users can see schedules for campuses they have access to
DROP POLICY IF EXISTS campus_schedules_select_accessible ON campus_schedules;
CREATE POLICY campus_schedules_select_accessible
  ON campus_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND ur.school_id = campus_schedules.school_id AND (r.name IN ('school_admin', 'super_admin') OR check_user_campus_access(auth.uid(), campus_schedules.campus_id) = true
        )
    )
  );

-- Policy: School admins can insert campus schedules (only if multi-campus enabled)
DROP POLICY IF EXISTS campus_schedules_insert_school_admin ON campus_schedules;
CREATE POLICY campus_schedules_insert_school_admin
  ON campus_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = campus_schedules.school_id
        AND check_multi_campus_enabled(campus_schedules.school_id) = true
    )
  );

-- Policy: School admins can update campus schedules
DROP POLICY IF EXISTS campus_schedules_update_school_admin ON campus_schedules;
CREATE POLICY campus_schedules_update_school_admin
  ON campus_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = campus_schedules.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = campus_schedules.school_id
    )
  );

-- Policy: School admins can delete campus schedules
DROP POLICY IF EXISTS campus_schedules_delete_school_admin ON campus_schedules;
CREATE POLICY campus_schedules_delete_school_admin
  ON campus_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor') AND ur.school_id = campus_schedules.school_id
    )
  );

-- ============================================================================
-- UPDATE EXISTING RLS POLICIES FOR CLASSES
-- ============================================================================

-- Add campus filtering to existing classes policies
-- Note: This works with existing policies, adding campus filter when multi-campus is enabled

DROP POLICY IF EXISTS classes_select_campus_filtered ON classes;
CREATE POLICY classes_select_campus_filtered
  ON classes
  FOR SELECT
  TO authenticated
  USING (
    campus_id IS NULL
    OR check_user_campus_access(auth.uid(), campus_id) = true
    OR (
      school_id = get_user_school_id(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
      )
    )
  );

-- ============================================================================
-- UPDATE EXISTING RLS POLICIES FOR PLANNED_SESSIONS
-- ============================================================================

-- Add campus filtering to existing planned_sessions policies
DROP POLICY IF EXISTS planned_sessions_select_campus_filtered ON planned_sessions;
CREATE POLICY planned_sessions_select_campus_filtered
  ON planned_sessions
  FOR SELECT
  TO authenticated
  USING (
    campus_id IS NULL
    OR check_user_campus_access(auth.uid(), campus_id) = true
    OR (
      (SELECT school_id FROM classes WHERE id = planned_sessions.class_id) = get_user_school_id(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
      )
    )
  );

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS FOR DIRECT QUERIES
-- ============================================================================

-- Function: Get campuses user can access
CREATE OR REPLACE FUNCTION get_accessible_campuses(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  name VARCHAR,
  code VARCHAR,
  address TEXT,
  is_main BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.school_id, c.name, c.code, c.address, c.is_main
  FROM campuses c
  JOIN user_campus_access uca ON uca.campus_id = c.id
  WHERE uca.user_id = p_user_id
    AND uca.can_access = true
  UNION
  -- Admins see all campuses
  SELECT
    c.id, c.school_id, c.name, c.code, c.address, c.is_main
  FROM campuses c
  JOIN users u ON u.school_id = c.school_id
  WHERE u.id = p_user_id
    AND u.role_id IN ('school_admin', 'super_admin')
  ORDER BY is_main DESC, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_accessible_campuses(UUID) TO authenticated;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_campus_access_user_campus
  ON user_campus_access(user_id, campus_id)
  WHERE can_access = true;

CREATE INDEX IF NOT EXISTS idx_classes_school_campus
  ON classes(school_id, campus_id)
  WHERE campus_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planned_sessions_campus_date
  ON planned_sessions(campus_id, session_date)
  WHERE campus_id IS NOT NULL;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION check_multi_campus_enabled(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_campus_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_school_id(UUID) TO authenticated;
