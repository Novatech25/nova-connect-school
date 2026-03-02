-- Migration: Add Subject Categories (Unités d'Enseignement)
-- Description: Creates subject_categories table to group subjects into UEs
-- Created: 2026-03-01

-- ============================================
-- SUBJECT CATEGORIES (Unités d'Enseignement)
-- ============================================

CREATE TABLE IF NOT EXISTS subject_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g., "UE 2 : Gestion"
  code VARCHAR(50), -- e.g., "UE2"
  description TEXT,
  color VARCHAR(7), -- Hex color for UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE subject_categories IS 'Categories or Unités d''Enseignement (UE) to group subjects';

-- Trigger for updated_at
CREATE TRIGGER subject_categories_updated_at
  BEFORE UPDATE ON subject_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ALTER SUBJECTS TABLE
-- ============================================

-- Add category_id to subjects table
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES subject_categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN subjects.category_id IS 'Reference to the subject category / Unité d''Enseignement (UE) grouping';

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE subject_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subject categories of their school"
  ON subject_categories FOR SELECT
  USING (
    school_id = (SELECT auth.jwt() ->> 'school_id')::uuid
  );

CREATE POLICY "School admins can manage subject categories"
  ON subject_categories FOR ALL
  TO authenticated
  USING (
    school_id = (SELECT auth.jwt() ->> 'school_id')::uuid
    AND (
      (SELECT auth.jwt() ->> 'role') = 'school_admin' OR
      (SELECT auth.jwt() ->> 'role') = 'super_admin'
    )
  )
  WITH CHECK (
    school_id = (SELECT auth.jwt() ->> 'school_id')::uuid
    AND (
      (SELECT auth.jwt() ->> 'role') = 'school_admin' OR
      (SELECT auth.jwt() ->> 'role') = 'super_admin'
    )
  );

-- ============================================
-- AUDIT TRIGGERS
-- ============================================

CREATE TRIGGER subject_categories_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON subject_categories
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();
