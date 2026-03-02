-- ============================================================================
-- Function: get_teachers_for_school
-- Description: Returns all teachers (unique teacher_ids from grades table) for a school
-- Security: SECURITY DEFINER bypasses RLS, but we validate the user is school_admin
-- ============================================================================

CREATE OR REPLACE FUNCTION get_teachers_for_school(p_school_id UUID)
RETURNS SETOF users AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Check if current user is a school_admin for this school
  SELECT EXISTS(
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_current_user_id
    AND r.name = 'school_admin'
    AND ur.school_id = p_school_id
  ) OR EXISTS(
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_current_user_id
    AND r.name = 'super_admin'
  ) INTO v_is_admin;

  -- Only allow school_admins or super_admins to fetch teachers
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Permission denied: Only school_admins can fetch teachers';
  END IF;

  -- Return users who appear as teachers in the grades table for this school
  RETURN QUERY
  SELECT DISTINCT u.*
  FROM users u
  WHERE u.id IN (
    SELECT DISTINCT g.teacher_id
    FROM grades g
    WHERE g.school_id = p_school_id
  )
  AND u.school_id = p_school_id
  ORDER BY u.last_name, u.first_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_teachers_for_school(UUID) TO authenticated;

COMMENT ON FUNCTION get_teachers_for_school(UUID) IS 'Returns all teachers (from grades table) for a given school. Only accessible by school_admins.';
