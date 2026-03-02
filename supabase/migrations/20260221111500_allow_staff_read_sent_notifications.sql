-- ============================================================================
-- Allow staff to SELECT notifications they sent (for broadcast history/stats)
-- ============================================================================
-- The existing SELECT policy only allows users to see notifications 
-- where user_id = auth.uid() (i.e., notifications TO them).
-- Staff who SEND broadcasts need to also read back the notifications
-- they created (where data->sent_by matches their ID).

DROP POLICY IF EXISTS "Staff can view sent notifications" ON notifications;
CREATE POLICY "Staff can view sent notifications"
  ON notifications
  FOR SELECT
  USING (
    get_user_role() IN ('school_admin', 'accountant', 'teacher')
    AND (data->>'sent_by') = auth.uid()::text
  );
