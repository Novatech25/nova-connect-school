-- Migration: RLS Policies for School Configuration Tables
-- Description: Enables Row Level Security and creates policies for all school config tables
-- Created: 2025-01-17

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if current user is a teacher
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'teacher'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ACADEMIC YEARS
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_academic_years"
ON academic_years FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's academic years
CREATE POLICY "school_admin_manage_own_school_academic_years"
ON academic_years FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users (Teachers, Students, Parents): Read access
CREATE POLICY "school_users_read_academic_years"
ON academic_years FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- ============================================
-- LEVELS
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_levels"
ON levels FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's levels
CREATE POLICY "school_admin_manage_own_school_levels"
ON levels FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users: Read access
CREATE POLICY "school_users_read_levels"
ON levels FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- ============================================
-- CLASSES
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_classes"
ON classes FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's classes
CREATE POLICY "school_admin_manage_own_school_classes"
ON classes FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users: Read access
CREATE POLICY "school_users_read_classes"
ON classes FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- Teacher: Read classes they are assigned to
CREATE POLICY "teachers_read_assigned_classes"
ON classes FOR SELECT
USING (
  id IN (
    SELECT class_id
    FROM teacher_assignments
    WHERE teacher_id = auth.uid()
  )
);

-- Student: Read their own class
-- NOTE: This policy is commented out because it references the 'enrollments' table
-- which does not exist yet. It should be added in a future migration after the
-- enrollments table is created.
/*
CREATE POLICY "students_read_own_class"
ON classes FOR SELECT
USING (
  id IN (
    SELECT class_id
    FROM enrollments
    WHERE student_id = auth.uid()
  )
);
*/

-- ============================================
-- SUBJECTS
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_subjects"
ON subjects FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's subjects
CREATE POLICY "school_admin_manage_own_school_subjects"
ON subjects FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users: Read access
CREATE POLICY "school_users_read_subjects"
ON subjects FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
  AND is_active = true
);

-- ============================================
-- PERIODS
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_periods"
ON periods FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's periods
CREATE POLICY "school_admin_manage_own_school_periods"
ON periods FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users: Read access
CREATE POLICY "school_users_read_periods"
ON periods FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- ============================================
-- GRADING SCALES
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_grading_scales"
ON grading_scales FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's grading scales
CREATE POLICY "school_admin_manage_own_school_grading_scales"
ON grading_scales FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users: Read access
CREATE POLICY "school_users_read_grading_scales"
ON grading_scales FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- ============================================
-- CAMPUSES
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_campuses"
ON campuses FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's campuses
CREATE POLICY "school_admin_manage_own_school_campuses"
ON campuses FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users: Read access
CREATE POLICY "school_users_read_campuses"
ON campuses FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- ============================================
-- ROOMS
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_rooms"
ON rooms FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's rooms
CREATE POLICY "school_admin_manage_own_school_rooms"
ON rooms FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- School Users: Read access to available rooms
CREATE POLICY "school_users_read_available_rooms"
ON rooms FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
  AND is_available = true
);

-- Teacher: Read all rooms in their school (for scheduling)
CREATE POLICY "teachers_read_all_rooms"
ON rooms FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
  AND is_teacher()
);

-- ============================================
-- TEACHER ASSIGNMENTS
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_teacher_assignments"
ON teacher_assignments FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's teacher assignments
CREATE POLICY "school_admin_manage_own_school_teacher_assignments"
ON teacher_assignments FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Teachers: Read their own assignments
CREATE POLICY "teachers_read_own_assignments"
ON teacher_assignments FOR SELECT
USING (
  teacher_id = auth.uid()
);

-- Teachers: Read assignments for their classes
CREATE POLICY "teachers_read_class_assignments"
ON teacher_assignments FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND is_teacher()
);

-- School Users: Read access TO authenticated assignments (for schedule viewing)
CREATE POLICY "school_users_read_teacher_assignments"
ON teacher_assignments FOR SELECT
USING (
  school_id = get_current_user_school_id()
  AND school_id IS NOT NULL
);

-- ============================================
-- HELPER FUNCTIONS FOR ROLE-BASED ACCESS
-- ============================================

-- Note: These functions should already exist in your database from previous migrations.
-- If they don't exist, you'll need to create them first:
-- - is_super_admin()
-- - is_school_admin()
-- - get_current_user_school_id()
-- - has_permission(permission_name)

-- Example implementation (if not already exists):
/*
-- Note: Correct implementations using user_roles/roles tables:
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

CREATE OR REPLACE FUNCTION get_current_user_school_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT school_id FROM users
    WHERE users.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

-- ============================================
-- END OF MIGRATION
-- ============================================
