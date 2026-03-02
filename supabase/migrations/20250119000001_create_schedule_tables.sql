-- Migration: Create Schedule Tables
-- Description: Creates tables for the schedule/timetable management system including schedules, slots, versions, constraints, and planned sessions

-- ============================================
-- ENUMS
-- ============================================

-- Schedule status enum
CREATE TYPE schedule_status_enum AS ENUM ('draft', 'published', 'archived');

-- Day of week enum
CREATE TYPE day_of_week_enum AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- Constraint type enum
CREATE TYPE constraint_type_enum AS ENUM (
  'teacher_conflict',
  'room_conflict',
  'class_conflict',
  'max_hours_per_day',
  'max_hours_per_week',
  'teacher_availability'
);

-- ============================================
-- TABLES
-- ============================================

-- Table: schedules
-- Stores timetable schedules with versioning support
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  status schedule_status_enum DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT schedules_school_year_version_unique UNIQUE (school_id, academic_year_id, version),
  CONSTRAINT schedules_check_valid_status CHECK (status IN ('draft', 'published', 'archived'))
);

-- Table: schedule_slots
-- Stores individual time slots within a schedule
CREATE TABLE schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  day_of_week day_of_week_enum NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
  is_recurring BOOLEAN DEFAULT true,
  recurrence_end_date DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT schedule_slots_time_valid CHECK (end_time > start_time),
  CONSTRAINT schedule_slots_recurrence_dates_valid CHECK (
    (is_recurring = false AND recurrence_end_date IS NULL) OR
    (is_recurring = true)
  )
);

-- Table: schedule_versions
-- Stores snapshots of schedule versions for historical tracking
CREATE TABLE schedule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL,
  change_summary TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT schedule_versions_schedule_version_unique UNIQUE (schedule_id, version)
);

-- Table: schedule_constraints
-- Stores validation constraints for schedule management
CREATE TABLE schedule_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  constraint_type constraint_type_enum NOT NULL,
  constraint_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: planned_sessions
-- Stores actual session instances generated from published schedules
CREATE TABLE planned_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  schedule_slot_id UUID NOT NULL REFERENCES schedule_slots(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT planned_sessions_time_valid CHECK (end_time > start_time),
  CONSTRAINT planned_sessions_duration_valid CHECK (duration_minutes > 0),
  CONSTRAINT planned_sessions_not_completed_and_cancelled CHECK (NOT (is_completed = true AND is_cancelled = true))
);

-- ============================================
-- INDEXES
-- ============================================

-- Indexes for schedules
CREATE INDEX idx_schedules_school_id ON schedules(school_id);
CREATE INDEX idx_schedules_academic_year_id ON schedules(academic_year_id);
CREATE INDEX idx_schedules_status ON schedules(status);
CREATE INDEX idx_schedules_published_at ON schedules(published_at);
CREATE INDEX idx_schedules_school_year_status ON schedules(school_id, academic_year_id, status);

-- Indexes for schedule_slots
CREATE INDEX idx_schedule_slots_schedule_id ON schedule_slots(schedule_id);
CREATE INDEX idx_schedule_slots_school_id ON schedule_slots(school_id);
CREATE INDEX idx_schedule_slots_teacher_id ON schedule_slots(teacher_id);
CREATE INDEX idx_schedule_slots_class_id ON schedule_slots(class_id);
CREATE INDEX idx_schedule_slots_room_id ON schedule_slots(room_id);
CREATE INDEX idx_schedule_slots_day_of_week ON schedule_slots(day_of_week);
CREATE INDEX idx_schedule_slots_time_range ON schedule_slots(start_time, end_time);
CREATE INDEX idx_schedule_slots_teacher_day_time ON schedule_slots(teacher_id, day_of_week, start_time, end_time);
CREATE INDEX idx_schedule_slots_class_day_time ON schedule_slots(class_id, day_of_week, start_time, end_time);
CREATE INDEX idx_schedule_slots_room_day_time ON schedule_slots(room_id, day_of_week, start_time, end_time) WHERE room_id IS NOT NULL;

-- Indexes for schedule_versions
CREATE INDEX idx_schedule_versions_schedule_id ON schedule_versions(schedule_id);
CREATE INDEX idx_schedule_versions_school_id ON schedule_versions(school_id);
CREATE INDEX idx_schedule_versions_created_at ON schedule_versions(created_at);

-- Indexes for schedule_constraints
CREATE INDEX idx_schedule_constraints_school_id ON schedule_constraints(school_id);
CREATE INDEX idx_schedule_constraints_type ON schedule_constraints(constraint_type);
CREATE INDEX idx_schedule_constraints_is_active ON schedule_constraints(is_active);
CREATE INDEX idx_schedule_constraints_priority ON schedule_constraints(priority);
CREATE INDEX idx_schedule_constraints_school_active ON schedule_constraints(school_id, is_active);

-- Indexes for planned_sessions
CREATE INDEX idx_planned_sessions_school_id ON planned_sessions(school_id);
CREATE INDEX idx_planned_sessions_schedule_slot_id ON planned_sessions(schedule_slot_id);
CREATE INDEX idx_planned_sessions_teacher_id ON planned_sessions(teacher_id);
CREATE INDEX idx_planned_sessions_class_id ON planned_sessions(class_id);
CREATE INDEX idx_planned_sessions_session_date ON planned_sessions(session_date);
CREATE INDEX idx_planned_sessions_is_completed ON planned_sessions(is_completed);
CREATE INDEX idx_planned_sessions_is_cancelled ON planned_sessions(is_cancelled);
CREATE INDEX idx_planned_sessions_teacher_date ON planned_sessions(teacher_id, session_date);
CREATE INDEX idx_planned_sessions_class_date ON planned_sessions(class_id, session_date);
CREATE INDEX idx_planned_sessions_upcoming ON planned_sessions(session_date) WHERE is_cancelled = false;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for schedules
CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for schedule_slots
CREATE TRIGGER schedule_slots_updated_at
  BEFORE UPDATE ON schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for schedule_constraints
CREATE TRIGGER schedule_constraints_updated_at
  BEFORE UPDATE ON schedule_constraints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for planned_sessions
CREATE TRIGGER planned_sessions_updated_at
  BEFORE UPDATE ON planned_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

-- Schedule tables comments
COMMENT ON TABLE schedules IS 'Stores timetable schedules with versioning support';
COMMENT ON TABLE schedule_slots IS 'Stores individual time slots within a schedule';
COMMENT ON TABLE schedule_versions IS 'Stores snapshots of schedule versions for historical tracking';
COMMENT ON TABLE schedule_constraints IS 'Stores validation constraints for schedule management';
COMMENT ON TABLE planned_sessions IS 'Stores actual session instances generated from published schedules';

-- Column comments for schedules
COMMENT ON COLUMN schedules.name IS 'Display name for the schedule (e.g., "EDT Trimestre 1 2024-2025")';
COMMENT ON COLUMN schedules.status IS 'Current status: draft, published, or archived';
COMMENT ON COLUMN schedules.version IS 'Version number, increments on each publication';
COMMENT ON COLUMN schedules.published_at IS 'Timestamp when the schedule was published';
COMMENT ON COLUMN schedules.published_by IS 'User who published the schedule';
COMMENT ON COLUMN schedules.metadata IS 'Additional configuration (e.g., slot duration, break times)';

-- Column comments for schedule_slots
COMMENT ON COLUMN schedule_slots.day_of_week IS 'Day of the week for this recurring slot';
COMMENT ON COLUMN schedule_slots.is_recurring IS 'Whether this slot repeats weekly';
COMMENT ON COLUMN schedule_slots.recurrence_end_date IS 'Optional end date for recurrence';
COMMENT ON COLUMN schedule_slots.notes IS 'Additional notes or instructions';

-- Column comments for schedule_versions
COMMENT ON COLUMN schedule_versions.snapshot_data IS 'Complete JSON snapshot of all schedule slots at version time';
COMMENT ON COLUMN schedule_versions.change_summary IS 'Description of changes in this version';

-- Column comments for schedule_constraints
COMMENT ON COLUMN schedule_constraints.constraint_type IS 'Type of constraint: teacher_conflict, room_conflict, etc.';
COMMENT ON COLUMN schedule_constraints.constraint_config IS 'JSON configuration specific to constraint type';
COMMENT ON COLUMN schedule_constraints.priority IS 'Validation priority (lower = validated first)';
COMMENT ON COLUMN schedule_constraints.error_message IS 'Custom error message for validation failures';

-- Column comments for planned_sessions
COMMENT ON COLUMN planned_sessions.session_date IS 'Actual date of the session';
COMMENT ON COLUMN planned_sessions.duration_minutes IS 'Session duration in minutes';
COMMENT ON COLUMN planned_sessions.is_completed IS 'Marked true when lesson is recorded in notebook';
COMMENT ON COLUMN planned_sessions.is_cancelled IS 'Marked true if session was cancelled';

-- Enums comments
COMMENT ON TYPE schedule_status_enum IS 'Schedule workflow status';
COMMENT ON TYPE day_of_week_enum IS 'Days of the week';
COMMENT ON TYPE constraint_type_enum IS 'Types of schedule validation constraints';
