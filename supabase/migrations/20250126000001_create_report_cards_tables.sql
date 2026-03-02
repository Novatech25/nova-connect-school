-- Migration: Create report cards tables
-- Description: Creates tables for report cards with versioning and workflow

-- Create enums
CREATE TYPE report_card_status_enum AS ENUM ('draft', 'generated', 'published', 'archived');
CREATE TYPE payment_block_status_enum AS ENUM ('ok', 'warning', 'blocked');

-- Create report_cards table
CREATE TABLE report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  grading_scale_id UUID NOT NULL REFERENCES grading_scales(id) ON DELETE RESTRICT,

  -- Calculated data (snapshot at generation time)
  overall_average DECIMAL(5,2) NOT NULL,
  rank_in_class INTEGER,
  class_size INTEGER NOT NULL,
  mention VARCHAR(50),
  mention_color VARCHAR(7),
  subject_averages JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status and workflow
  status report_card_status_enum NOT NULL DEFAULT 'draft',
  generated_at TIMESTAMPTZ,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Payment blocking
  payment_status payment_block_status_enum NOT NULL DEFAULT 'ok',
  payment_status_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_by UUID REFERENCES users(id) ON DELETE SET NULL,
  override_at TIMESTAMPTZ,

  -- PDF storage
  pdf_url TEXT,
  pdf_size_bytes INTEGER,

  -- Metadata
  comments TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT report_cards_unique UNIQUE (school_id, student_id, period_id, academic_year_id),
  CONSTRAINT report_cards_rank_positive CHECK (rank_in_class IS NULL OR rank_in_class > 0),
  CONSTRAINT report_cards_class_size_positive CHECK (class_size > 0),
  CONSTRAINT report_cards_average_valid CHECK (overall_average >= 0 AND overall_average <= 20)
);

-- Create indexes for report_cards
CREATE INDEX idx_report_cards_school_id ON report_cards(school_id);
CREATE INDEX idx_report_cards_student_id ON report_cards(student_id);
CREATE INDEX idx_report_cards_class_id ON report_cards(class_id);
CREATE INDEX idx_report_cards_period_id ON report_cards(period_id);
CREATE INDEX idx_report_cards_status ON report_cards(status);
CREATE INDEX idx_report_cards_payment_status ON report_cards(payment_status);
CREATE INDEX idx_report_cards_published_at ON report_cards(published_at DESC);

-- Create report_card_versions table
CREATE TABLE report_card_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_card_id UUID NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot of data at this version
  overall_average DECIMAL(5,2) NOT NULL,
  rank_in_class INTEGER,
  class_size INTEGER NOT NULL,
  mention VARCHAR(50),
  subject_averages JSONB NOT NULL,

  -- Change tracking
  change_reason TEXT,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PDF for this version
  pdf_url TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT report_card_versions_version_positive CHECK (version_number > 0)
);

-- Create indexes for report_card_versions
CREATE INDEX idx_report_card_versions_report_card_id ON report_card_versions(report_card_id);
CREATE INDEX idx_report_card_versions_changed_at ON report_card_versions(changed_at DESC);

-- Note: Storage bucket 'report-cards' should be created manually in Supabase dashboard if needed

-- Create trigger for updated_at
CREATE TRIGGER update_report_cards_updated_at
  BEFORE UPDATE ON report_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function for versioning
CREATE OR REPLACE FUNCTION create_report_card_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  IF (OLD.overall_average IS DISTINCT FROM NEW.overall_average)
     OR (OLD.rank_in_class IS DISTINCT FROM NEW.rank_in_class)
     OR (OLD.subject_averages IS DISTINCT FROM NEW.subject_averages) THEN

    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM report_card_versions
    WHERE report_card_id = NEW.id;

    INSERT INTO report_card_versions (
      report_card_id, school_id, version_number,
      overall_average, rank_in_class, class_size, mention, subject_averages,
      changed_by, pdf_url
    ) VALUES (
      NEW.id, NEW.school_id, next_version,
      NEW.overall_average, NEW.rank_in_class, NEW.class_size, NEW.mention, NEW.subject_averages,
      COALESCE((SELECT auth.uid()), NEW.generated_by), NEW.pdf_url
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for versioning
CREATE TRIGGER create_report_card_version_trigger
  AFTER UPDATE ON report_cards
  FOR EACH ROW
  EXECUTE FUNCTION create_report_card_version();

-- Add helpful comments
COMMENT ON TABLE report_cards IS 'Stores report cards with calculated averages, rankings, and mentions';
COMMENT ON TABLE report_card_versions IS 'Stores version history for report cards';
COMMENT ON COLUMN report_cards.payment_status IS 'Payment status: ok, warning, or blocked. Controls document access';
COMMENT ON COLUMN report_cards.payment_status_override IS 'Admin override to unblock documents despite payment issues';
COMMENT ON COLUMN report_cards.subject_averages IS 'JSON array of subject averages with names, coefficients, and counts';
