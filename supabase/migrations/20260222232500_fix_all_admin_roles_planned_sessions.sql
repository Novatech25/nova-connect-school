-- Migration: Fix planned sessions validation trigger for all admin roles and service role

CREATE OR REPLACE FUNCTION validate_planned_sessions_update()
RETURNS TRIGGER AS $$
DECLARE
  p_auth_uid UUID;
  is_teacher BOOLEAN;
  is_admin BOOLEAN;
BEGIN
  p_auth_uid := auth.uid();
  
  -- Si p_auth_uid est NULL, cela signifie que la requête vient du backend (Service Role)
  -- Nous autorisons la transaction côté système sans blocage
  IF p_auth_uid IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Vérifier si l'utilisateur est un enseignant
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON r.id = ur.role_id 
    WHERE ur.user_id = p_auth_uid AND r.name = 'teacher'
  ) INTO is_teacher;
  
  -- Vérifier si l'utilisateur est admin (global), school_admin (école), comptable ou superviseur
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON r.id = ur.role_id 
    WHERE ur.user_id = p_auth_uid 
    AND (
      -- Global admin
      r.name = 'admin'
      OR
      -- Ecole admin / comptable / superviseur (doit correspondre à l'école)
      (r.name IN ('school_admin', 'accountant', 'supervisor') AND ur.school_id = NEW.school_id)
    )
  ) INTO is_admin;

  -- Validation des changements
  IF TG_OP = 'UPDATE' THEN
  
    -- Autoriser les admins / système à tout faire
    IF is_admin THEN
      RETURN NEW;
    END IF;

    -- Règles restreintes pour l'enseignant
    IF OLD.teacher_id = NEW.teacher_id
       AND NEW.teacher_id = p_auth_uid
       AND is_teacher THEN

      -- Le professeur ne peut que passer isActive de false à true
      IF OLD.is_completed = false AND NEW.is_completed = true THEN
        RETURN NEW;
      END IF;

      IF NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Teachers can only mark sessions as completed (is_completed: false → true)';
      END IF;

      RETURN NEW;
    END IF;

    -- Si aucun rôle adéquat
    RAISE EXCEPTION 'Invalid state transition for planned_sessions';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
