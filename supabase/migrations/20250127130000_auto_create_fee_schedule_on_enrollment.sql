-- Migration: Auto-create Fee Schedule on Enrollment
-- Description: Automatically creates fee_schedule when enrollment is created with tuition amount
-- Date: 2025-01-27

-- First, ensure the function to create fee schedules exists
CREATE OR REPLACE FUNCTION create_enrollment_fee_schedule()
RETURNS TRIGGER AS $$
DECLARE
  fee_type RECORD;
  enrolled_student RECORD;
  academic_year RECORD;
  discount_amount_val DECIMAL(12, 2) DEFAULT 0;
  discount_reason_val TEXT;
BEGIN
  -- Only proceed if annual_tuition_amount is provided and greater than 0
  IF NEW.annual_tuition_amount IS NULL OR NEW.annual_tuition_amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- Get the enrolled student
  SELECT * INTO enrolled_student
  FROM students
  WHERE id = NEW.student_id;

  -- Get academic year info
  SELECT * INTO academic_year
  FROM academic_years
  WHERE id = NEW.academic_year_id;

  -- Find or create "Scolarité annuelle" fee type
  SELECT * INTO fee_type
  FROM fee_types
  WHERE school_id = NEW.school_id
    AND code = 'ANNUAL_TUITION'
    AND is_mandatory = true
  LIMIT 1;

  -- If fee type doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO fee_types (
      school_id,
      name,
      code,
      description,
      category,
      default_amount,
      is_mandatory,
      applies_to_levels,
      created_at,
      updated_at
    ) VALUES (
      NEW.school_id,
      'Scolarité annuelle',
      'ANNUAL_TUITION',
      'Scolarité annuelle pour l''année scolaire',
      'inscription',
      NEW.annual_tuition_amount,
      true,
      '{}'::jsonb,
      NOW(),
      NOW()
    )
    RETURNING * INTO fee_type;
  END IF;

  -- Calculate discount based on scholarship type
  IF NEW.scholarship_type = 'full' THEN
    discount_amount_val := NEW.annual_tuition_amount;
    discount_reason_val := 'Bourse complète';
  ELSIF NEW.scholarship_type = 'partial' THEN
    discount_amount_val := NEW.annual_tuition_amount * 0.5;
    discount_reason_val := 'Demi-bourse';
  END IF;

  -- Create fee schedule
  INSERT INTO fee_schedules (
    school_id,
    student_id,
    academic_year_id,
    fee_type_id,
    amount,
    due_date,
    status,
    paid_amount,
    remaining_amount,
    discount_amount,
    discount_reason,
    notes,
    created_at,
    updated_at
  ) VALUES (
    NEW.school_id,
    NEW.student_id,
    NEW.academic_year_id,
    fee_type.id,
    NEW.annual_tuition_amount,
    COALESCE(academic_year.end_date, NOW() + INTERVAL '1 month')::DATE,
    'pending',
    0,
    NEW.annual_tuition_amount - discount_amount_val,
    discount_amount_val,
    discount_reason_val,
    'Scolarité annuelle - ' || COALESCE(NEW.tuition_year, academic_year.name, 'Année scolaire'),
    NOW(),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the enrollment
    RAISE WARNING 'Failed to create fee schedule: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS auto_create_fee_schedule_trigger ON enrollments;

-- Create trigger
CREATE TRIGGER auto_create_fee_schedule_trigger
  AFTER INSERT ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION create_enrollment_fee_schedule();

-- Add helpful comments
COMMENT ON FUNCTION create_enrollment_fee_schedule() IS 'Automatically creates fee_schedule when enrollment is created with annual_tuition_amount';
COMMENT ON TRIGGER auto_create_fee_schedule_trigger ON enrollments IS 'Trigger to auto-create fee schedules on enrollment';
