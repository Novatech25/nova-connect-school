-- Migration: Dynamic Room Assignment System
-- Created: 2025-03-01
-- Description: Adds tables and types for automatic room assignment based on class grouping

-- Create enum for room size categories
CREATE TYPE room_size_category_enum AS ENUM (
  'very_large',    -- TRÈS_GRANDE
  'large',         -- GRANDE
  'medium',        -- MOYENNE
  'small'          -- PETITE
);

-- Add size_category column to rooms table
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS size_category room_size_category_enum;

-- Create index on size_category for efficient queries
CREATE INDEX IF NOT EXISTS idx_rooms_size_category ON rooms(size_category);
CREATE INDEX IF NOT EXISTS idx_rooms_campus_capacity ON rooms(campus_id, capacity) WHERE capacity IS NOT NULL;

-- Create room_assignments table
CREATE TABLE IF NOT EXISTS room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  schedule_slot_id UUID REFERENCES schedule_slots(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  campus_id UUID REFERENCES campuses(id),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Regroupement
  grouped_class_ids UUID[] NOT NULL,  -- Classes regroupées
  total_students INTEGER NOT NULL,    -- Effectif total calculé

  -- Salle assignée
  assigned_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  assignment_method VARCHAR(50) DEFAULT 'auto', -- 'auto', 'manual', 'fallback'

  -- Métadonnées
  capacity_status VARCHAR(20), -- 'sufficient', 'insufficient', 'optimal'
  capacity_margin_percent DECIMAL(5,2), -- Marge de capacité (%)

  -- Versioning et statut
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published', 'updated', 'cancelled'
  version INTEGER DEFAULT 1,

  -- Notifications
  notified_at TIMESTAMP WITH TIME ZONE,
  notification_sent BOOLEAN DEFAULT false,

  -- Audit
  calculated_by UUID REFERENCES users(id),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT room_assignments_time_valid CHECK (end_time > start_time),
  CONSTRAINT room_assignments_students_positive CHECK (total_students > 0)
);

-- Create room_assignment_events table for history tracking
CREATE TABLE IF NOT EXISTS room_assignment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  room_assignment_id UUID NOT NULL REFERENCES room_assignments(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'published', 'notified', 'cancelled'
  old_room_id UUID REFERENCES rooms(id),
  new_room_id UUID REFERENCES rooms(id),
  reason TEXT,
  triggered_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for room_assignments
CREATE INDEX idx_room_assignments_school_date ON room_assignments(school_id, session_date);
CREATE INDEX idx_room_assignments_status ON room_assignments(status);
CREATE INDEX idx_room_assignments_teacher_date ON room_assignments(teacher_id, session_date);
CREATE INDEX idx_room_assignments_room_date ON room_assignments(assigned_room_id, session_date);
CREATE INDEX idx_room_assignments_subject_date ON room_assignments(subject_id, session_date);
CREATE INDEX idx_room_assignments_campus_date ON room_assignments(campus_id, session_date) WHERE campus_id IS NOT NULL;

-- Create indexes for room_assignment_events
CREATE INDEX idx_room_assignment_events_assignment_id ON room_assignment_events(room_assignment_id);
CREATE INDEX idx_room_assignment_events_school_id ON room_assignment_events(school_id);
CREATE INDEX idx_room_assignment_events_type ON room_assignment_events(event_type);
CREATE INDEX idx_room_assignment_events_created_at ON room_assignment_events(created_at DESC);

-- Create updated_at trigger function for room_assignments
CREATE OR REPLACE FUNCTION update_room_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at trigger for room_assignments
CREATE TRIGGER room_assignments_updated_at
BEFORE UPDATE ON room_assignments
FOR EACH ROW
EXECUTE FUNCTION update_room_assignments_updated_at();

-- Add helpful comments
COMMENT ON TYPE room_size_category_enum IS 'Room size categories: very_large, large, medium, small';
COMMENT ON TABLE room_assignments IS 'Stores dynamic room assignments based on class grouping and capacity requirements';
COMMENT ON TABLE room_assignment_events IS 'Audit log for room assignment changes and events';
COMMENT ON COLUMN room_assignments.grouped_class_ids IS 'Array of class IDs that are grouped together for this session';
COMMENT ON COLUMN room_assignments.assignment_method IS 'How the room was assigned: auto (algorithm), manual (admin), or fallback (no suitable room)';
COMMENT ON COLUMN room_assignments.capacity_status IS 'Whether the room capacity is: sufficient, optimal (with margin), or insufficient';
COMMENT ON COLUMN room_assignments.version IS 'Version number incremented on recalculation';
