-- Migration: Add RLS SELECT policy for notifications (admin stats)
-- Created: 2026-02-19
-- Description: Allows school admins to select (read/count) ALL notifications created for their school, not just their own.

-- Create the policy for SELECT
CREATE POLICY "School admins can view all school notifications"
  ON notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = notifications.school_id
        AND r.name = 'school_admin'
    )
  );
