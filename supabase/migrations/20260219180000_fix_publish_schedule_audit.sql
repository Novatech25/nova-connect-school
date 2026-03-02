-- ============================================
-- Fix: Update publish_schedule_bypass_rls to use correct audit_logs schema
-- Description: The audit_logs table was recreated with entity_type/entity_id 
--              instead of resource_type/resource_id
-- ============================================

-- Drop and recreate function with correct audit_logs column names
DROP FUNCTION IF EXISTS publish_schedule_bypass_rls(UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION publish_schedule_bypass_rls(
  p_schedule_id UUID,
  p_user_id UUID,
  p_notify_users BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_academic_year RECORD;
  v_new_version INTEGER;
  v_slots JSONB;
  v_updated_schedule RECORD;
BEGIN
  -- Get schedule data with academic year
  SELECT s.*, ay.start_date, ay.end_date
  INTO v_schedule
  FROM schedules s
  JOIN academic_years ay ON ay.id = s.academic_year_id
  WHERE s.id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Schedule not found'
    );
  END IF;

  -- Calculate new version (check BOTH schedule.version AND max in schedule_versions)
  SELECT GREATEST(
    COALESCE(v_schedule.version, 0),
    COALESCE((SELECT MAX(version) FROM schedule_versions WHERE schedule_id = p_schedule_id), 0)
  ) + 1
  INTO v_new_version;

  -- Get slots for snapshot
  SELECT jsonb_agg(to_jsonb(ss.*))
  INTO v_slots
  FROM schedule_slots ss
  WHERE ss.schedule_id = p_schedule_id;

  -- Create version snapshot (with ON CONFLICT to handle edge cases)
  INSERT INTO schedule_versions (
    schedule_id,
    school_id,
    version,
    snapshot_data,
    change_summary,
    created_by
  ) VALUES (
    p_schedule_id,
    v_schedule.school_id,
    v_new_version,
    COALESCE(v_slots, '[]'::jsonb),
    'Published version ' || v_new_version,
    p_user_id
  )
  ON CONFLICT (schedule_id, version) DO UPDATE SET
    snapshot_data = EXCLUDED.snapshot_data,
    change_summary = EXCLUDED.change_summary,
    created_at = NOW();

  -- Update schedule (bypasses RLS because of SECURITY DEFINER)
  UPDATE schedules
  SET 
    status = 'published',
    version = v_new_version,
    published_at = NOW(),
    published_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_schedule_id
  RETURNING * INTO v_updated_schedule;

  -- Audit log - USE CORRECT COLUMN NAMES for current audit_logs schema
  -- Current schema: entity_type, entity_id, action, table_name, description
  INSERT INTO audit_logs (
    school_id,
    user_id,
    entity_type,
    entity_id,
    action,
    table_name,
    description
  ) VALUES (
    v_schedule.school_id,
    p_user_id,
    'schedule',
    p_schedule_id,
    'publish',
    'schedules',
    'Published schedule: ' || v_schedule.name || ' (version ' || v_new_version || ')'
  );

  RETURN jsonb_build_object(
    'success', true,
    'schedule', to_jsonb(v_updated_schedule),
    'version', v_new_version,
    'school_id', v_schedule.school_id,
    'academic_year_id', v_schedule.academic_year_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION publish_schedule_bypass_rls(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_schedule_bypass_rls(UUID, UUID, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION publish_schedule_bypass_rls(UUID, UUID, BOOLEAN) TO service_role;

COMMENT ON FUNCTION publish_schedule_bypass_rls IS 'Publishes a schedule and creates a version snapshot. Uses SECURITY DEFINER to bypass RLS policies.';
