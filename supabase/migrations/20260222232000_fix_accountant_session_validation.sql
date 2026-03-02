-- Migration: Allow accountants to update planned sessions during lesson log validation
-- Description: The `validate_planned_sessions_update` was only allowing 'school_admin'
-- and 'teacher'. Since accountants and supervisors also validate lesson logs
-- (which in turn updates the planned_session to is_completed = true), they
-- need permission to do so.

CREATE OR REPLACE FUNCTION validate_planned_sessions_update()
RETURNS TRIGGER AS $$
DECLARE
  p_auth_uid UUID;
  is_teacher BOOLEAN;
  is_admin BOOLEAN;
BEGIN
  p_auth_uid := auth.uid();
  
  -- Vérifier si l'utilisateur est un enseignant
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON r.id = ur.role_id 
    WHERE ur.user_id = p_auth_uid AND r.name = 'teacher'
  ) INTO is_teacher;
  
  -- Vérifier si l'utilisateur est un admin, comptable ou superviseur
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON r.id = ur.role_id 
    WHERE ur.user_id = p_auth_uid 
    AND r.name IN ('school_admin', 'accountant', 'supervisor')
    AND ur.school_id = NEW.school_id
  ) INTO is_admin;

  -- Teacher can only mark is_completed from false to true
  IF TG_OP = 'UPDATE' THEN
    IF OLD.teacher_id = NEW.teacher_id
       AND NEW.teacher_id = p_auth_uid
       AND is_teacher THEN

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

    -- School admin, accountant, supervisor can cancel sessions or make any changes
    IF is_admin THEN
      RETURN NEW;
    END IF;

    -- Any other state transition is rejected
    RAISE EXCEPTION 'Invalid state transition for planned_sessions';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
