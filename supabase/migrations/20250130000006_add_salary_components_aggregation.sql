-- Migration: Add Salary Components Aggregation
-- Created: 2025-01-30
-- Description: Adds trigger to aggregate salary components into payroll entries

-- Function to aggregate salary components for a payroll entry
CREATE OR REPLACE FUNCTION aggregate_salary_components()
RETURNS TRIGGER AS $$
DECLARE
  payroll_entry_id UUID;
BEGIN
  -- Determine the payroll entry ID based on operation
  IF TG_OP = 'DELETE' THEN
    payroll_entry_id := OLD.payroll_entry_id;
  ELSE
    payroll_entry_id := NEW.payroll_entry_id;
  END IF;

  -- Update the payroll entry with aggregated amounts by component type
  UPDATE payroll_entries
  SET
    primes_amount = COALESCE((
      SELECT COALESCE(SUM(amount), 0)
      FROM salary_components
      WHERE payroll_entry_id = payroll_entry_id
        AND component_type IN ('prime', 'bonus')
    ), 0),
    retenues_amount = COALESCE((
      SELECT COALESCE(SUM(ABS(amount)), 0)
      FROM salary_components
      WHERE payroll_entry_id = payroll_entry_id
        AND component_type IN ('retenue', 'deduction')
    ), 0),
    avances_amount = COALESCE((
      SELECT COALESCE(SUM(ABS(amount)), 0)
      FROM salary_components
      WHERE payroll_entry_id = payroll_entry_id
        AND component_type = 'avance'
    ), 0)
  WHERE id = payroll_entry_id;

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
CREATE TRIGGER salary_components_insert_aggregate_trigger
  AFTER INSERT ON salary_components
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_salary_components();

-- Create trigger for UPDATE
CREATE TRIGGER salary_components_update_aggregate_trigger
  AFTER UPDATE ON salary_components
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_salary_components();

-- Create trigger for DELETE
CREATE TRIGGER salary_components_delete_aggregate_trigger
  AFTER DELETE ON salary_components
  FOR EACH ROW
  EXECUTE FUNCTION aggregate_salary_components();
