-- Migration: Fix Publish Schedule RPC to allow republishing
-- Description: Remove the check that blocks republishing already published schedules

DROP FUNCTION IF EXISTS publish_schedule_rpc_v3(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION publish_schedule_rpc_v3(
  p_schedule_id UUID,
  p_notify_users BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_slots_count INTEGER;
  v_current_version INTEGER;
  v_next_version INTEGER;
  v_user_id UUID;
  v_user_role TEXT;
  v_user_school_id UUID;
  v_result JSONB;
  v_is_republish BOOLEAN := FALSE;
BEGIN
  -- ============================================
  -- 1. AUTHENTICATION CHECK
  -- ============================================
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- ============================================
  -- 2. AUTHORIZATION CHECK (RBAC)
  -- ============================================
  -- Get user's role and school. We check for admin roles.
  SELECT r.name, ur.school_id
  INTO v_user_role, v_user_school_id
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_user_id
  AND r.name IN ('super_admin', 'school_admin')
  ORDER BY 
    CASE WHEN r.name = 'super_admin' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Permission denied: only administrators can publish schedules',
      'required_role', 'school_admin or super_admin'
    );
  END IF;

  -- ============================================
  -- 3. GET SCHEDULE WITH SCHOOL ISOLATION
  -- ============================================
  SELECT *
  INTO v_schedule
  FROM schedules
  WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Schedule not found');
  END IF;

  -- ============================================
  -- 4. SCHOOL MEMBERSHIP CHECK (Multi-tenant isolation)
  -- ============================================
  IF v_user_role != 'super_admin' AND v_user_school_id IS DISTINCT FROM v_schedule.school_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Permission denied: you can only publish schedules from your school',
      'user_school_id', v_user_school_id,
      'schedule_school_id', v_schedule.school_id
    );
  END IF;

  -- ============================================
  -- 5. BUSINESS VALIDATION
  -- ============================================
  -- REMOVED: Check that blocked republishing
  -- Now we allow both 'draft' and 'published' statuses to be (re)published
  
  IF v_schedule.status = 'published' THEN
    v_is_republish := TRUE;
  END IF;

  -- Get slots count
  SELECT COUNT(*) INTO v_slots_count
  FROM schedule_slots
  WHERE schedule_id = p_schedule_id;

  IF v_slots_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot publish empty schedule - no slots found'
    );
  END IF;

  -- ============================================
  -- 6. VERSION MANAGEMENT
  -- ============================================
  v_current_version := COALESCE(v_schedule.version, 0);

  SELECT COALESCE(MAX(version), v_current_version)
  INTO v_next_version
  FROM schedule_versions
  WHERE schedule_id = p_schedule_id;

  v_next_version := v_next_version + 1;

  -- ============================================
  -- 7. CREATE VERSION SNAPSHOT
  -- ============================================
  INSERT INTO schedule_versions (
    schedule_id,
    school_id,
    version,
    snapshot_data,
    change_summary,
    created_by
  )
  SELECT
    p_schedule_id,
    v_schedule.school_id,
    v_next_version,
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', ss.id,
      'schedule_id', ss.schedule_id,
      'school_id', ss.school_id,
      'day_of_week', ss.day_of_week,
      'start_time', ss.start_time,
      'end_time', ss.end_time,
      'teacher_id', ss.teacher_id,
      'class_id', ss.class_id,
      'subject_id', ss.subject_id,
      'room_id', ss.room_id,
      'campus_id', ss.campus_id,
      'is_recurring', ss.is_recurring,
      'recurrence_end_date', ss.recurrence_end_date,
      'notes', ss.notes,
      'metadata', ss.metadata
    )), '[]'::jsonb),
    CASE 
      WHEN v_is_republish THEN 'Republished version ' || v_next_version
      ELSE 'Published version ' || v_next_version
    END,
    v_user_id
  FROM schedule_slots ss
  WHERE ss.schedule_id = p_schedule_id
  ON CONFLICT (schedule_id, version) DO UPDATE SET
    snapshot_data = EXCLUDED.snapshot_data,
    change_summary = EXCLUDED.change_summary,
    created_at = NOW();

  -- ============================================
  -- 8. UPDATE SCHEDULE STATUS
  -- ============================================
  UPDATE schedules
  SET
    status = 'published',
    version = v_next_version,
    published_at = NOW(),
    published_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_schedule_id;

  -- ============================================
  -- 9. AUDIT LOGGING
  -- ============================================
  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    v_schedule.school_id,
    v_user_id,
    'UPDATE',
    'schedules',
    p_schedule_id,
    jsonb_build_object(
      'action', CASE WHEN v_is_republish THEN 'republish' ELSE 'publish' END,
      'version', v_next_version,
      'slots_count', v_slots_count,
      'notified_users', p_notify_users,
      'user_role', v_user_role,
      'is_republish', v_is_republish
    )
  );

  -- ============================================
  -- 10. RETURN SUCCESS
  -- ============================================
  RETURN jsonb_build_object(
    'success', true,
    'schedule', jsonb_build_object(
      'id', v_schedule.id,
      'name', v_schedule.name,
      'status', 'published',
      'version', v_next_version,
      'published_at', NOW()
    ),
    'sessionsCreated', v_slots_count,
    'slotsCount', v_slots_count,
    'isRepublish', v_is_republish
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', 'Error publishing schedule: ' || SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION publish_schedule_rpc_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION publish_schedule_rpc_v3 TO service_role;

-- Add comment
COMMENT ON FUNCTION publish_schedule_rpc_v3 IS 'RPC function to publish/republish schedules. Allows republishing already published schedules to apply modifications.';
