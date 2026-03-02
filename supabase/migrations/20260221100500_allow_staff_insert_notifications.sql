-- ============================================================================
-- Allow admins, accountants, and teachers to INSERT notifications
-- (for broadcast messaging from the frontend)
-- ============================================================================

-- Policy: Admins, accountants, and teachers can insert notifications
DROP POLICY IF EXISTS "Staff can insert notifications" ON notifications;
CREATE POLICY "Staff can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    get_user_role() IN ('school_admin', 'accountant', 'teacher')
  );

-- Policy: Users can update their own notifications (mark as read, etc.)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

