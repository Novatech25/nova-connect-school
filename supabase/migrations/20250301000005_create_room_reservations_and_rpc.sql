-- Migration: Room Reservations and RPC Functions for Room Assignments
-- Created: 2025-03-01
-- Description: Adds room_reservations table and helper RPC functions

-- Comment 6: Create room_reservations table for manual room bookings
CREATE TABLE IF NOT EXISTS room_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  purpose TEXT,
  reserved_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT room_reservations_time_valid CHECK (end_time > start_time),
  CONSTRAINT room_reservations_unique_room_time UNIQUE (room_id, reservation_date, start_time, end_time)
);

-- Create indexes for room_reservations
CREATE INDEX IF NOT EXISTS idx_room_reservations_school_date ON room_reservations(school_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_room_reservations_room_date ON room_reservations(room_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_room_reservations_date_range ON room_reservations(reservation_date, start_time, end_time);

-- Enable RLS on room_reservations
ALTER TABLE room_reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies for room_reservations
CREATE POLICY "School users can view reservations for their school"
ON room_reservations
FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "School admins can manage reservations"
ON room_reservations
FOR ALL
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'school_admin'
  )
)
WITH CHECK (
  school_id IN (
    SELECT school_id FROM user_roles WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'school_admin'
  )
);

-- Create updated_at trigger for room_reservations
CREATE TRIGGER room_reservations_updated_at
BEFORE UPDATE ON room_reservations
FOR EACH ROW
EXECUTE FUNCTION update_room_assignments_updated_at();

-- Comment 2: Create RPC function to aggregate student counts per class
CREATE OR REPLACE FUNCTION get_class_enrollment_counts(p_class_ids UUID[])
RETURNS TABLE(class_id UUID, student_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.class_id,
    COUNT(*)::BIGINT as student_count
  FROM enrollments ce
  WHERE ce.class_id = ANY(p_class_ids)
    AND ce.status = 'active'
  GROUP BY ce.class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_class_enrollment_counts(UUID[]) TO authenticated;

-- Add helpful comments
COMMENT ON TABLE room_reservations IS 'Manual room reservations that override automatic assignments';
COMMENT ON FUNCTION get_class_enrollment_counts IS 'Aggregates active student counts per class for room assignment calculations';
