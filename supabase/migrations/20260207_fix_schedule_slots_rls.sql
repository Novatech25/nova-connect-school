-- Migration: Fix RLS Policies for schedule_slots
-- Description: Permettre aux admins d'école de modifier les créneaux même dans les emplois du temps publiés
-- Issue: Les politiques RLS bloquent toute modification une fois le schedule publié

-- ==================================================
-- SOLUTION: Permettre aux admins de modifier même les schedules publiés
-- ==================================================

-- D'abord, supprimer les anciennes politiques
DROP POLICY IF EXISTS "School admins and supervisors can create slots in draft schedules" ON schedule_slots;
DROP POLICY IF EXISTS "School admins and supervisors can update slots in draft schedules" ON schedule_slots;
DROP POLICY IF EXISTS "School admins and supervisors can delete slots from draft schedules" ON schedule_slots;

-- ==================================================
-- NOUVELLE POLITIQUE INSERT - Sans restriction draft/published
-- ==================================================

CREATE POLICY "School admins and supervisors can create schedule slots"
  ON schedule_slots FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT ur.school_id 
      FROM user_roles ur 
      JOIN roles r ON r.id = ur.role_id 
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- ==================================================
-- NOUVELLE POLITIQUE UPDATE - Sans restriction draft/published
-- ==================================================

CREATE POLICY "School admins and supervisors can update schedule slots"
  ON schedule_slots FOR UPDATE
  USING (
    school_id IN (
      SELECT ur.school_id 
      FROM user_roles ur 
      JOIN roles r ON r.id = ur.role_id 
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('school_admin', 'supervisor')
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT ur.school_id 
      FROM user_roles ur 
      JOIN roles r ON r.id = ur.role_id 
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- ==================================================
-- NOUVELLE POLITIQUE DELETE - Sans restriction draft/published
-- ==================================================

CREATE POLICY "School admins and supervisors can delete schedule slots"
  ON schedule_slots FOR DELETE
  USING (
    school_id IN (
      SELECT ur.school_id 
      FROM user_roles ur 
      JOIN roles r ON r.id = ur.role_id 
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- ==================================================
-- VERIFICATION & DOCUMENTATION
-- ==================================================

COMMENT ON POLICY "School admins and supervisors can create schedule slots" ON schedule_slots IS 
  'Permet aux admins et superviseurs d''école de créer des créneaux dans n''importe quel emploi du temps (draft ou publié)';

COMMENT ON POLICY "School admins and supervisors can update schedule slots" ON schedule_slots IS 
  'Permet aux admins et superviseurs d''école de modifier des créneaux dans n''importe quel emploi du temps (draft ou publié)';

COMMENT ON POLICY "School admins and supervisors can delete schedule slots" ON schedule_slots IS 
  'Permet aux admins et superviseurs d''école de supprimer des créneaux de n''importe quel emploi du temps (draft ou publié)';

