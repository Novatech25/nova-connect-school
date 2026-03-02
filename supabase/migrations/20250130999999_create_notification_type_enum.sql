-- =====================================================
-- Migration: Create notification_type_enum
-- Description: Creates the notification type enum
-- =====================================================

CREATE TYPE notification_type_enum AS ENUM (
  'hours_validated',
  'payroll_payment',
  'assignment_added',
  'assignment_published',
  'assignment_deadline_soon',
  'assignment_submitted',
  'assignment_graded',
  'resource_published'
);

-- Note: The notifications.type column is currently TEXT, not this enum
-- This enum is created for type consistency and can be used in migrations
-- To migrate the column, you would need to:
-- 1. Add a new column with the enum type
-- 2. Copy data from TEXT column to enum column
-- 3. Drop the old TEXT column
-- 4. Rename the new column
