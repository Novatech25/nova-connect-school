-- Migration: Create Payroll Tables
-- Created: 2025-01-30
-- Description: Creates complete payroll system tables for teacher salary management

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Enum pour statut de période de paie
CREATE TYPE payroll_period_status AS ENUM ('draft', 'pending_payment', 'paid', 'cancelled');

-- Enum pour type de composant salarial
CREATE TYPE salary_component_type AS ENUM ('base_hours', 'prime', 'retenue', 'avance', 'bonus', 'deduction', 'other');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Table : payroll_periods (périodes de paie mensuelles)
CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  period_name VARCHAR(100) NOT NULL, -- "Janvier 2025", "Février 2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status payroll_period_status DEFAULT 'draft',
  total_amount DECIMAL(12,2) DEFAULT 0.00,
  total_teachers INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, academic_year_id, period_name)
);

-- Table : payroll_entries (entrées de paie par professeur)
CREATE TABLE payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Calcul heures
  total_hours DECIMAL(8,2) DEFAULT 0.00,
  validated_hours DECIMAL(8,2) DEFAULT 0.00,
  hourly_rate DECIMAL(10,2) DEFAULT 0.00,
  base_amount DECIMAL(12,2) DEFAULT 0.00, -- validated_hours × hourly_rate

  -- Ajustements
  primes_amount DECIMAL(12,2) DEFAULT 0.00,
  retenues_amount DECIMAL(12,2) DEFAULT 0.00,
  avances_amount DECIMAL(12,2) DEFAULT 0.00,

  -- Total
  gross_amount DECIMAL(12,2) DEFAULT 0.00, -- base + primes
  net_amount DECIMAL(12,2) DEFAULT 0.00, -- gross - retenues - avances

  -- Statut
  status payroll_period_status DEFAULT 'draft',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payroll_period_id, teacher_id)
);

-- Table : salary_components (détail des composants : primes, retenues, avances)
CREATE TABLE salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  payroll_entry_id UUID NOT NULL REFERENCES payroll_entries(id) ON DELETE CASCADE,
  component_type salary_component_type NOT NULL,
  label VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table : payroll_payments (enregistrement des paiements effectifs)
CREATE TABLE payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  payroll_entry_id UUID NOT NULL REFERENCES payroll_entries(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL, -- Réutilise l'enum existant
  reference_number VARCHAR(255),
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table : payroll_slips (fiches de paie PDF)
CREATE TABLE payroll_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  payroll_entry_id UUID NOT NULL REFERENCES payroll_entries(id) ON DELETE CASCADE,
  slip_number VARCHAR(100) NOT NULL,
  pdf_url TEXT NOT NULL, -- Chemin dans Storage
  pdf_size_bytes BIGINT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  sent_to JSONB, -- {email, phone}
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, slip_number)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes payroll_periods
CREATE INDEX idx_payroll_periods_school_id ON payroll_periods(school_id);
CREATE INDEX idx_payroll_periods_academic_year_id ON payroll_periods(academic_year_id);
CREATE INDEX idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX idx_payroll_periods_dates ON payroll_periods(start_date, end_date);

-- Indexes payroll_entries
CREATE INDEX idx_payroll_entries_school_id ON payroll_entries(school_id);
CREATE INDEX idx_payroll_entries_payroll_period_id ON payroll_entries(payroll_period_id);
CREATE INDEX idx_payroll_entries_teacher_id ON payroll_entries(teacher_id);
CREATE INDEX idx_payroll_entries_status ON payroll_entries(status);

-- Indexes salary_components
CREATE INDEX idx_salary_components_payroll_entry_id ON salary_components(payroll_entry_id);
CREATE INDEX idx_salary_components_component_type ON salary_components(component_type);

-- Indexes payroll_payments
CREATE INDEX idx_payroll_payments_payroll_entry_id ON payroll_payments(payroll_entry_id);
CREATE INDEX idx_payroll_payments_payment_date ON payroll_payments(payment_date);

-- Indexes payroll_slips
CREATE INDEX idx_payroll_slips_payroll_entry_id ON payroll_slips(payroll_entry_id);
CREATE INDEX idx_payroll_slips_slip_number ON payroll_slips(slip_number);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

ALTER TABLE payroll_periods ADD CONSTRAINT chk_payroll_periods_dates CHECK (end_date > start_date);
ALTER TABLE payroll_periods ADD CONSTRAINT chk_payroll_periods_total_amount CHECK (total_amount >= 0);
ALTER TABLE payroll_entries ADD CONSTRAINT chk_payroll_entries_hours CHECK (total_hours >= 0 AND validated_hours >= 0);
ALTER TABLE payroll_entries ADD CONSTRAINT chk_payroll_entries_amounts CHECK (
  base_amount >= 0 AND primes_amount >= 0 AND retenues_amount >= 0 AND avances_amount >= 0
);
ALTER TABLE salary_components ADD CONSTRAINT chk_salary_components_amount CHECK (amount != 0);
ALTER TABLE payroll_payments ADD CONSTRAINT chk_payroll_payments_amount CHECK (amount > 0);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Triggers updated_at
CREATE TRIGGER payroll_periods_updated_at BEFORE UPDATE ON payroll_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER payroll_entries_updated_at BEFORE UPDATE ON payroll_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER payroll_payments_updated_at BEFORE UPDATE ON payroll_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour calculer automatiquement les montants d'une entrée de paie
CREATE OR REPLACE FUNCTION calculate_payroll_entry_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcul base_amount
  NEW.base_amount := NEW.validated_hours * NEW.hourly_rate;

  -- Calcul gross_amount
  NEW.gross_amount := NEW.base_amount + NEW.primes_amount;

  -- Calcul net_amount
  NEW.net_amount := NEW.gross_amount - NEW.retenues_amount - NEW.avances_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_payroll_entry_amounts_trigger
  BEFORE INSERT OR UPDATE ON payroll_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_payroll_entry_amounts();
