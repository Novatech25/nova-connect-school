-- Migration: Create Payment Helper Functions
-- Description: Creates SQL functions for payment calculations and automation
-- Date: 2025-01-27

-- ============================================
-- Function: calculate_student_balance
-- ============================================

CREATE OR REPLACE FUNCTION calculate_student_balance(
  p_student_id UUID,
  p_academic_year_id UUID
)
RETURNS TABLE (
  total_due DECIMAL,
  total_paid DECIMAL,
  total_remaining DECIMAL,
  total_overdue DECIMAL,
  payment_status TEXT
) AS $$
DECLARE
  v_school_id UUID;
  v_blocking_config JSONB;
  v_payment_status TEXT;
BEGIN
  -- Get school_id
  SELECT school_id INTO v_school_id
  FROM students
  WHERE id = p_student_id;

  -- Get payment blocking configuration
  SELECT settings->'paymentBlocking' INTO v_blocking_config
  FROM schools
  WHERE id = v_school_id;

  -- Calculate totals
  SELECT
    COALESCE(SUM(fs.amount - fs.discount_amount), 0),
    COALESCE(SUM(fs.paid_amount), 0),
    COALESCE(SUM(fs.remaining_amount), 0),
    COALESCE(SUM(
      CASE
        WHEN fs.due_date < CURRENT_DATE AND fs.status != 'paid'
        THEN fs.remaining_amount
        ELSE 0
      END
    ), 0)
  INTO
    total_due,
    total_paid,
    total_remaining,
    total_overdue
  FROM fee_schedules fs
  WHERE fs.student_id = p_student_id
    AND fs.academic_year_id = p_academic_year_id
    AND fs.status != 'cancelled';

  -- Determine payment status based on school configuration
  IF v_blocking_config IS NULL OR v_blocking_config->>'mode' = 'OK' THEN
    v_payment_status := 'ok';
  ELSE
    -- Check if blocking threshold is met
    IF total_overdue > 0 THEN
      IF v_blocking_config->>'mode' = 'BLOCKED' THEN
        v_payment_status := 'blocked';
      ELSIF v_blocking_config->>'mode' = 'WARNING' THEN
        v_payment_status := 'warning';
      ELSE
        v_payment_status := 'ok';
      END IF;
    ELSE
      v_payment_status := 'ok';
    END IF;
  END IF;

  payment_status := v_payment_status;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: apply_payment_to_schedule
-- ============================================

CREATE OR REPLACE FUNCTION apply_payment_to_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_schedule RECORD;
  v_new_paid_amount DECIMAL;
  v_new_remaining_amount DECIMAL;
  v_new_status fee_schedule_status;
BEGIN
  -- Only process INSERT operations (new payments)
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Get the current fee schedule
  SELECT * INTO v_schedule
  FROM fee_schedules
  WHERE id = NEW.fee_schedule_id;

  -- If not found, return
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Calculate new amounts
  v_new_paid_amount := v_schedule.paid_amount + NEW.amount;
  v_new_remaining_amount := v_schedule.amount - v_schedule.discount_amount - v_new_paid_amount;

  -- Ensure remaining_amount doesn't go negative (overpayment protection)
  -- Cap paid_amount at (amount - discount_amount) to maintain constraint
  IF v_new_remaining_amount < 0 THEN
    v_new_remaining_amount := 0;
    v_new_paid_amount := v_schedule.amount - v_schedule.discount_amount;
  END IF;

  -- Determine new status
  IF v_new_remaining_amount = 0 THEN
    v_new_status := 'paid';
  ELSIF v_new_paid_amount > 0 AND v_new_remaining_amount > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := v_schedule.status;
  END IF;

  -- Update fee schedule
  UPDATE fee_schedules
  SET
    paid_amount = v_new_paid_amount,
    remaining_amount = v_new_remaining_amount,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = NEW.fee_schedule_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: generate_fee_schedules_for_student
-- ============================================

CREATE OR REPLACE FUNCTION generate_fee_schedules_for_student(
  p_student_id UUID,
  p_academic_year_id UUID
)
RETURNS INT AS $$
DECLARE
  v_student RECORD;
  v_fee_types RECORD;
  v_academic_year RECORD;
  v_created_count INT := 0;
  v_discount_amount DECIMAL;
  v_final_amount DECIMAL;
  v_installment_config JSONB;
  v_num_installments INT;
  v_installment_amount DECIMAL;
  v_installment_index INT;
  v_due_date DATE;
  v_start_date DATE;
  v_interval_months INT;
BEGIN
  -- Get student info
  SELECT s.*, s.level_id INTO v_student
  FROM students s
  WHERE s.id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  -- Get academic year info
  SELECT * INTO v_academic_year
  FROM academic_years
  WHERE id = p_academic_year_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Academic year not found';
  END IF;

  -- Loop through active fee types applicable to this student's level
  FOR v_fee_types IN
    SELECT *
    FROM fee_types
    WHERE school_id = v_student.school_id
      AND is_active = true
      AND (applies_to_levels = '[]'::jsonb OR v_student.level_id::text = ANY(applies_to_levels::text[]))
  LOOP
    -- Check if fee schedule already exists for this fee type
    IF EXISTS (
      SELECT 1 FROM fee_schedules
      WHERE student_id = p_student_id
        AND academic_year_id = p_academic_year_id
        AND fee_type_id = v_fee_types.id
    ) THEN
      CONTINUE;
    END IF;

    -- Check for applicable exemptions
    SELECT COALESCE(SUM(
      CASE
        WHEN e.amount IS NOT NULL THEN e.amount
        WHEN e.percentage IS NOT NULL THEN (v_fee_types.default_amount * e.percentage / 100)
        ELSE 0
      END
    ), 0) INTO v_discount_amount
    FROM payment_exemptions e
    WHERE e.student_id = p_student_id
      AND e.is_active = true
      AND e.valid_from <= CURRENT_DATE
      AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
      AND (e.applies_to_fee_types = '[]'::jsonb OR v_fee_types.id::text = ANY(e.applies_to_fee_types::text[]));

    -- Calculate final amount
    v_final_amount := v_fee_types.default_amount - v_discount_amount;

    -- Get installment configuration from metadata
    v_installment_config := v_fee_types.metadata->>'installments';

    -- Check if this fee type has installment configuration
    IF v_installment_config IS NOT NULL AND jsonb_typeof(v_installment_config) = 'object' THEN
      -- Parse installment configuration
      v_num_installments := COALESCE((v_installment_config->>'number')::INT, 1);
      v_interval_months := COALESCE((v_installment_config->>'intervalMonths')::INT, 1);
      v_start_date := COALESCE((v_installment_config->>'startDate')::DATE, v_academic_year.start_date);

      -- Calculate amount per installment
      v_installment_amount := v_final_amount / v_num_installments;

      -- Create multiple fee schedules for each installment
      FOR v_installment_index IN 1..v_num_installments LOOP
        -- Calculate due date for this installment
        v_due_date := v_start_date + ((v_installment_index - 1) * v_interval_months || ' months')::INTERVAL;

        -- Ensure due date is within academic year
        IF v_due_date > v_academic_year.end_date THEN
          v_due_date := v_academic_year.end_date;
        END IF;

        INSERT INTO fee_schedules (
          school_id,
          student_id,
          academic_year_id,
          fee_type_id,
          amount,
          remaining_amount,
          discount_amount,
          discount_reason,
          due_date,
          status,
          notes,
          metadata
        ) VALUES (
          v_student.school_id,
          p_student_id,
          p_academic_year_id,
          v_fee_types.id,
          v_installment_amount,
          v_installment_amount - v_discount_amount, -- Apply discount proportionally
          v_discount_amount / v_num_installments, -- Distribute discount across installments
          CASE WHEN v_discount_amount > 0 THEN format('Exonération automatique (échéance %d/%d)', v_installment_index, v_num_installments) ELSE NULL END,
          v_due_date,
          'pending',
          format('Échéance %d/%d - %s', v_installment_index, v_num_installments, v_fee_types.name),
          jsonb_build_object(
            'installment_number', v_installment_index,
            'total_installments', v_num_installments,
            'original_amount', v_fee_types.default_amount
          )
        );

        v_created_count := v_created_count + 1;
      END LOOP;

    ELSE
      -- No installment configuration: create single fee schedule
      -- Use configured due_date from metadata or default to academic year end
      v_due_date := COALESCE(
        (v_fee_types.metadata->>'due_date')::DATE,
        v_academic_year.end_date
      );

      INSERT INTO fee_schedules (
        school_id,
        student_id,
        academic_year_id,
        fee_type_id,
        amount,
        remaining_amount,
        discount_amount,
        discount_reason,
        due_date,
        status
      ) VALUES (
        v_student.school_id,
        p_student_id,
        p_academic_year_id,
        v_fee_types.id,
        v_fee_types.default_amount,
        v_final_amount,
        v_discount_amount,
        CASE WHEN v_discount_amount > 0 THEN 'Exonération automatique' ELSE NULL END,
        v_due_date,
        'pending'
      );

      v_created_count := v_created_count + 1;
    END IF;
  END LOOP;

  RETURN v_created_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: check_overdue_payments
-- ============================================

CREATE OR REPLACE FUNCTION check_overdue_payments()
RETURNS INT AS $$
DECLARE
  v_updated_count INT := 0;
BEGIN
  -- Update all pending fee schedules that are past due date
  UPDATE fee_schedules
  SET
    status = 'overdue',
    updated_at = NOW()
  WHERE
    due_date < CURRENT_DATE
    AND status IN ('pending', 'partial')
    AND remaining_amount > 0;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: recalculate_fee_schedule_after_exemption
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_fee_schedule_after_exemption()
RETURNS TRIGGER AS $$
DECLARE
  v_student_id UUID;
  v_fee_schedule_ids UUID[];
BEGIN
  -- Determine which student to recalculate for
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
  ELSE
    v_student_id := NEW.student_id;
  END IF;

  -- Only proceed if we have a student_id
  IF v_student_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Get all fee schedules for this student that are not paid/cancelled
  FOR v_fee_schedule_ids IN
    SELECT ARRAY_AGG(id)
    FROM fee_schedules
    WHERE student_id = v_student_id
      AND status NOT IN ('paid', 'cancelled')
  LOOP
    -- Exit if no fee schedules to update
    IF v_fee_schedule_ids IS NULL THEN
      CONTINUE;
    END IF;

    -- For each fee schedule, recalculate discounts from ALL active exemptions
    UPDATE fee_schedules
    SET
      -- Reset discount_amount first
      discount_amount = 0,
      remaining_amount = fee_schedules.amount - fee_schedules.paid_amount,
      discount_reason = NULL,
      updated_at = NOW()
    WHERE id = ANY(v_fee_schedule_ids);

    -- Now apply all active exemptions
    UPDATE fee_schedules fs
    SET
      discount_amount = fs.discount_amount + (
        SELECT COALESCE(SUM(
          CASE
            WHEN e.amount IS NOT NULL THEN e.amount
            WHEN e.percentage IS NOT NULL THEN (fs.amount * e.percentage / 100)
            ELSE 0
          END
        ), 0)
        FROM payment_exemptions e
        WHERE e.student_id = v_student_id
          AND e.is_active = true
          AND e.valid_from <= CURRENT_DATE
          AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
          AND (e.applies_to_fee_types = '[]'::jsonb OR fs.fee_type_id::text = ANY(e.applies_to_fee_types::text[]))
      ),
      remaining_amount = fs.amount - fs.paid_amount - (
        SELECT COALESCE(SUM(
          CASE
            WHEN e.amount IS NOT NULL THEN e.amount
            WHEN e.percentage IS NOT NULL THEN (fs.amount * e.percentage / 100)
            ELSE 0
          END
        ), 0)
        FROM payment_exemptions e
        WHERE e.student_id = v_student_id
          AND e.is_active = true
          AND e.valid_from <= CURRENT_DATE
          AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
          AND (e.applies_to_fee_types = '[]'::jsonb OR fs.fee_type_id::text = ANY(e.applies_to_fee_types::text[]))
      ),
      discount_reason = (
        SELECT STRING_AGG(
          CASE
            WHEN e.amount IS NOT NULL THEN format('Exonération: %s (%.2f)', e.exemption_type, e.amount)
            WHEN e.percentage IS NOT NULL THEN format('Exonération: %s (%.2f%%)', e.exemption_type, e.percentage)
            ELSE 'Exonération'
          END,
          '; '
        )
        FROM payment_exemptions e
        WHERE e.student_id = v_student_id
          AND e.is_active = true
          AND e.valid_from <= CURRENT_DATE
          AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
          AND (e.applies_to_fee_types = '[]'::jsonb OR fs.fee_type_id::text = ANY(e.applies_to_fee_types::text[]))
      ),
      updated_at = NOW()
    WHERE fs.id = ANY(v_fee_schedule_ids);
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Create Triggers
-- ============================================

-- Trigger to apply payment to schedule automatically
CREATE TRIGGER trigger_apply_payment_to_schedule
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION apply_payment_to_schedule();

-- Trigger to recalculate fee schedules when exemption is added/updated/deleted
CREATE TRIGGER trigger_recalculate_after_exemption
  AFTER INSERT OR UPDATE OR DELETE ON payment_exemptions
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_fee_schedule_after_exemption();

-- ============================================
-- Grant Execute Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION calculate_student_balance TO authenticated;
GRANT EXECUTE ON FUNCTION generate_fee_schedules_for_student TO authenticated;
GRANT EXECUTE ON FUNCTION check_overdue_payments TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION calculate_student_balance IS 'Calculates the payment balance and status for a student in an academic year';
COMMENT ON FUNCTION apply_payment_to_schedule IS 'Automatically updates fee schedule when a payment is recorded';
COMMENT ON FUNCTION generate_fee_schedules_for_student IS 'Generates fee schedules for a student based on applicable fee types';
COMMENT ON FUNCTION check_overdue_payments IS 'Updates status of overdue fee schedules and returns count of updates';
COMMENT ON FUNCTION recalculate_fee_schedule_after_exemption IS 'Recalculates fee schedules when an exemption is added or activated';
