-- Migration: Multi-Campus Premium Module
-- Description: Add campus_id to existing tables and create access management tables
-- Version: 1.0.0

-- ============================================================================
-- EXTEND EXISTING TABLES WITH CAMPUS_ID
-- ============================================================================

-- Add campus_id to classes table
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL;

-- Add campus_id to planned_sessions table
ALTER TABLE planned_sessions
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL;

-- Create indexes for campus_id columns
CREATE INDEX IF NOT EXISTS idx_classes_campus_id ON classes(campus_id);
CREATE INDEX IF NOT EXISTS idx_planned_sessions_campus_id ON planned_sessions(campus_id);

-- ============================================================================
-- TABLE: USER_CAMPUS_ACCESS
-- Description: Manage user access rules per campus
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_campus_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  can_access BOOLEAN DEFAULT true,
  access_type VARCHAR(50) NOT NULL DEFAULT 'full_access'
    CHECK (access_type IN ('full_access', 'restricted', 'read_only')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT user_campus_access_unique UNIQUE (user_id, campus_id)
);

-- Indexes for user_campus_access
CREATE INDEX IF NOT EXISTS idx_user_campus_access_school_id ON user_campus_access(school_id);
CREATE INDEX IF NOT EXISTS idx_user_campus_access_user_id ON user_campus_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_campus_access_campus_id ON user_campus_access(campus_id);
CREATE INDEX IF NOT EXISTS idx_user_campus_access_can_access ON user_campus_access(can_access);
CREATE INDEX IF NOT EXISTS idx_user_campus_access_school_user ON user_campus_access(school_id, user_id);

-- Comments
COMMENT ON TABLE user_campus_access IS 'Define access rules for users per campus';
COMMENT ON COLUMN user_campus_access.can_access IS 'Whether the user can currently access this campus';
COMMENT ON COLUMN user_campus_access.access_type IS 'Level of access: full_access, restricted, or read_only';

-- ============================================================================
-- TABLE: CAMPUS_SCHEDULES
-- Description: Link schedules to campuses with specific constraints
-- ============================================================================

CREATE TABLE IF NOT EXISTS campus_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  specific_constraints JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT campus_schedules_unique UNIQUE (campus_id, schedule_id)
);

-- Indexes for campus_schedules
CREATE INDEX IF NOT EXISTS idx_campus_schedules_school_id ON campus_schedules(school_id);
CREATE INDEX IF NOT EXISTS idx_campus_schedules_campus_id ON campus_schedules(campus_id);
CREATE INDEX IF NOT EXISTS idx_campus_schedules_schedule_id ON campus_schedules(schedule_id);

-- Comments
COMMENT ON TABLE campus_schedules IS 'Link schedules to campuses with specific geographical constraints';
COMMENT ON COLUMN campus_schedules.specific_constraints IS 'Geographical or time-specific constraints for this campus schedule';

-- ============================================================================
-- TRIGGER: UPDATED_AT FOR NEW TABLES
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_campus_access
DROP TRIGGER IF EXISTS update_user_campus_access_updated_at ON user_campus_access;
CREATE TRIGGER update_user_campus_access_updated_at
  BEFORE UPDATE ON user_campus_access
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for campus_schedules
DROP TRIGGER IF EXISTS update_campus_schedules_updated_at ON campus_schedules;
CREATE TRIGGER update_campus_schedules_updated_at
  BEFORE UPDATE ON campus_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT ON user_campus_access TO authenticated;
GRANT SELECT ON campus_schedules TO authenticated;

-- Grant additional permissions for service role
GRANT ALL ON user_campus_access TO service_role;
GRANT ALL ON campus_schedules TO service_role;

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE user_campus_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_schedules ENABLE ROW LEVEL SECURITY;
