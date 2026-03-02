-- Migration: Campus Rooms Support
-- Description: Add campus_rooms table to explicitly assign rooms to campuses
-- Version: 1.0.0

-- ============================================================================
-- TABLE: CAMPUS_ROOMS
-- ============================================================================

-- Create campus_rooms table to explicitly assign rooms to campuses
CREATE TABLE IF NOT EXISTS campus_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  capacity INTEGER,
  room_type VARCHAR(50) CHECK (room_type IN ('classroom', 'lab', 'office', 'meeting_room', 'auditorium', 'gym', 'other')),
  floor INTEGER,
  building_code VARCHAR(50),
  features TEXT[] CHECK (features IS NULL OR array_length(features, 1) > 0),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure a room is only assigned to one campus per school
  UNIQUE(school_id, room_id)

  -- Note: Cannot use subquery in CHECK constraint in PostgreSQL
  -- School matching should be enforced at application level or via triggers
);

-- Add comments for documentation
COMMENT ON TABLE campus_rooms IS 'Explicit assignment of rooms to campuses within a school';
COMMENT ON COLUMN campus_rooms.id IS 'Unique identifier for the campus-room assignment';
COMMENT ON COLUMN campus_rooms.school_id IS 'Reference to the school';
COMMENT ON COLUMN campus_rooms.campus_id IS 'Reference to the campus';
COMMENT ON COLUMN campus_rooms.room_id IS 'Reference to the room';
COMMENT ON COLUMN campus_rooms.capacity IS 'Capacity of the room in this campus (can override base room capacity)';
COMMENT ON COLUMN campus_rooms.room_type IS 'Type of room (classroom, lab, office, meeting_room, auditorium, gym, other)';
COMMENT ON COLUMN campus_rooms.floor IS 'Floor number where the room is located in this campus';
COMMENT ON COLUMN campus_rooms.building_code IS 'Building code for this campus';
COMMENT ON COLUMN campus_rooms.features IS 'Array of specific features available at this campus (e.g., projector, whiteboard, computers)';
COMMENT ON COLUMN campus_rooms.is_active IS 'Whether this room assignment is active';
COMMENT ON COLUMN campus_rooms.notes IS 'Additional notes about the room at this campus';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for looking up rooms by campus
CREATE INDEX IF NOT EXISTS idx_campus_rooms_campus
  ON campus_rooms(campus_id)
  WHERE is_active = true;

-- Index for looking up campuses by room
CREATE INDEX IF NOT EXISTS idx_campus_rooms_room
  ON campus_rooms(room_id)
  WHERE is_active = true;

-- Index for school-wide queries
CREATE INDEX IF NOT EXISTS idx_campus_rooms_school
  ON campus_rooms(school_id)
  WHERE is_active = true;

-- Composite index for room lookups with filtering
CREATE INDEX IF NOT EXISTS idx_campus_rooms_campus_type
  ON campus_rooms(campus_id, room_type)
  WHERE is_active = true;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE campus_rooms ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see campus rooms for their school
DROP POLICY IF EXISTS campus_rooms_select_school ON campus_rooms;
CREATE POLICY campus_rooms_select_school
  ON campus_rooms
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- Policy: School admins can insert campus rooms
DROP POLICY IF EXISTS campus_rooms_insert_admin ON campus_rooms;
CREATE POLICY campus_rooms_insert_admin
  ON campus_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_multi_campus_enabled(school_id) = true
  );

-- Policy: School admins can update campus rooms
DROP POLICY IF EXISTS campus_rooms_update_admin ON campus_rooms;
CREATE POLICY campus_rooms_update_admin
  ON campus_rooms
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
  )
  WITH CHECK (
    school_id = get_user_school_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- Policy: School admins can delete campus rooms
DROP POLICY IF EXISTS campus_rooms_delete_admin ON campus_rooms;
CREATE POLICY campus_rooms_delete_admin
  ON campus_rooms
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_campus_rooms_updated_at ON campus_rooms;
CREATE TRIGGER update_campus_rooms_updated_at
  BEFORE UPDATE ON campus_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUDIT TRIGGER
-- ============================================================================

-- Create audit log entries for campus_rooms changes
DROP TRIGGER IF EXISTS campus_rooms_audit_trigger ON campus_rooms;
CREATE TRIGGER campus_rooms_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON campus_rooms
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get rooms for a campus
CREATE OR REPLACE FUNCTION get_campus_rooms(p_campus_id UUID)
RETURNS TABLE (
  id UUID,
  room_id UUID,
  room_name VARCHAR,
  capacity INTEGER,
  room_type VARCHAR,
  floor INTEGER,
  building_code VARCHAR,
  features TEXT[],
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id,
    cr.room_id,
    r.name AS room_name,
    COALESCE(cr.capacity, r.capacity) AS capacity,
    cr.room_type,
    cr.floor,
    cr.building_code,
    cr.features,
    cr.is_active
  FROM campus_rooms cr
  JOIN rooms r ON r.id = cr.room_id
  WHERE cr.campus_id = p_campus_id
    AND cr.is_active = true
  ORDER BY cr.building_code, cr.floor, r.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_campus_rooms(UUID) TO authenticated;

-- Function: Check if room belongs to campus
CREATE OR REPLACE FUNCTION check_room_campus_access(p_room_id UUID, p_campus_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM campus_rooms
    WHERE room_id = p_room_id
      AND campus_id = p_campus_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION check_room_campus_access(UUID, UUID) TO authenticated;

-- ============================================================================
-- MIGRATE EXISTING ROOM-TO-CAMPUS RELATIONSHIPS
-- ============================================================================

-- Migrate existing room assignments from classes table
-- This assumes rooms were implicitly assigned to campuses through classes
INSERT INTO campus_rooms (school_id, campus_id, room_id, capacity, room_type, is_active)
SELECT DISTINCT
  c.school_id,
  c.campus_id,
  ps.room_id,
  r.capacity,
  'classroom'::VARCHAR,
  true
FROM planned_sessions ps
JOIN classes c ON c.id = ps.class_id
JOIN rooms r ON r.id = ps.room_id
WHERE ps.room_id IS NOT NULL
  AND c.campus_id IS NOT NULL
ON CONFLICT (school_id, room_id) DO NOTHING;

-- Log migration results
DO $$
DECLARE
  v_migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_migrated_count
  FROM campus_rooms;

  RAISE NOTICE 'Migrated % rooms to campus_rooms table', v_migrated_count;
END $$;
