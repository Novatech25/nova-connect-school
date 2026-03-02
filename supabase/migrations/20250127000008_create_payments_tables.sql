-- Migration: Create Payments Tables
-- Description: Creates all tables for the school payment system
-- Date: 2025-01-27

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM Types
-- ============================================

CREATE TYPE fee_type_category AS ENUM (
  'inscription',
  'mensualite',
  'tranche',
  'examen',
  'activite',
  'autre'
);

CREATE TYPE fee_schedule_status AS ENUM (
  'pending',
  'paid',
  'partial',
  'overdue',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'cash',
  'bank_transfer',
  'check',
  'mobile_money',
  'card',
  'other'
);

CREATE TYPE reminder_type AS ENUM (
  'first',
  'second',
  'final',
  'custom'
);

CREATE TYPE reminder_status AS ENUM (
  'pending',
  'sent',
  'failed'
);

CREATE TYPE exemption_type AS ENUM (
  'scholarship',
  'discount',
  'exemption',
  'other'
);

-- ============================================
-- Tables
-- ============================================

-- Table: fee_types (types de frais paramétrables par école)
CREATE TABLE IF NOT EXISTS fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  category fee_type_category NOT NULL DEFAULT 'autre',
  default_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  applies_to_levels JSONB DEFAULT '[]'::jsonb, -- Array of level IDs
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, code)
);

-- Indexes for fee_types
CREATE INDEX idx_fee_types_school_id ON fee_types(school_id);
CREATE INDEX idx_fee_types_code ON fee_types(code);
CREATE INDEX idx_fee_types_category ON fee_types(category);
CREATE INDEX idx_fee_types_is_active ON fee_types(is_active);

-- Check constraints
ALTER TABLE fee_types ADD CONSTRAINT chk_fee_types_default_amount CHECK (default_amount >= 0);

-- Table: fee_schedules (échéanciers de paiement par élève)
CREATE TABLE IF NOT EXISTS fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  fee_type_id UUID NOT NULL REFERENCES fee_types(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  status fee_schedule_status NOT NULL DEFAULT 'pending',
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  remaining_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  discount_reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fee_schedules
CREATE INDEX idx_fee_schedules_school_id ON fee_schedules(school_id);
CREATE INDEX idx_fee_schedules_student_id ON fee_schedules(student_id);
CREATE INDEX idx_fee_schedules_academic_year_id ON fee_schedules(academic_year_id);
CREATE INDEX idx_fee_schedules_fee_type_id ON fee_schedules(fee_type_id);
CREATE INDEX idx_fee_schedules_status ON fee_schedules(status);
CREATE INDEX idx_fee_schedules_due_date ON fee_schedules(due_date);

-- Check constraints
ALTER TABLE fee_schedules ADD CONSTRAINT chk_fee_schedules_amount CHECK (amount >= 0);
ALTER TABLE fee_schedules ADD CONSTRAINT chk_fee_schedules_paid_amount CHECK (paid_amount >= 0);
ALTER TABLE fee_schedules ADD CONSTRAINT chk_fee_schedules_remaining_amount CHECK (remaining_amount >= 0);
ALTER TABLE fee_schedules ADD CONSTRAINT chk_fee_schedules_balance
  CHECK (paid_amount + remaining_amount = amount - discount_amount);

-- Table: payments (enregistrements de paiements effectifs)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_schedule_id UUID NOT NULL REFERENCES fee_schedules(id) ON DELETE RESTRICT,
  amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL,
  reference_number VARCHAR(255),
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for payments
CREATE INDEX idx_payments_school_id ON payments(school_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_fee_schedule_id ON payments(fee_schedule_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);
CREATE INDEX idx_payments_reference_number ON payments(reference_number);

-- Check constraints
ALTER TABLE payments ADD CONSTRAINT chk_payments_amount CHECK (amount > 0);

-- Table: payment_receipts (reçus PDF générés)
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(100) NOT NULL,
  pdf_url TEXT NOT NULL,
  pdf_size_bytes BIGINT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  sent_to JSONB, -- {email, phone, etc.}
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, receipt_number)
);

-- Indexes for payment_receipts
CREATE INDEX idx_payment_receipts_school_id ON payment_receipts(school_id);
CREATE INDEX idx_payment_receipts_payment_id ON payment_receipts(payment_id);
CREATE INDEX idx_payment_receipts_receipt_number ON payment_receipts(receipt_number);
CREATE INDEX idx_payment_receipts_generated_at ON payment_receipts(generated_at);

-- Table: payment_reminders (relances automatiques)
CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_schedule_id UUID NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
  reminder_type reminder_type NOT NULL,
  sent_at TIMESTAMPTZ,
  sent_via JSONB DEFAULT '[]'::jsonb, -- Array: ["push", "email", "sms", "whatsapp"]
  status reminder_status NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  message_template TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for payment_reminders
CREATE INDEX idx_payment_reminders_school_id ON payment_reminders(school_id);
CREATE INDEX idx_payment_reminders_student_id ON payment_reminders(student_id);
CREATE INDEX idx_payment_reminders_fee_schedule_id ON payment_reminders(fee_schedule_id);
CREATE INDEX idx_payment_reminders_status ON payment_reminders(status);
CREATE INDEX idx_payment_reminders_scheduled_for ON payment_reminders(scheduled_for);
CREATE INDEX idx_payment_reminders_sent_at ON payment_reminders(sent_at);

-- Table: payment_exemptions (remises, bourses, exonérations)
CREATE TABLE IF NOT EXISTS payment_exemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exemption_type exemption_type NOT NULL,
  amount DECIMAL(12, 2),
  percentage DECIMAL(5, 2),
  reason TEXT NOT NULL,
  approved_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_from DATE NOT NULL,
  valid_until DATE,
  applies_to_fee_types JSONB DEFAULT '[]'::jsonb, -- Array of fee_type IDs
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for payment_exemptions
CREATE INDEX idx_payment_exemptions_school_id ON payment_exemptions(school_id);
CREATE INDEX idx_payment_exemptions_student_id ON payment_exemptions(student_id);
CREATE INDEX idx_payment_exemptions_exemption_type ON payment_exemptions(exemption_type);
CREATE INDEX idx_payment_exemptions_is_active ON payment_exemptions(is_active);
CREATE INDEX idx_payment_exemptions_valid_from ON payment_exemptions(valid_from);
CREATE INDEX idx_payment_exemptions_valid_until ON payment_exemptions(valid_until);

-- Check constraints
ALTER TABLE payment_exemptions ADD CONSTRAINT chk_payment_exemptions_amount_or_percentage
  CHECK (amount >= 0 OR percentage >= 0);
ALTER TABLE payment_exemptions ADD CONSTRAINT chk_payment_exemptions_percentage_max
  CHECK (percentage IS NULL OR percentage <= 100);

-- ============================================
-- Updated At Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_fee_types_updated_at
  BEFORE UPDATE ON fee_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_schedules_updated_at
  BEFORE UPDATE ON fee_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_exemptions_updated_at
  BEFORE UPDATE ON payment_exemptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE fee_types IS 'Types de frais paramétrables par école (inscription, mensualités, etc.)';
COMMENT ON TABLE fee_schedules IS 'Échéanciers de paiement par élève et par année académique';
COMMENT ON TABLE payments IS 'Enregistrements des paiements effectifs';
COMMENT ON TABLE payment_receipts IS 'Reçus PDF générés pour chaque paiement';
COMMENT ON TABLE payment_reminders IS 'Relances automatiques pour paiements en retard';
COMMENT ON TABLE payment_exemptions IS 'Remises, bourses et exonérations accordées aux élèves';

COMMENT ON COLUMN fee_schedules.status IS 'Statut du paiement: pending, paid, partial, overdue, cancelled';
COMMENT ON COLUMN payments.payment_method IS 'Méthode de paiement: cash, bank_transfer, check, mobile_money, card, other';
COMMENT ON COLUMN payment_exemptions.percentage IS 'Pourcentage de réduction (0-100), alternatif à amount';
