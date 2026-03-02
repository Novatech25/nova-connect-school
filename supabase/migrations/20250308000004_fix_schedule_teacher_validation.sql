CREATE OR REPLACE FUNCTION validate_schedule_slot_teacher()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = NEW.teacher_id
      AND r.name = 'teacher'
      AND ur.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Invalid teacher_id: user must have teacher role in the same school';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_schedule_slot_teacher() IS 'Validates that teacher_id references a user with teacher role in the same school';
