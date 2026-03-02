-- Migration: Add GPS coordinates to schools table for geolocation validation
-- This allows verifying that teachers are physically present at school when filling lesson logs

ALTER TABLE schools ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add comment for documentation
COMMENT ON COLUMN schools.latitude IS 'GPS latitude coordinate of the school location';
COMMENT ON COLUMN schools.longitude IS 'GPS longitude coordinate of the school location';
