-- Migration: Add RLS UPDATE policy for notifications
-- Created: 2026-02-08
-- Description: Permet aux utilisateurs de marquer leurs propres notifications comme lues

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add sent_at column if not exists
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for sent_at for sorting
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);

-- Add comment
COMMENT ON COLUMN notifications.sent_at IS 'Timestamp when the notification was sent';
