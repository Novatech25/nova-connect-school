-- ============================================================================
-- Migration: Fix Schedule Version Constraint
-- Description: Remove incorrect UNIQUE constraint that prevents republishing
-- ============================================================================
-- 
-- PROBLEM:
-- The constraint schedules_school_year_version_unique UNIQUE (school_id, academic_year_id, version)
-- prevents having multiple different schedules with the same version number for a given
-- school and academic year. This is incorrect because:
--
-- 1. Each schedule has its own ID and should manage its own version independently
-- 2. When republishing schedule A (v1 -> v2), if schedule B already has v2, it fails
-- 3. The version should be unique per schedule_id, not per (school_id, academic_year_id)
--
-- SOLUTION:
-- Remove this constraint from the schedules table. The correct constraint already exists
-- in schedule_versions: UNIQUE (schedule_id, version)
--
-- ============================================================================

-- Drop the problematic constraint
ALTER TABLE schedules 
DROP CONSTRAINT IF EXISTS schedules_school_year_version_unique;

-- Add a comment to clarify version management
COMMENT ON COLUMN schedules.version IS 'Current version number of this schedule. Increments on each publication. Version uniqueness is enforced per schedule_id in the schedule_versions table, not globally per academic year.';

-- Verify: The correct constraint still exists in schedule_versions
-- This ensures version uniqueness per schedule_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'schedule_versions_schedule_version_unique'
  ) THEN
    RAISE EXCEPTION 'Critical: schedule_versions_schedule_version_unique constraint is missing!';
  END IF;
END $$;
