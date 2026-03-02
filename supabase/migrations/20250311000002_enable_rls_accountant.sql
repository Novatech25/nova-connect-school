-- Create is_accountant function if not exists
CREATE OR REPLACE FUNCTION is_accountant()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'accountant'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ACCOUNTANT POLICIES
-- ============================================

-- Students: Read students in their school
DROP POLICY IF EXISTS "accountants_read_school_students" ON students;
CREATE POLICY "accountants_read_school_students"
ON students FOR SELECT
USING (
  is_accountant()
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Enrollments: Read enrollments in their school
DROP POLICY IF EXISTS "accountants_read_school_enrollments" ON enrollments;
CREATE POLICY "accountants_read_school_enrollments"
ON enrollments FOR SELECT
USING (
  is_accountant()
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Parents: Read parents in their school
DROP POLICY IF EXISTS "accountants_read_school_parents" ON parents;
CREATE POLICY "accountants_read_school_parents"
ON parents FOR SELECT
USING (
  is_accountant()
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Student Parent Relations: Read relations in their school
DROP POLICY IF EXISTS "accountants_read_school_relations" ON student_parent_relations;
CREATE POLICY "accountants_read_school_relations"
ON student_parent_relations FOR SELECT
USING (
  is_accountant()
  AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
);

-- Fee Types: Read fee types in their school
-- (Assuming fee_types has RLS enabled, adding just in case)
-- CREATE POLICY "accountants_read_school_fee_types"
-- ON fee_types FOR SELECT
-- USING (
--   is_accountant()
--   AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
-- );
