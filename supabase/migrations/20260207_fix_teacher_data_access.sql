
-- Fix Teacher Data Access
-- 1. Drop existing restrictive policies if needed (or create new ones that override)
-- 2. Ensure teachers can see academic_years, periods, and subjects

-- ACADEMIC YEARS
DROP POLICY IF EXISTS "school_users_read_academic_years" ON academic_years;
CREATE POLICY "school_users_read_academic_years_v2"
ON academic_years FOR SELECT
TO authenticated
USING (
  school_id = (select school_id from users where id = auth.uid())
);

-- PERIODS
DROP POLICY IF EXISTS "school_users_read_periods" ON periods;
CREATE POLICY "school_users_read_periods_v2"
ON periods FOR SELECT
TO authenticated
USING (
  school_id = (select school_id from users where id = auth.uid())
);

-- SUBJECTS
DROP POLICY IF EXISTS "school_users_read_subjects" ON subjects;
CREATE POLICY "school_users_read_subjects_v2"
ON subjects FOR SELECT
TO authenticated
USING (
  school_id = (select school_id from users where id = auth.uid())
  AND is_active = true
);

-- TEACHER ASSIGNMENTS
-- Ensure teachers can see their own assignments without school_id restriction (sometimes school_id might be missing in assignment row?)
DROP POLICY IF EXISTS "teachers_read_own_assignments" ON teacher_assignments;
CREATE POLICY "teachers_read_own_assignments_v2"
ON teacher_assignments FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid()
);

-- Also allow reading assignments if they belong to the school (for stats etc)
DROP POLICY IF EXISTS "school_users_read_teacher_assignments" ON teacher_assignments;
CREATE POLICY "school_users_read_teacher_assignments_v2"
ON teacher_assignments FOR SELECT
TO authenticated
USING (
  school_id = (select school_id from users where id = auth.uid())
);
