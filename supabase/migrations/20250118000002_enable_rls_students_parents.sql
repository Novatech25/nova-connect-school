-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_parent_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is a student
CREATE OR REPLACE FUNCTION is_student()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'student'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is a parent
CREATE OR REPLACE FUNCTION is_parent()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'parent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STUDENTS POLICIES
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_students"
ON students FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's students
CREATE POLICY "school_admin_manage_own_school_students"
ON students FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Teachers: Read students in their assigned classes
CREATE POLICY "teachers_read_assigned_students"
ON students FOR SELECT
USING (
  is_teacher()
  AND id IN (
    SELECT e.student_id
    FROM enrollments e
    JOIN teacher_assignments ta ON ta.class_id = e.class_id
    WHERE ta.teacher_id = auth.uid()
  )
);

-- Students: Read their own profile
CREATE POLICY "students_read_own_profile"
ON students FOR SELECT
USING (
  is_student()
  AND user_id = auth.uid()
);

-- Parents: Read their children's profiles
CREATE POLICY "parents_read_children_profiles"
ON students FOR SELECT
USING (
  is_parent()
  AND id IN (
    SELECT spr.student_id
    FROM student_parent_relations spr
    JOIN parents p ON p.id = spr.parent_id
    WHERE p.user_id = auth.uid()
  )
);

-- ============================================
-- PARENTS POLICIES
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_parents"
ON parents FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's parents
CREATE POLICY "school_admin_manage_own_school_parents"
ON parents FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Teachers: Read parents of students in their classes
CREATE POLICY "teachers_read_assigned_students_parents"
ON parents FOR SELECT
USING (
  is_teacher()
  AND id IN (
    SELECT spr.parent_id
    FROM student_parent_relations spr
    JOIN enrollments e ON e.student_id = spr.student_id
    JOIN teacher_assignments ta ON ta.class_id = e.class_id
    WHERE ta.teacher_id = auth.uid()
  )
);

-- Parents: Read their own profile
CREATE POLICY "parents_read_own_profile"
ON parents FOR SELECT
USING (
  is_parent()
  AND user_id = auth.uid()
);

-- ============================================
-- STUDENT_PARENT_RELATIONS POLICIES
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_student_parent_relations"
ON student_parent_relations FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's relations
CREATE POLICY "school_admin_manage_own_school_relations"
ON student_parent_relations FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Teachers: Read relations for their students
CREATE POLICY "teachers_read_assigned_students_relations"
ON student_parent_relations FOR SELECT
USING (
  is_teacher()
  AND student_id IN (
    SELECT e.student_id
    FROM enrollments e
    JOIN teacher_assignments ta ON ta.class_id = e.class_id
    WHERE ta.teacher_id = auth.uid()
  )
);

-- Parents: Read their own relations
CREATE POLICY "parents_read_own_relations"
ON student_parent_relations FOR SELECT
USING (
  is_parent()
  AND parent_id IN (
    SELECT id FROM parents WHERE user_id = auth.uid()
  )
);

-- Students: Read their own relations
CREATE POLICY "students_read_own_relations"
ON student_parent_relations FOR SELECT
USING (
  is_student()
  AND student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

-- ============================================
-- ENROLLMENTS POLICIES
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_enrollments"
ON enrollments FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's enrollments
CREATE POLICY "school_admin_manage_own_school_enrollments"
ON enrollments FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Teachers: Read enrollments for their classes
CREATE POLICY "teachers_read_assigned_enrollments"
ON enrollments FOR SELECT
USING (
  is_teacher()
  AND class_id IN (
    SELECT class_id
    FROM teacher_assignments
    WHERE teacher_id = auth.uid()
  )
);

-- Students: Read their own enrollments
CREATE POLICY "students_read_own_enrollments"
ON enrollments FOR SELECT
USING (
  is_student()
  AND student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

-- Parents: Read their children's enrollments
CREATE POLICY "parents_read_children_enrollments"
ON enrollments FOR SELECT
USING (
  is_parent()
  AND student_id IN (
    SELECT spr.student_id
    FROM student_parent_relations spr
    JOIN parents p ON p.id = spr.parent_id
    WHERE p.user_id = auth.uid()
  )
);

-- ============================================
-- STUDENT_DOCUMENTS POLICIES
-- ============================================

-- Super Admin: Full access
CREATE POLICY "super_admin_all_on_student_documents"
ON student_documents FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: Manage own school's documents
CREATE POLICY "school_admin_manage_own_school_documents"
ON student_documents FOR ALL
USING (
  is_school_admin()
  AND school_id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND school_id = get_current_user_school_id()
);

-- Teachers: Read documents for their students
CREATE POLICY "teachers_read_assigned_students_documents"
ON student_documents FOR SELECT
USING (
  is_teacher()
  AND student_id IN (
    SELECT e.student_id
    FROM enrollments e
    JOIN teacher_assignments ta ON ta.class_id = e.class_id
    WHERE ta.teacher_id = auth.uid()
  )
);

-- Students: Read their own documents
CREATE POLICY "students_read_own_documents"
ON student_documents FOR SELECT
USING (
  is_student()
  AND student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

-- Parents: Read their children's documents
CREATE POLICY "parents_read_children_documents"
ON student_documents FOR SELECT
USING (
  is_parent()
  AND student_id IN (
    SELECT spr.student_id
    FROM student_parent_relations spr
    JOIN parents p ON p.id = spr.parent_id
    WHERE p.user_id = auth.uid()
  )
);
