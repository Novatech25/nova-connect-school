-- Migration: Migrate Existing Data to Multi-Campus
-- Description: Migrate existing data to work with multi-campus structure
-- Version: 1.0.0
-- IMPORTANT: This migration is optional and should be reviewed before running

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration assumes:
-- 1. You have already created at least one campus marked as is_main = true
-- 2. You want to migrate existing classes and sessions to the main campus
-- 3. You want to give school admins access to all campuses
--
-- If these assumptions don't apply to your situation, modify this script accordingly.

-- ============================================================================
-- STEP 1: VERIFY MAIN CAMPUS EXISTS
-- ============================================================================

-- This will show you how many schools have a main campus
SELECT
  s.id as school_id,
  s.name as school_name,
  COUNT(c.id) as main_campus_count
FROM schools s
LEFT JOIN campuses c ON c.school_id = s.id AND c.is_main = true
GROUP BY s.id, s.name
HAVING COUNT(c.id) = 0;

-- If any schools show up here, they don't have a main campus
-- You should create one before continuing

-- ============================================================================
-- STEP 2: MIGRATE CLASSES TO MAIN CAMPUS
-- ============================================================================

-- Assign all classes without a campus to their school's main campus
UPDATE classes c
SET campus_id = (
  SELECT id FROM campuses
  WHERE school_id = c.school_id AND is_main = true
  LIMIT 1
)
WHERE campus_id IS NULL
  AND EXISTS (
    SELECT 1 FROM campuses
    WHERE school_id = c.school_id AND is_main = true
  );

-- Show results
SELECT
  school_id,
  COUNT(*) as classes_migrated
FROM classes
WHERE campus_id IS NOT NULL
GROUP BY school_id;

-- ============================================================================
-- STEP 3: MIGRATE PLANNED SESSIONS TO CLASS CAMPUS
-- ============================================================================

-- Assign all sessions without a campus to their class's campus
UPDATE planned_sessions ps
SET campus_id = (
  SELECT campus_id FROM classes WHERE id = ps.class_id
)
WHERE campus_id IS NULL
  AND EXISTS (
    SELECT 1 FROM classes WHERE id = ps.class_id AND campus_id IS NOT NULL
  );

-- Show results
SELECT
  campus_id,
  COUNT(*) as sessions_migrated
FROM planned_sessions
WHERE campus_id IS NOT NULL
GROUP BY campus_id;

-- ============================================================================
-- STEP 4: GRANT SCHOOL ADMINS ACCESS TO ALL CAMPUSES
-- ============================================================================

-- Grant access to all campuses for school admins
INSERT INTO user_campus_access (school_id, user_id, campus_id, access_type, can_access)
SELECT DISTINCT ur.school_id, ur.user_id, c.id,
  'full_access',
  true
FROM user_roles ur JOIN roles r ON r.id = ur.role_id CROSS JOIN campuses c WHERE r.name = 'school_admin'
  AND ur.school_id = c.school_id
  AND NOT EXISTS (
    SELECT 1 FROM user_campus_access uca
    WHERE uca.user_id = ur.user_id AND uca.campus_id = c.id
  );

-- Show results
SELECT
  uca.school_id,
  uca.campus_id,
  COUNT(*) as admins_granted
FROM user_campus_access uca JOIN user_roles ur ON ur.user_id = uca.user_id JOIN roles r ON r.id = ur.role_id WHERE r.name = 'school_admin'
GROUP BY uca.school_id, uca.campus_id;

-- ============================================================================
-- STEP 5: MIGRATE ROOMS TO CAMPUSES (IF NEEDED)
-- ============================================================================

-- Note: Rooms should already have campus_id from the original campuses table
-- This query just verifies the migration
SELECT
  campus_id,
  COUNT(*) as room_count
FROM rooms
GROUP BY campus_id;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check for any classes still without a campus
SELECT
  school_id,
  COUNT(*) as classes_without_campus
FROM classes
WHERE campus_id IS NULL
GROUP BY school_id;

-- Check for any sessions still without a campus
SELECT
  session_date,
  COUNT(*) as sessions_without_campus
FROM planned_sessions
WHERE campus_id IS NULL
GROUP BY session_date;

-- Summary statistics
SELECT
  'Campuses' as resource_type,
  school_id,
  COUNT(*) as count
FROM campuses
GROUP BY school_id
UNION ALL
SELECT
  'Classes with Campus',
  school_id,
  COUNT(*)
FROM classes
WHERE campus_id IS NOT NULL
GROUP BY school_id
UNION ALL
SELECT
  'Sessions with Campus',
  (SELECT school_id FROM classes WHERE id = ps.class_id),
  COUNT(*)
FROM planned_sessions ps
WHERE ps.campus_id IS NOT NULL
GROUP BY (SELECT school_id FROM classes WHERE id = ps.class_id)
UNION ALL
SELECT
  'User Campus Access',
  school_id,
  COUNT(*)
FROM user_campus_access
GROUP BY school_id
ORDER BY school_id, resource_type;

-- ============================================================================
-- ROLLBACK SCRIPT (USE WITH CAUTION)
-- ============================================================================

-- To rollback this migration, uncomment and run the following:

-- -- Remove campus assignments from classes
-- UPDATE classes SET campus_id = NULL;
--
-- -- Remove campus assignments from sessions
-- UPDATE planned_sessions SET campus_id = NULL;
--
-- -- Remove user campus access (except for manual additions)
-- DELETE FROM user_campus_access
-- WHERE created_at >= '2025-02-10'::date; -- Adjust date as needed

-- ============================================================================
-- NOTES FOR COMPLETION
-- ============================================================================

-- After running this migration:
-- 1. Verify that all classes have a campus_id assigned
-- 2. Verify that all planned_sessions have a campus_id assigned
-- 3. Verify that school admins have access to all campuses in their school
-- 4. Test the multi-campus functionality in the application
-- 5. Update any application logic that assumes single-campus structure
