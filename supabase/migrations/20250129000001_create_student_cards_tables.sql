-- Migration: Create student_cards and card_templates tables
-- Created: 2025-01-29

-- Create card_templates table
CREATE TABLE IF NOT EXISTS card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  layout_config JSONB NOT NULL DEFAULT '{}',
  logo_url TEXT,
  background_image_url TEXT,
  card_width_mm DECIMAL(5,2) DEFAULT 85.60,
  card_height_mm DECIMAL(5,2) DEFAULT 53.98,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT card_templates_school_name_unique UNIQUE(school_id, name),
  CONSTRAINT card_templates_valid_dimensions CHECK(card_width_mm > 0 AND card_height_mm > 0)
);

-- Create indexes for card_templates
CREATE INDEX idx_card_templates_school_id ON card_templates(school_id);
CREATE INDEX idx_card_templates_is_default ON card_templates(is_default) WHERE is_default = true;
CREATE INDEX idx_card_templates_is_active ON card_templates(is_active);

-- Create student_cards table
CREATE TABLE IF NOT EXISTS student_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  template_id UUID REFERENCES card_templates(id) ON DELETE SET NULL,
  card_number VARCHAR(100) NOT NULL,
  qr_code_data TEXT NOT NULL,
  qr_code_signature TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'revoked', 'lost')),
  pdf_url TEXT,
  pdf_size_bytes BIGINT,
  generated_at TIMESTAMPTZ,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason TEXT,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'ok' CHECK(payment_status IN ('ok', 'warning', 'blocked')),
  payment_status_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT student_cards_school_card_number_unique UNIQUE(school_id, card_number),
  CONSTRAINT student_cards_valid_dates CHECK(expiry_date IS NULL OR expiry_date > issue_date)
);

-- Create indexes for student_cards
CREATE INDEX idx_student_cards_school_id ON student_cards(school_id);
CREATE INDEX idx_student_cards_student_id ON student_cards(student_id);
CREATE INDEX idx_student_cards_status ON student_cards(status);
CREATE INDEX idx_student_cards_card_number ON student_cards(card_number);
CREATE INDEX idx_student_cards_expiry_date ON student_cards(expiry_date) WHERE expiry_date IS NOT NULL;

-- Create unique index for active cards per student
CREATE UNIQUE INDEX idx_student_cards_active_per_student
ON student_cards(student_id)
WHERE status = 'active';

-- Function to generate card number
CREATE OR REPLACE FUNCTION generate_card_number(p_school_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_year VARCHAR(4);
  v_sequence INTEGER;
  v_card_number VARCHAR(100);
  v_school_code VARCHAR(20);
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT code INTO v_school_code FROM schools WHERE id = p_school_id;
  IF v_school_code IS NULL OR v_school_code = '' THEN
    v_school_code := 'CARD';
  END IF;

  SELECT COALESCE(MAX(CAST(SPLIT_PART(card_number, '-', 3) AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM student_cards
  WHERE school_id = p_school_id
  AND card_number LIKE v_school_code || '-' || v_year || '-%';

  v_card_number := v_school_code || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');

  RETURN v_card_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate card number
CREATE OR REPLACE FUNCTION auto_generate_card_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.card_number IS NULL OR NEW.card_number = '' THEN
    NEW.card_number := generate_card_number(NEW.school_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating card number
CREATE TRIGGER student_cards_auto_card_number
  BEFORE INSERT ON student_cards
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_card_number();

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at on both tables
CREATE TRIGGER update_card_templates_updated_at
  BEFORE UPDATE ON card_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_cards_updated_at
  BEFORE UPDATE ON student_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
