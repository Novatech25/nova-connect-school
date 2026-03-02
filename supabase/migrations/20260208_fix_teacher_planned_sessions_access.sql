-- Migration: Fix teacher access to planned_sessions
-- Created: 2026-02-08
-- Description: Corrige la fonction is_user_teacher qui vérifie incorrectement 'school_admin' au lieu de 'teacher'
-- et améliore les RLS policies pour planned_sessions

-- ============================================
-- STEP 1: Supprimer les policies qui dépendent de is_user_teacher
-- ============================================

DROP POLICY IF EXISTS "Users can view planned sessions from their school" ON planned_sessions;
DROP POLICY IF EXISTS "Teachers and school admins can update planned sessions" ON planned_sessions;

-- ============================================
-- STEP 2: Supprimer et recréer la fonction is_user_teacher
-- ============================================

DROP FUNCTION IF EXISTS is_user_teacher(UUID);

-- La fonction is_user_teacher vérifiait "school_admin" au lieu de "teacher"
CREATE OR REPLACE FUNCTION is_user_teacher(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON r.id = ur.role_id 
    WHERE ur.user_id = p_user_id
    AND r.name = 'teacher'  -- CORRECTION: était 'school_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: Recréer la policy SELECT pour planned_sessions
-- ============================================

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
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON r.id = ur.role_id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('school_admin', 'supervisor')
        AND ur.school_id = planned_sessions.school_id
      )
      OR
      -- Teachers see their own sessions
      teacher_id = auth.uid()
      OR
      -- Students see sessions for their class
      EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.student_id = auth.uid()
        AND e.class_id = planned_sessions.class_id
        AND e.school_id = planned_sessions.school_id
      )
    )
  );

-- ============================================
-- STEP 4: Recréer la policy UPDATE pour planned_sessions
-- ============================================

CREATE POLICY "Teachers and school admins can update planned sessions"
  ON planned_sessions FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles
      WHERE user_id = auth.uid()
    )
    AND (
      -- Teachers can update their own sessions
      teacher_id = auth.uid()
      OR
      -- School admins can update any session
      EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON r.id = ur.role_id 
        WHERE ur.user_id = auth.uid() 
        AND r.name = 'school_admin'
        AND ur.school_id = planned_sessions.school_id
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
      teacher_id = auth.uid()
      OR
      -- School admins can update any session
      EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON r.id = ur.role_id 
        WHERE ur.user_id = auth.uid() 
        AND r.name = 'school_admin'
        AND ur.school_id = planned_sessions.school_id
      )
    )
  );

-- ============================================
-- STEP 5: Corriger le trigger de validation
-- ============================================

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
  
  -- Vérifier si l'utilisateur est un admin
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON r.id = ur.role_id 
    WHERE ur.user_id = p_auth_uid 
    AND r.name = 'school_admin'
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

    -- School admin can cancel sessions or make any changes
    IF is_admin THEN
      RETURN NEW;
    END IF;

    -- Any other state transition is rejected
    RAISE EXCEPTION 'Invalid state transition for planned_sessions';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajouter un commentaire
COMMENT ON FUNCTION is_user_teacher(p_user_id UUID) IS 'Checks if a user has the teacher role (FIXED: was incorrectly checking for school_admin)';
