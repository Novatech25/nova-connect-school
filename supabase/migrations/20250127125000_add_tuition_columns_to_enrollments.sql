-- Migration: Add Tuition Columns to Enrollments
-- Description: Adds annual_tuition_amount, scholarship_type, and tuition_year to enrollments table
-- Date: 2025-01-27

-- Add columns to store tuition information
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS annual_tuition_amount DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS scholarship_type TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS scholarship_reason TEXT,
  ADD COLUMN IF NOT EXISTS tuition_year TEXT;

-- Add check constraint for scholarship_type (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'enrollments_scholarship_type_check'
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_scholarship_type_check
        CHECK (scholarship_type IN ('none', 'partial', 'full'));
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_enrollments_student_academic_year
  ON enrollments(student_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_school_year
  ON enrollments(school_id, academic_year_id);

-- Add comments
COMMENT ON COLUMN enrollments.annual_tuition_amount IS 'Annual tuition amount for this enrollment';
COMMENT ON COLUMN enrollments.scholarship_type IS 'Type of scholarship: none, partial, or full';
COMMENT ON COLUMN enrollments.scholarship_reason IS 'Reason for scholarship discount';
COMMENT ON COLUMN enrollments.tuition_year IS 'Academic year label for tuition (e.g., 2024-2025)';
