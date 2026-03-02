-- Migration: Relax RLS for Schedule Tables
-- Description: Updates RLS policies to allow any user associated with the school to manage schedules (temporary fix for role issues)

-- ============================================
-- SCHEDULEScorriger tous ca 
-- ============================================

DROP POLICY IF EXISTS "School admins and supervisors can create schedules" ON schedules;
DROP POLICY IF EXISTS "School staff can create schedules" ON schedules;
CREATE POLICY "School staff can create schedules"
  ON schedules FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "School admins and supervisors can update draft schedules" ON schedules;
DROP POLICY IF EXISTS "School staff can update draft schedules" ON schedules;
CREATE POLICY "School staff can update draft schedules"
  ON schedules FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND status = 'draft'
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND status = 'draft'
  );

DROP POLICY IF EXISTS "School admins can delete draft schedules" ON schedules;
DROP POLICY IF EXISTS "School staff can delete draft schedules" ON schedules;
CREATE POLICY "School staff can delete draft schedules"
  ON schedules FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND status = 'draft'
  );

-- ============================================
-- SCHEDULE SLOTS
-- ============================================

DROP POLICY IF EXISTS "School admins and supervisors can create slots in draft schedules" ON schedule_slots;
DROP POLICY IF EXISTS "School staff can create slots in draft schedules" ON schedule_slots;
CREATE POLICY "School staff can create slots in draft schedules"
  ON schedule_slots FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND is_schedule_draft(schedule_id)
  );

DROP POLICY IF EXISTS "School admins and supervisors can update slots in draft schedules" ON schedule_slots;
DROP POLICY IF EXISTS "School staff can update slots in draft schedules" ON schedule_slots;
CREATE POLICY "School staff can update slots in draft schedules"
  ON schedule_slots FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND is_schedule_draft(schedule_id)
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND is_schedule_draft(schedule_id)
  );

DROP POLICY IF EXISTS "School admins and supervisors can delete slots from draft schedules" ON schedule_slots;
DROP POLICY IF EXISTS "School staff can delete slots from draft schedules" ON schedule_slots;
CREATE POLICY "School staff can delete slots from draft schedules"
  ON schedule_slots FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
    AND is_schedule_draft(schedule_id)
  );

-- ============================================
-- SCHEDULE CONSTRAINTS
-- ============================================

DROP POLICY IF EXISTS "School admins can create schedule constraints" ON schedule_constraints;
DROP POLICY IF EXISTS "School staff can create schedule constraints" ON schedule_constraints;
CREATE POLICY "School staff can create schedule constraints"
  ON schedule_constraints FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "School admins can update schedule constraints" ON schedule_constraints;
DROP POLICY IF EXISTS "School staff can update schedule constraints" ON schedule_constraints;
CREATE POLICY "School staff can update schedule constraints"
  ON schedule_constraints FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "School admins can delete schedule constraints" ON schedule_constraints;
DROP POLICY IF EXISTS "School staff can delete schedule constraints" ON schedule_constraints;
CREATE POLICY "School staff can delete schedule constraints"
  ON schedule_constraints FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );
