-- Add affects_report_card column to grades table
-- This allows administrators to control whether a grade should be included in report cards

-- Add the column with default true (grades affect report cards by default)
ALTER TABLE grades
ADD COLUMN IF NOT EXISTS affects_report_card BOOLEAN NOT NULL DEFAULT true;

-- Add comment
COMMENT ON COLUMN grades.affects_report_card IS 'Indicates whether this grade should be included in report card calculations';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_grades_affects_report_card ON grades(affects_report_card) WHERE affects_report_card = true;
