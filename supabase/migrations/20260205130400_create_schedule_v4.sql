-- Create RPC to bypass RLS for schedule creation (V4 - Hardcoded Enum)
-- We remove the parameter for status and hardcode 'draft' to avoid casting issues
CREATE OR REPLACE FUNCTION create_schedule_v4(
  p_school_id UUID,
  p_academic_year_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_version INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_schedule JSONB;
BEGIN
  -- Insert the new schedule with explicit casting for ENUM types
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
    'draft', -- Hardcoded to draft
    p_version,
    p_metadata
  )
  RETURNING to_jsonb(schedules.*) INTO v_new_schedule;

  RETURN v_new_schedule;
EXCEPTION WHEN OTHERS THEN
  -- Raise a clear error
  RAISE EXCEPTION 'RPC V4 Failed: % (State: %)', SQLERRM, SQLSTATE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_schedule_v4 TO authenticated;
GRANT EXECUTE ON FUNCTION create_schedule_v4 TO service_role;
