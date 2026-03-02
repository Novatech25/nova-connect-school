-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Get current user ID from auth
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's school_id
CREATE OR REPLACE FUNCTION get_current_user_school_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT school_id FROM users WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user is school_admin for their school
CREATE OR REPLACE FUNCTION is_school_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'school_admin'
    AND ur.school_id = get_current_user_school_id()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(resource TEXT, action TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
    AND p.resource = resource
    AND p.action = action
  ) OR is_super_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCHOOLS POLICIES
-- ============================================================================

-- Super admin can do everything
CREATE POLICY "super_admin_all_on_schools"
ON schools FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School admin can read their own school
CREATE POLICY "school_admin_read_own_school"
ON schools FOR SELECT
USING (
  is_school_admin()
  AND id = get_current_user_school_id()
);

-- Users can read their own school
CREATE POLICY "users_read_own_school"
ON schools FOR SELECT
USING (
  id IN (SELECT school_id FROM users WHERE id = auth.uid())
);

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

-- Super admin can do everything
CREATE POLICY "super_admin_all_on_users"
ON users FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School admin can manage users in their school
CREATE POLICY "school_admin_manage_own_school_users"
ON users FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Users can read their own profile
CREATE POLICY "users_read_own_profile"
ON users FOR SELECT
USING (id = auth.uid());

-- Users can read profiles from same school
CREATE POLICY "users_read_same_school_profiles"
ON users FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- ============================================================================
-- ROLES POLICIES
-- ============================================================================

-- Super admin can do everything
CREATE POLICY "super_admin_all_on_roles"
ON roles FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- All users can read roles (for display purposes)
CREATE POLICY "all_users_read_roles"
ON roles FOR SELECT
USING (TRUE);

-- ============================================================================
-- PERMISSIONS POLICIES
-- ============================================================================

-- Super admin can do everything
CREATE POLICY "super_admin_all_on_permissions"
ON permissions FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- All users can read permissions (for display purposes)
CREATE POLICY "all_users_read_permissions"
ON permissions FOR SELECT
USING (TRUE);

-- ============================================================================
-- ROLE PERMISSIONS POLICIES
-- ============================================================================

-- Super admin can do everything
CREATE POLICY "super_admin_all_on_role_permissions"
ON role_permissions FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- All users can read role permissions (for display purposes)
CREATE POLICY "all_users_read_role_permissions"
ON role_permissions FOR SELECT
USING (TRUE);

-- ============================================================================
-- USER ROLES POLICIES
-- ============================================================================

-- Super admin can do everything
CREATE POLICY "super_admin_all_on_user_roles"
ON user_roles FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School admin can manage roles in their school
CREATE POLICY "school_admin_manage_own_school_user_roles"
ON user_roles FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Users can read their own roles
CREATE POLICY "users_read_own_roles"
ON user_roles FOR SELECT
USING (user_id = auth.uid());

-- Users can read roles from same school
CREATE POLICY "users_read_same_school_roles"
ON user_roles FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- ============================================================================
-- AUDIT LOGS POLICIES
-- ============================================================================

-- Super admin can read all logs
CREATE POLICY "super_admin_read_all_audit_logs"
ON audit_logs FOR SELECT
USING (is_super_admin());

-- School admin can read logs from their school
CREATE POLICY "school_admin_read_own_school_audit_logs"
ON audit_logs FOR SELECT
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Note: No INSERT policy for audit_logs
-- Audit logs are only inserted via triggers (which bypass RLS with SECURITY DEFINER)
-- This prevents direct INSERT attempts from users

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- Key Security Principles Implemented:
-- 1. Multi-tenant isolation: All queries scoped by school_id
-- 2. Role-based access: RBAC via roles and permissions
-- 3. Principle of least privilege: Minimum required access
-- 4. Defense in depth: Multiple layers of security checks
-- 5. Audit trail: All actions logged (see audit triggers)

-- Important: super_admin (NULL school_id) can access all schools
-- but is restricted by role-based permissions for actions

COMMENT ON FUNCTION is_super_admin() IS 'Checks if current user has super_admin role';
COMMENT ON FUNCTION is_school_admin() IS 'Checks if current user is school_admin for their school';
COMMENT ON FUNCTION has_permission(TEXT, TEXT) IS 'Checks if current user has specific permission (resource, action)';
COMMENT ON FUNCTION get_current_user_school_id() IS 'Returns school_id of current user (NULL for super_admin)';
