-- Migration: Add Per-Window Notification Tracking
-- Created: 2025-03-01
-- Description: Adds fields to track T-60 and T-15 notification status separately (Comment 5)

-- Add per-window notification tracking fields
ALTER TABLE room_assignments
ADD COLUMN IF NOT EXISTS t60_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS t15_sent_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_room_assignments_t60_sent ON room_assignments(t60_sent_at) WHERE t60_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_assignments_t15_sent ON room_assignments(t15_sent_at) WHERE t15_sent_at IS NULL;

-- Add helpful comments
COMMENT ON COLUMN room_assignments.t60_sent_at IS 'Timestamp when T-60 notification was sent';
COMMENT ON COLUMN room_assignments.t15_sent_at IS 'Timestamp when T-15 notification was sent';
