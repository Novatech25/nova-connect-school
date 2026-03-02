-- ============================================
-- Migration: Fix Payroll Audit Triggers
-- Created: 2026-02-21
-- Description: Remplace les triggers d'audit payroll qui utilisaient create_audit_log()
--              (ancien schéma: resource_type) par des fonctions utilisant log_audit_event()
--              (nouveau schéma: entity_type, entity_id, table_name, description)
-- ============================================

-- Supprimer les anciens triggers payroll qui appellent create_audit_log()
DROP TRIGGER IF EXISTS payroll_periods_audit_trigger ON payroll_periods;
DROP TRIGGER IF EXISTS payroll_entries_audit_trigger ON payroll_entries;
DROP TRIGGER IF EXISTS salary_components_audit_trigger ON salary_components;
DROP TRIGGER IF EXISTS payroll_payments_audit_trigger ON payroll_payments;
DROP TRIGGER IF EXISTS payroll_slips_audit_trigger ON payroll_slips;

-- ============================================
-- Trigger: payroll_periods
-- ============================================
DROP FUNCTION IF EXISTS audit_payroll_periods();

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
      ' statut=' || COALESCE(NEW.status, ''),
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

CREATE TRIGGER payroll_periods_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payroll_periods
  FOR EACH ROW EXECUTE FUNCTION audit_payroll_periods();

-- ============================================
-- Trigger: payroll_entries
-- ============================================
DROP FUNCTION IF EXISTS audit_payroll_entries();

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
      'Entrée mise à jour: statut=' || COALESCE(NEW.status, '') ||
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

CREATE TRIGGER payroll_entries_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payroll_entries
  FOR EACH ROW EXECUTE FUNCTION audit_payroll_entries();

-- ============================================
-- Trigger: salary_components
-- ============================================
DROP FUNCTION IF EXISTS audit_salary_components();

CREATE OR REPLACE FUNCTION audit_salary_components()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'salary_component', NEW.id, 'create', 'salary_components',
      'Composante créée: ' || COALESCE(NEW.label, '') ||
      ' type=' || COALESCE(NEW.component_type, '') ||
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

CREATE TRIGGER salary_components_audit_trigger
  AFTER INSERT OR DELETE ON salary_components
  FOR EACH ROW EXECUTE FUNCTION audit_salary_components();

-- ============================================
-- Trigger: payroll_payments
-- ============================================
DROP FUNCTION IF EXISTS audit_payroll_payments();

CREATE OR REPLACE FUNCTION audit_payroll_payments()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'payroll_payment', NEW.id, 'create', 'payroll_payments',
      'Paiement enregistré: ' || COALESCE(NEW.amount::TEXT, '') || ' FCFA' ||
      ' méthode=' || COALESCE(NEW.payment_method, ''),
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

CREATE TRIGGER payroll_payments_audit_trigger
  AFTER INSERT OR DELETE ON payroll_payments
  FOR EACH ROW EXECUTE FUNCTION audit_payroll_payments();

-- ============================================
-- Trigger: payroll_slips
-- ============================================
DROP FUNCTION IF EXISTS audit_payroll_slips();

CREATE OR REPLACE FUNCTION audit_payroll_slips()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'payroll_slip', NEW.id, 'create', 'payroll_slips',
      'Bulletin généré: ' || COALESCE(NEW.slip_number, ''),
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'payroll_slip', OLD.id, 'delete', 'payroll_slips',
      'Bulletin supprimé: ' || COALESCE(OLD.slip_number, ''),
      OLD.school_id
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payroll_slips_audit_trigger
  AFTER INSERT OR DELETE ON payroll_slips
  FOR EACH ROW EXECUTE FUNCTION audit_payroll_slips();
