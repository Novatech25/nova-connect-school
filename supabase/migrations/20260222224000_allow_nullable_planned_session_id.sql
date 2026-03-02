-- Migration: Allow lesson_logs to be created without a planned_session_id
-- This is needed for admin-created lesson logs on behalf of teachers
-- who don't have phone access (no planned session required)

ALTER TABLE lesson_logs
  ALTER COLUMN planned_session_id DROP NOT NULL;

COMMENT ON COLUMN lesson_logs.planned_session_id
  IS 'Reference to a planned session. NULL for admin-created lesson logs.';
