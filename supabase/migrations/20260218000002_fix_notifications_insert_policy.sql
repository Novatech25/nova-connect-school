-- Migration: Fix RLS INSERT policy for notifications (broadcast messaging)
-- Created: 2026-02-18
-- Description: Replaces the previous policy with a corrected one that avoids table prefix in WITH CHECK to prevent 400 errors

-- Drop the previous policy if it exists
DROP POLICY IF EXISTS "School admins can insert notifications" ON notifications;

-- Create the corrected policy
CREATE POLICY "School admins can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    school_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = school_id  -- Corrected: no table prefix
        AND r.name = 'school_admin'
    )
  );
