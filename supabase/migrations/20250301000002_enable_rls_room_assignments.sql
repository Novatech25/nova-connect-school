-- Migration: Enable RLS Policies for Dynamic Room Assignment
-- Created: 2025-03-01
-- Description: Row Level Security policies for room_assignments and room_assignment_events tables

-- Enable RLS on room_assignments
ALTER TABLE room_assignments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on room_assignment_events
ALTER TABLE room_assignment_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for room_assignments table
-- ============================================

-- Super Admin: Full access to all room assignments
CREATE POLICY "Super Admin can manage all room assignments"
ON room_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'super_admin'
  )
);

-- School Admin: Full access to their school's room assignments
CREATE POLICY "School Admin can manage school room assignments"
ON room_assignments
FOR ALL
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'school_admin'
  )
)
WITH CHECK (
  school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'school_admin'
  )
);

-- Teachers: Read their own room assignments
CREATE POLICY "Teachers can read own room assignments"
ON room_assignments
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'teacher'
  )
);

-- Students: Read room assignments for their classes
CREATE POLICY "Students can read class room assignments"
ON room_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM enrollments
    WHERE class_id = ANY (grouped_class_ids)
      AND student_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'student'
  )
);

-- Parents: Read room assignments for their children's classes
CREATE POLICY "Parents can read children room assignments"
ON room_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM parents p
    JOIN student_parent_relations spr ON spr.parent_id = p.id
    JOIN enrollments ce ON ce.student_id = spr.student_id
    WHERE p.user_id = auth.uid()
      AND ce.class_id = ANY (grouped_class_ids)
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'parent'
  )
);

-- ============================================
-- RLS Policies for room_assignment_events table
-- ============================================

-- Super Admin: Full access to all events
CREATE POLICY "Super Admin can view all room assignment events"
ON room_assignment_events
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'super_admin'
  )
);

-- School Admin: Read events for their school
CREATE POLICY "School Admin can view school room assignment events"
ON room_assignment_events
FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'school_admin'
  )
);

-- ============================================
-- Update rooms table policies to allow reading assigned rooms
-- ============================================

-- Allow all authenticated users from a school to read rooms
-- (needed to display assigned rooms in schedules)
CREATE POLICY "School users can read rooms for their school"
ON rooms
FOR SELECT
TO authenticated
USING (
  campus_id IN (
    SELECT id FROM campuses WHERE school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
);

-- Add helpful comments
COMMENT ON TABLE room_assignments IS 'Stores dynamic room assignments with RLS enabled';
COMMENT ON TABLE room_assignment_events IS 'Audit log with RLS - only admins can view';
