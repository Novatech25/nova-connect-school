-- Migration: Add missing UNIQUE constraint on notification_preferences(user_id)
-- Created: 2026-02-17
-- Description: 
-- The trigger auto_create_notification_preferences uses "INSERT ... ON CONFLICT (user_id)".
-- However, the table notification_preferences was missing a UNIQUE constraint on user_id,
-- causing error 42P10 "there is no unique or exclusion constraint matching the ON CONFLICT specification".
-- This migration cleans up duplicates and adds the missing constraint.

-- 1. Clean up duplicate preferences for the same user (keep the most recently updated one)
DELETE FROM notification_preferences a 
USING notification_preferences b
WHERE a.user_id = b.user_id 
  AND a.updated_at < b.updated_at;

-- 2. Add the UNIQUE constraint
ALTER TABLE notification_preferences 
ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);

-- 3. Verify constraint exists (comment for documentation)
-- SELECT * FROM pg_constraint WHERE conname = 'notification_preferences_user_id_key';
