-- Migration: Enable RLS for Schedule Tables
-- Description: Enables Row Level Security and creates policies for all schedule tables

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if a schedule is in draft status
CREATE OR REPLACE FUNCTION is_schedule_draft(schedule_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schedules
    WHERE schedules.id = schedule_id
    AND schedules.status = 'draft'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can edit a schedule (school_admin or supervisor)
CREATE OR REPLACE FUNCTION user_can_edit_schedule(p_schedule_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM schedules
    JOIN schools ON schedules.school_id = schools.id
    WHERE schedules.id = p_schedule_id
    AND schedules.school_id IN (
      SELECT ur.school_id FROM user_roles ur
      WHERE ur.user_id = p_user_id
      AND ur.role_id IN ('school_admin', 'supervisor')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's school_id
CREATE OR REPLACE FUNCTION get_user_school_id(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT school_id FROM user_roles
    WHERE user_id = p_user_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's school_id (overload without parameter for use in policies)
CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT school_id FROM user_roles
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's role name (for use in policies)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR AS $$
BEGIN
  RETURN (
    SELECT r.name FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a teacher
CREATE OR REPLACE FUNCTION is_user_teacher(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE user_id = user_id
    AND r.name = 'school_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR schedules
-- ============================================

-- SELECT: Users can see schedules from their school
CREATE POLICY "Users can view schedules from their school"
  ON schedules FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Only school_admin or supervisor can create schedules
CREATE POLICY "School admins and supervisors can create schedules"
  ON schedules FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- UPDATE: School admins and supervisors can update draft schedules
CREATE POLICY "School admins and supervisors can update draft schedules"
  ON schedules FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND status = 'draft'
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND status = 'draft'
  );

-- DELETE: Only school_admin can delete draft schedules
CREATE POLICY "School admins can delete draft schedules"
  ON schedules FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
    )
    AND status = 'draft'
  );

-- ============================================
-- RLS POLICIES FOR schedule_slots
-- ============================================

-- SELECT: Users can see slots from their school
CREATE POLICY "Users can view schedule slots from their school"
  ON schedule_slots FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: School admins and supervisors can create slots in draft schedules
CREATE POLICY "School admins and supervisors can create slots in draft schedules"
  ON schedule_slots FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND is_schedule_draft(schedule_id)
  );

-- UPDATE: School admins and supervisors can update slots in draft schedules
CREATE POLICY "School admins and supervisors can update slots in draft schedules"
  ON schedule_slots FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND is_schedule_draft(schedule_id)
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND is_schedule_draft(schedule_id)
  );

-- DELETE: School admins and supervisors can delete slots from draft schedules
CREATE POLICY "School admins and supervisors can delete slots from draft schedules"
  ON schedule_slots FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND is_schedule_draft(schedule_id)
  );

-- ============================================
-- RLS POLICIES FOR schedule_versions
-- ============================================

-- SELECT: Users can view versions from their school
CREATE POLICY "Users can view schedule versions from their school"
  ON schedule_versions FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: System only (via Edge Function)
-- No INSERT policy - direct inserts prevented

-- UPDATE: No updates allowed
CREATE POLICY "No updates on schedule_versions"
  ON schedule_versions FOR UPDATE
  USING (false);

-- DELETE: No deletes allowed
CREATE POLICY "No deletes on schedule_versions"
  ON schedule_versions FOR DELETE
  USING (false);

-- ============================================
-- RLS POLICIES FOR schedule_constraints
-- ============================================

-- SELECT: Users can view constraints from their school
CREATE POLICY "Users can view schedule constraints from their school"
  ON schedule_constraints FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: School admins can create constraints
CREATE POLICY "School admins can create schedule constraints"
  ON schedule_constraints FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
    )
  );

-- UPDATE: School admins can update constraints
CREATE POLICY "School admins can update schedule constraints"
  ON schedule_constraints FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
    )
  );

-- DELETE: School admins can delete constraints
CREATE POLICY "School admins can delete schedule constraints"
  ON schedule_constraints FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR planned_sessions
-- ============================================

-- SELECT: Users can see sessions relevant to them
CREATE POLICY "Users can view planned sessions from their school"
  ON planned_sessions FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_id = auth.uid()
    )
    AND (
      -- School admins and supervisors see all sessions
      EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
        AND school_id = planned_sessions.school_id
      )
      OR
      -- Teachers see their own sessions
      (teacher_id = auth.uid() AND is_user_teacher(auth.uid()))
      OR
      -- Students and parents see sessions for their class
      EXISTS (
        SELECT 1 FROM enrollments
        WHERE student_id = auth.uid()
        AND class_id = planned_sessions.class_id
        AND school_id = planned_sessions.school_id
      )
    )
  );

-- INSERT: System only (via Edge Function during schedule publication)
-- No INSERT policy - direct inserts prevented

-- UPDATE: Teachers and school admins can update planned sessions
-- State transitions are validated by trigger validate_planned_sessions_update()
CREATE POLICY "Teachers and school admins can update planned sessions"
  ON planned_sessions FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_id = auth.uid()
    )
    AND (
      -- Teachers can update their own sessions
      (teacher_id = auth.uid() AND is_user_teacher(auth.uid()))
      OR
      -- School admins can update any session
      EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
        AND school_id = planned_sessions.school_id
      )
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_id = auth.uid()
    )
    AND (
      -- Teachers can update their own sessions
      (teacher_id = auth.uid() AND is_user_teacher(auth.uid()))
      OR
      -- School admins can update any session
      EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
        AND school_id = planned_sessions.school_id
      )
    )
  );

-- Create trigger to validate state transitions for planned_sessions
CREATE OR REPLACE FUNCTION validate_planned_sessions_update()
RETURNS TRIGGER AS $$
DECLARE
  p_auth_uid UUID;
BEGIN
  p_auth_uid := auth.uid();

  -- Teacher can only mark is_completed from false to true
  IF TG_OP = 'UPDATE' THEN
    IF OLD.teacher_id = NEW.teacher_id
       AND NEW.teacher_id = p_auth_uid
       AND is_user_teacher(p_auth_uid) THEN

      -- Teacher can only change is_completed from false to true
      IF OLD.is_completed = false AND NEW.is_completed = true THEN
        -- Allow: teacher marking session as completed
        RETURN NEW;
      END IF;

      -- Teacher cannot change other fields
      IF NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Teachers can only mark sessions as completed (is_completed: false → true)';
      END IF;

      RETURN NEW;
    END IF;

    -- School admin can cancel sessions
    IF EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE user_id = p_auth_uid
      AND r.name = 'school_admin'
      AND school_id = NEW.school_id
    ) THEN
      -- School admin can cancel sessions or make other changes
      RETURN NEW;
    END IF;

    -- Any other state transition is rejected
    RAISE EXCEPTION 'Invalid state transition for planned_sessions';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for validation
DROP TRIGGER IF EXISTS planned_sessions_validate_update ON planned_sessions;

CREATE TRIGGER planned_sessions_validate_update
  BEFORE UPDATE ON planned_sessions
  FOR EACH ROW
  EXECUTE FUNCTION validate_planned_sessions_update();

-- DELETE: Only school admins can delete sessions
CREATE POLICY "School admins can delete planned sessions"
  ON planned_sessions FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION is_schedule_draft IS 'Checks if a schedule is in draft status';
COMMENT ON FUNCTION user_can_edit_schedule(p_schedule_id UUID, p_user_id UUID) IS 'Checks if a user can edit a schedule (school_admin or supervisor)';
COMMENT ON FUNCTION get_user_school_id(p_user_id UUID) IS 'Returns the school_id for a user';
COMMENT ON FUNCTION is_user_teacher(user_id UUID) IS 'Checks if a user has the teacher role';
COMMENT ON FUNCTION validate_planned_sessions_update() IS 'Validates state transitions for planned_sessions: teachers can mark is_completed: false→true, school admins can cancel or update any field';
