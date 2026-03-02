-- Migration: Add RLS INSERT policy for notifications (broadcast messaging)
-- Created: 2026-02-18
-- Description: Allows school admins to insert notifications for users in their school (broadcast messages)

-- School admins can insert notifications for their school
CREATE POLICY "School admins can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    school_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = notifications.school_id
        AND r.name = 'school_admin'
    )
  );
