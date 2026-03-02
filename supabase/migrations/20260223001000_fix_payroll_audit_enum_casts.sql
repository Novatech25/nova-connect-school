-- Migration: Fix COALESCE Enum Casts in Payroll Audit Triggers
-- Description: Fixes the 400 Bad Request error `invalid input value for enum payroll_period_status: ""` during UPDATE operations by properly casting the enum value to TEXT before using COALESCE with an empty string.

-- ============================================
-- Fix Trigger: payroll_periods
-- ============================================
CREATE OR REPLACE FUNCTION audit_payroll_periods()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'payroll_period', NEW.id, 'create', 'payroll_periods',
      'Période créée: ' || COALESCE(NEW.period_name, '') ||
      ' (' || COALESCE(NEW.start_date::TEXT, '') || ' - ' || COALESCE(NEW.end_date::TEXT, '') || ')',
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'payroll_period', NEW.id, 'update', 'payroll_periods',
      'Période mise à jour: ' || COALESCE(NEW.period_name, '') ||
      ' statut=' || COALESCE(NEW.status::TEXT, ''),
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'payroll_period', OLD.id, 'delete', 'payroll_periods',
      'Période supprimée: ' || COALESCE(OLD.period_name, ''),
      OLD.school_id
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Fix Trigger: payroll_entries
-- ============================================
CREATE OR REPLACE FUNCTION audit_payroll_entries()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'payroll_entry', NEW.id, 'create', 'payroll_entries',
      'Entrée paie créée pour enseignant ' || COALESCE(NEW.teacher_id::TEXT, ''),
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'payroll_entry', NEW.id, 'update', 'payroll_entries',
      'Entrée mise à jour: statut=' || COALESCE(NEW.status::TEXT, '') ||
      ' net=' || COALESCE(NEW.net_amount::TEXT, ''),
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'payroll_entry', OLD.id, 'delete', 'payroll_entries',
      'Entrée supprimée',
      OLD.school_id
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Fix Trigger: salary_components
-- ============================================
CREATE OR REPLACE FUNCTION audit_salary_components()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'salary_component', NEW.id, 'create', 'salary_components',
      'Composante créée: ' || COALESCE(NEW.label, '') ||
      ' type=' || COALESCE(NEW.component_type::TEXT, '') ||
      ' montant=' || COALESCE(NEW.amount::TEXT, ''),
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'salary_component', OLD.id, 'delete', 'salary_components',
      'Composante supprimée: ' || COALESCE(OLD.label, ''),
      OLD.school_id
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Fix Trigger: payroll_payments
-- ============================================
CREATE OR REPLACE FUNCTION audit_payroll_payments()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'payroll_payment', NEW.id, 'create', 'payroll_payments',
      'Paiement enregistré: ' || COALESCE(NEW.amount::TEXT, '') || ' FCFA' ||
      ' méthode=' || COALESCE(NEW.payment_method::TEXT, ''),
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'payroll_payment', OLD.id, 'delete', 'payroll_payments',
      'Paiement supprimé: ' || COALESCE(OLD.amount::TEXT, '') || ' FCFA',
      OLD.school_id
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
