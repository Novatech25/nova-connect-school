-- Create RPC to bypass RLS for schedule creation (V5 - Auto-increment version)
-- This version handles the unique constraint by auto-incrementing the version number
CREATE OR REPLACE FUNCTION create_schedule_v5(
  p_school_id UUID,
  p_academic_year_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_schedule JSONB;
  v_next_version INTEGER;
BEGIN
  -- Get the next version number for this school and academic year
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM schedules
  WHERE school_id = p_school_id AND academic_year_id = p_academic_year_id;

  -- Insert the new schedule with the auto-incremented version
  INSERT INTO schedules (
    school_id,
    academic_year_id,
    name,
    description,
    status,
    version,
    metadata
  ) VALUES (
    p_school_id,
    p_academic_year_id,
    p_name,
    p_description,
    'draft',
    v_next_version,
    p_metadata
  )
  RETURNING to_jsonb(schedules.*) INTO v_new_schedule;

  RETURN v_new_schedule;
EXCEPTION WHEN OTHERS THEN
  -- Raise a clear error
  RAISE EXCEPTION 'RPC V5 Failed: % (State: %)', SQLERRM, SQLSTATE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_schedule_v5 TO authenticated;
GRANT EXECUTE ON FUNCTION create_schedule_v5 TO service_role;
