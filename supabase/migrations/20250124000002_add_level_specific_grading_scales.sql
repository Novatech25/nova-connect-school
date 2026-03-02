-- Part 1: Add columns to grading_scales table
ALTER TABLE grading_scales
ADD COLUMN IF NOT EXISTS level_id UUID REFERENCES levels(id),
ADD COLUMN IF NOT EXISTS is_level_specific BOOLEAN DEFAULT false;
