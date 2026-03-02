-- Migration: Allow deletion of all schedules (not just drafts)
-- Description: The previous RLS policy only allowed deleting schedules with status='draft'.
--              This caused silent failures when deleting published/archived schedules.
--              This migration replaces the policy to allow deletion of any schedule
--              belonging to the user's school.

-- ============================================
-- SCHEDULES: Allow DELETE for all statuses
-- ============================================

DROP POLICY IF EXISTS "School staff can delete draft schedules" ON schedules;
DROP POLICY IF EXISTS "School staff can delete schedules" ON schedules;

CREATE POLICY "School staff can delete schedules"
  ON schedules FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- SCHEDULE SLOTS: Allow DELETE regardless of schedule status
-- ============================================

DROP POLICY IF EXISTS "School staff can delete slots from draft schedules" ON schedule_slots;
DROP POLICY IF EXISTS "School staff can delete schedule slots" ON schedule_slots;

CREATE POLICY "School staff can delete schedule slots"
  ON schedule_slots FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );
