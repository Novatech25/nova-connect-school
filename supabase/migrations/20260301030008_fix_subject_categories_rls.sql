-- Migration: Fix Subject Categories RLS Policies
-- Description: Updates subject_categories RLS policies to use standard helper functions
-- Created: 2026-03-01

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view subject categories of their school" ON subject_categories;
DROP POLICY IF EXISTS "School admins can manage subject categories" ON subject_categories;

-- Create new policies using helper functions

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_subject_categories"
ON subject_categories FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's subject categories
CREATE POLICY "school_admin_manage_own_school_subject_categories"
ON subject_categories FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users (Teachers, Students, Parents): Read access
CREATE POLICY "school_users_read_subject_categories"
ON subject_categories FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);
