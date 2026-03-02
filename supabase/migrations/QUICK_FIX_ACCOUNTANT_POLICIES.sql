-- ============================================
-- QUICK FIX: Accountant RLS Policies for Students
-- Copy and paste this into Supabase Dashboard > SQL Editor
-- ============================================

-- Accountants can INSERT students in their school
CREATE POLICY IF NOT EXISTS "accountant_insert_own_school_students"
ON students FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can UPDATE students in their school
CREATE POLICY IF NOT EXISTS "accountant_update_own_school_students"
ON students FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can SELECT students in their school
CREATE POLICY IF NOT EXISTS "accountant_read_own_school_students"
ON students FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can INSERT parents in their school
CREATE POLICY IF NOT EXISTS "accountant_insert_own_school_parents"
ON parents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can UPDATE parents in their school
CREATE POLICY IF NOT EXISTS "accountant_update_own_school_parents"
ON parents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can SELECT parents in their school
CREATE POLICY IF NOT EXISTS "accountant_read_own_school_parents"
ON parents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can INSERT enrollments in their school
CREATE POLICY IF NOT EXISTS "accountant_insert_own_school_enrollments"
ON enrollments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can UPDATE enrollments in their school
CREATE POLICY IF NOT EXISTS "accountant_update_own_school_enrollments"
ON enrollments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can SELECT enrollments in their school
CREATE POLICY IF NOT EXISTS "accountant_read_own_school_enrollments"
ON enrollments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Accountants can manage student_parent_relations in their school
CREATE POLICY IF NOT EXISTS "accountant_insert_own_school_relations"
ON student_parent_relations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "accountant_update_own_school_relations"
ON student_parent_relations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "accountant_read_own_school_relations"
ON student_parent_relations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
    AND ur.school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  )
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Confirm policies are created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE policyname LIKE 'accountant_%'
ORDER BY tablename, policyname;
