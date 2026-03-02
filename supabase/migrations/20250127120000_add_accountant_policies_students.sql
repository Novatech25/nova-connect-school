-- Migration: Add Accountant RLS Policies for Students & Parents
-- Description: Enables accountants to manage students, parents, enrollments in their school
-- Date: 2025-01-27
-- Issue: Accountants cannot create students due to missing RLS policies

-- ============================================
-- Accountants can manage students in their school
-- ============================================

-- DROP existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "accountant_manage_own_school_students" ON students;
DROP POLICY IF EXISTS "accountant_read_own_school_students" ON students;
DROP POLICY IF EXISTS "accountant_insert_own_school_students" ON students;
DROP POLICY IF EXISTS "accountant_update_own_school_students" ON students;

-- Accountants can INSERT students in their school
CREATE POLICY "accountant_insert_own_school_students"
ON students FOR INSERT
TO authenticated
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can UPDATE students in their school
CREATE POLICY "accountant_update_own_school_students"
ON students FOR UPDATE
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can SELECT students in their school
CREATE POLICY "accountant_read_own_school_students"
ON students FOR SELECT
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- ============================================
-- Accountants can manage parents in their school
-- ============================================

DROP POLICY IF EXISTS "accountant_manage_own_school_parents" ON parents;
DROP POLICY IF EXISTS "accountant_insert_own_school_parents" ON parents;
DROP POLICY IF EXISTS "accountant_update_own_school_parents" ON parents;
DROP POLICY IF EXISTS "accountant_read_own_school_parents" ON parents;

-- Accountants can INSERT parents in their school
CREATE POLICY "accountant_insert_own_school_parents"
ON parents FOR INSERT
TO authenticated
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can UPDATE parents in their school
CREATE POLICY "accountant_update_own_school_parents"
ON parents FOR UPDATE
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can SELECT parents in their school
CREATE POLICY "accountant_read_own_school_parents"
ON parents FOR SELECT
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- ============================================
-- Accountants can manage student_parent_relations in their school
-- ============================================

DROP POLICY IF EXISTS "accountant_manage_own_school_relations" ON student_parent_relations;
DROP POLICY IF EXISTS "accountant_insert_own_school_relations" ON student_parent_relations;
DROP POLICY IF EXISTS "accountant_update_own_school_relations" ON student_parent_relations;
DROP POLICY IF EXISTS "accountant_read_own_school_relations" ON student_parent_relations;

-- Accountants can INSERT relations in their school
CREATE POLICY "accountant_insert_own_school_relations"
ON student_parent_relations FOR INSERT
TO authenticated
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can UPDATE relations in their school
CREATE POLICY "accountant_update_own_school_relations"
ON student_parent_relations FOR UPDATE
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can SELECT relations in their school
CREATE POLICY "accountant_read_own_school_relations"
ON student_parent_relations FOR SELECT
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- ============================================
-- Accountants can manage enrollments in their school
-- ============================================

DROP POLICY IF EXISTS "accountant_manage_own_school_enrollments" ON enrollments;
DROP POLICY IF EXISTS "accountant_insert_own_school_enrollments" ON enrollments;
DROP POLICY IF EXISTS "accountant_update_own_school_enrollments" ON enrollments;
DROP POLICY IF EXISTS "accountant_read_own_school_enrollments" ON enrollments;

-- Accountants can INSERT enrollments in their school
CREATE POLICY "accountant_insert_own_school_enrollments"
ON enrollments FOR INSERT
TO authenticated
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can UPDATE enrollments in their school
CREATE POLICY "accountant_update_own_school_enrollments"
ON enrollments FOR UPDATE
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can SELECT enrollments in their school
CREATE POLICY "accountant_read_own_school_enrollments"
ON enrollments FOR SELECT
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- ============================================
-- Accountants can manage student_documents in their school
-- ============================================

DROP POLICY IF EXISTS "accountant_manage_own_school_documents" ON student_documents;
DROP POLICY IF EXISTS "accountant_insert_own_school_documents" ON student_documents;
DROP POLICY IF EXISTS "accountant_update_own_school_documents" ON student_documents;
DROP POLICY IF EXISTS "accountant_read_own_school_documents" ON student_documents;

-- Accountants can INSERT documents in their school
CREATE POLICY "accountant_insert_own_school_documents"
ON student_documents FOR INSERT
TO authenticated
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can UPDATE documents in their school
CREATE POLICY "accountant_update_own_school_documents"
ON student_documents FOR UPDATE
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- Accountants can SELECT documents in their school
CREATE POLICY "accountant_read_own_school_documents"
ON student_documents FOR SELECT
TO authenticated
USING (
  is_accountant()
  AND school_id = get_current_user_school_id()
);

-- ============================================
-- Accountants can DELETE in their school (optional - uncomment if needed)
-- ============================================

-- Uncomment these policies if accountants should be able to delete records
-- DROP POLICY IF EXISTS "accountant_delete_own_school_students" ON students;
-- CREATE POLICY "accountant_delete_own_school_students"
-- ON students FOR DELETE
-- TO authenticated
-- USING (
--   is_accountant()
--   AND school_id = get_current_user_school_id()
-- );
