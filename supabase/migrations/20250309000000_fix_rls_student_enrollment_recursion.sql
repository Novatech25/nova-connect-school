-- Fix RLS recursion between students, enrollments, and related policies.

CREATE OR REPLACE FUNCTION get_current_student_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION get_current_parent_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT id FROM parents WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION get_parent_student_ids()
RETURNS TABLE(student_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT spr.student_id
  FROM student_parent_relations spr
  JOIN parents p ON p.id = spr.parent_id
  WHERE p.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_teacher_assigned_student_ids()
RETURNS TABLE(student_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT DISTINCT e.student_id
  FROM enrollments e
  JOIN teacher_assignments ta ON ta.class_id = e.class_id
  WHERE ta.teacher_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_teacher_assigned_parent_ids()
RETURNS TABLE(parent_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT DISTINCT spr.parent_id
  FROM student_parent_relations spr
  JOIN enrollments e ON e.student_id = spr.student_id
  JOIN teacher_assignments ta ON ta.class_id = e.class_id
  WHERE ta.teacher_id = auth.uid()
$$;

-- Students: teachers read assigned students (no RLS recursion)
DROP POLICY IF EXISTS "teachers_read_assigned_students" ON students;
CREATE POLICY "teachers_read_assigned_students"
ON students FOR SELECT
USING (
  is_teacher()
  AND id IN (SELECT student_id FROM get_teacher_assigned_student_ids())
);

-- Students: parents read children profiles (no RLS recursion)
DROP POLICY IF EXISTS "parents_read_children_profiles" ON students;
CREATE POLICY "parents_read_children_profiles"
ON students FOR SELECT
USING (
  is_parent()
  AND id IN (SELECT student_id FROM get_parent_student_ids())
);

-- Parents: teachers read assigned parents (no RLS recursion)
DROP POLICY IF EXISTS "teachers_read_assigned_students_parents" ON parents;
CREATE POLICY "teachers_read_assigned_students_parents"
ON parents FOR SELECT
USING (
  is_teacher()
  AND id IN (SELECT parent_id FROM get_teacher_assigned_parent_ids())
);

-- Student-parent relations: teachers read assigned relations (no RLS recursion)
DROP POLICY IF EXISTS "teachers_read_assigned_students_relations" ON student_parent_relations;
CREATE POLICY "teachers_read_assigned_students_relations"
ON student_parent_relations FOR SELECT
USING (
  is_teacher()
  AND student_id IN (SELECT student_id FROM get_teacher_assigned_student_ids())
);

-- Student-parent relations: parents read own relations
DROP POLICY IF EXISTS "parents_read_own_relations" ON student_parent_relations;
CREATE POLICY "parents_read_own_relations"
ON student_parent_relations FOR SELECT
USING (
  is_parent()
  AND parent_id = get_current_parent_id()
);

-- Student-parent relations: students read own relations
DROP POLICY IF EXISTS "students_read_own_relations" ON student_parent_relations;
CREATE POLICY "students_read_own_relations"
ON student_parent_relations FOR SELECT
USING (
  is_student()
  AND student_id = get_current_student_id()
);

-- Enrollments: students read own enrollments (no RLS recursion)
DROP POLICY IF EXISTS "students_read_own_enrollments" ON enrollments;
CREATE POLICY "students_read_own_enrollments"
ON enrollments FOR SELECT
USING (
  is_student()
  AND student_id = get_current_student_id()
);

-- Enrollments: parents read children enrollments (no RLS recursion)
DROP POLICY IF EXISTS "parents_read_children_enrollments" ON enrollments;
CREATE POLICY "parents_read_children_enrollments"
ON enrollments FOR SELECT
USING (
  is_parent()
  AND student_id IN (SELECT student_id FROM get_parent_student_ids())
);

-- Student documents: teachers read assigned students documents
DROP POLICY IF EXISTS "teachers_read_assigned_students_documents" ON student_documents;
CREATE POLICY "teachers_read_assigned_students_documents"
ON student_documents FOR SELECT
USING (
  is_teacher()
  AND student_id IN (SELECT student_id FROM get_teacher_assigned_student_ids())
);

-- Student documents: students read own documents
DROP POLICY IF EXISTS "students_read_own_documents" ON student_documents;
CREATE POLICY "students_read_own_documents"
ON student_documents FOR SELECT
USING (
  is_student()
  AND student_id = get_current_student_id()
);

-- Student documents: parents read children documents
DROP POLICY IF EXISTS "parents_read_children_documents" ON student_documents;
CREATE POLICY "parents_read_children_documents"
ON student_documents FOR SELECT
USING (
  is_parent()
  AND student_id IN (SELECT student_id FROM get_parent_student_ids())
);
