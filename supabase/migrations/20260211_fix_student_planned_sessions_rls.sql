-- Migration: Fix student access to planned_sessions
-- Created: 2026-02-11
-- Description: La RLS policy pour les étudiants comparait enrollment.student_id = auth.uid()
-- mais student_id dans enrollments est une FK vers students.id, pas vers users.id.
-- Il faut utiliser students.user_id = auth.uid() à la place.

-- ============================================
-- STEP 1: Supprimer l'ancienne policy SELECT
-- ============================================

DROP POLICY IF EXISTS "Users can view planned sessions from their school" ON planned_sessions;

-- ============================================
-- STEP 2: Recréer la policy SELECT corrigée
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
      -- Students see sessions for their class (via students.user_id, not enrollment.student_id)
      EXISTS (
        SELECT 1 FROM enrollments e
        JOIN students s ON s.id = e.student_id
        WHERE s.user_id = auth.uid()
        AND e.class_id = planned_sessions.class_id
        AND e.school_id = planned_sessions.school_id
        AND e.status IN ('enrolled', 'pending')
      )
      OR
      -- Parents see sessions for their children's classes
      EXISTS (
        SELECT 1 FROM student_parent_relations spr
        JOIN parents p ON p.id = spr.parent_id
        JOIN enrollments e ON e.student_id = spr.student_id
        WHERE p.user_id = auth.uid()
        AND e.class_id = planned_sessions.class_id
        AND e.school_id = planned_sessions.school_id
        AND e.status IN ('enrolled', 'pending')
      )
    )
  );
