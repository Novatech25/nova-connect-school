-- Migration: Enhanced Receipt System for NovaConnect
-- Date: 2025-03-01
-- Description: Add sequential numbering, printer profiles, and verification tokens

-- Table pour séquences de numérotation par école et type
CREATE TABLE receipt_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  receipt_type VARCHAR(20) NOT NULL CHECK (receipt_type IN ('student_payment', 'teacher_salary')),
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  prefix VARCHAR(10) NOT NULL, -- 'SCH' ou 'SAL'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, receipt_type, year)
);

-- Table pour profils d'impression par école
CREATE TABLE printer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  profile_name VARCHAR(50) NOT NULL,
  profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('A4_STANDARD', 'THERMAL_80', 'THERMAL_58')),
  is_default BOOLEAN DEFAULT false,
  template_config JSONB DEFAULT '{}', -- Marges, polices, tailles
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, profile_name)
);

-- Table pour tokens de vérification QR
CREATE TABLE receipt_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL, -- Peut référencer payment_receipts ou payroll_slips
  receipt_type VARCHAR(20) NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_receipt_sequences_school_year ON receipt_sequences(school_id, year);
CREATE INDEX idx_printer_profiles_school ON printer_profiles(school_id);
CREATE INDEX idx_printer_profiles_default ON printer_profiles(school_id, is_default) WHERE is_default = true;
CREATE INDEX idx_verification_tokens_hash ON receipt_verification_tokens(token_hash);
CREATE INDEX idx_verification_tokens_expires ON receipt_verification_tokens(expires_at);

-- Extension payment_receipts
ALTER TABLE payment_receipts
  ADD COLUMN printer_profile_id UUID REFERENCES printer_profiles(id),
  ADD COLUMN verification_token_id UUID REFERENCES receipt_verification_tokens(id),
  ADD COLUMN auto_sent BOOLEAN DEFAULT false,
  ADD COLUMN send_channels JSONB DEFAULT '[]', -- ["email", "whatsapp"]
  ADD COLUMN send_status JSONB DEFAULT '{}'; -- {email: "sent", whatsapp: "failed"}

-- Extension payroll_slips
ALTER TABLE payroll_slips
  ADD COLUMN printer_profile_id UUID REFERENCES printer_profiles(id),
  ADD COLUMN verification_token_id UUID REFERENCES receipt_verification_tokens(id),
  ADD COLUMN auto_sent BOOLEAN DEFAULT false,
  ADD COLUMN send_channels JSONB DEFAULT '[]',
  ADD COLUMN send_status JSONB DEFAULT '{}';

-- Fonction pour générer numéro séquentiel
CREATE OR REPLACE FUNCTION generate_receipt_number(
  p_school_id UUID,
  p_receipt_type VARCHAR,
  p_year INTEGER DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
  v_year INTEGER;
  v_prefix VARCHAR(10);
  v_next_number INTEGER;
  v_receipt_number VARCHAR(50);
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_prefix := CASE p_receipt_type
    WHEN 'student_payment' THEN 'SCH'
    WHEN 'teacher_salary' THEN 'SAL'
    ELSE 'REC'
  END;

  -- Lock et increment atomique
  INSERT INTO receipt_sequences (school_id, receipt_type, year, last_number, prefix)
  VALUES (p_school_id, p_receipt_type, v_year, 1, v_prefix)
  ON CONFLICT (school_id, receipt_type, year)
  DO UPDATE SET last_number = receipt_sequences.last_number + 1
  RETURNING last_number INTO v_next_number;

  v_receipt_number := v_prefix || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 7, '0');
  RETURN v_receipt_number;
END;
$$ LANGUAGE plpgsql;
