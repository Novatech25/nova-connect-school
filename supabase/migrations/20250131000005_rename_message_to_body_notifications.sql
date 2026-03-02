-- ============================================================================
-- Fix: Rename 'message' column to 'body' in notifications table
-- Description: The TypeScript schema and components expect 'body' but the table has 'message'
-- ============================================================================

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'message') THEN
    ALTER TABLE notifications RENAME COLUMN message TO body;
  END IF;
END $$;

-- Update the comment
COMMENT ON COLUMN notifications.body IS 'The notification message content';

-- Verify the change
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'notifications';
