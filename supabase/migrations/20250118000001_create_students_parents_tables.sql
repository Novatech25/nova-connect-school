-- ============================================
-- ENUMS
-- ============================================

-- Gender enum
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- Student status enum
CREATE TYPE student_status_enum AS ENUM ('active', 'inactive', 'graduated', 'transferred', 'expelled', 'suspended');

-- Enrollment status enum
CREATE TYPE enrollment_status_enum AS ENUM ('enrolled', 'pending', 'withdrawn', 'completed');

-- Document type enum
CREATE TYPE student_document_type_enum AS ENUM (
  'birth_certificate',
  'id_card',
  'passport',
  'medical_certificate',
  'transcript',
  'diploma',
  'photo',
  'other'
);

-- ============================================
-- TABLE: STUDENTS
-- ============================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  matricule VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender gender_enum,
  place_of_birth VARCHAR(200),
  nationality VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  photo_url TEXT,
  status student_status_enum DEFAULT 'active',
  medical_info JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE students IS 'Students/pupils enrolled in the school';
COMMENT ON COLUMN students.matricule IS 'Unique student identifier (auto-generated per school)';
COMMENT ON COLUMN students.user_id IS 'Optional link to auth.users for student portal access';
COMMENT ON COLUMN students.photo_url IS 'URL to student photo in Supabase Storage';
COMMENT ON COLUMN students.medical_info IS 'Medical information (allergies, conditions, emergency contacts)';

-- Constraints
ALTER TABLE students ADD CONSTRAINT students_matricule_school_unique UNIQUE (school_id, matricule);
-- Note: UNIQUE WHERE not supported in ALTER TABLE, using partial index instead
CREATE UNIQUE INDEX students_email_school_unique ON students(school_id, email) WHERE email IS NOT NULL;
ALTER TABLE students ADD CONSTRAINT students_dob_valid CHECK (date_of_birth <= CURRENT_DATE);

-- Indexes
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_user_id ON students(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_students_matricule ON students(matricule);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_name ON students(last_name, first_name);

-- Trigger for updated_at
CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: PARENTS
-- ============================================

CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  occupation VARCHAR(100),
  workplace VARCHAR(200),
  is_primary_contact BOOLEAN DEFAULT false,
  is_emergency_contact BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE parents IS 'Parents/guardians of students';
COMMENT ON COLUMN parents.user_id IS 'Link to auth.users for parent portal access';
COMMENT ON COLUMN parents.relationship IS 'Relationship to student (father, mother, guardian, tutor, etc.)';
COMMENT ON COLUMN parents.is_primary_contact IS 'Whether this is the primary contact for the student';
COMMENT ON COLUMN parents.is_emergency_contact IS 'Whether this parent can be contacted in emergencies';

-- Constraints
-- Note: UNIQUE WHERE not supported in ALTER TABLE, using partial index instead
CREATE UNIQUE INDEX parents_email_school_unique ON parents(school_id, email) WHERE email IS NOT NULL;

-- Indexes
CREATE INDEX idx_parents_school_id ON parents(school_id);
CREATE INDEX idx_parents_user_id ON parents(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_parents_phone ON parents(phone);
CREATE INDEX idx_parents_email ON parents(email) WHERE email IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER parents_updated_at
  BEFORE UPDATE ON parents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: STUDENT_PARENT_RELATIONS
-- ============================================

CREATE TABLE student_parent_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  relationship VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  can_pickup BOOLEAN DEFAULT true,
  can_view_grades BOOLEAN DEFAULT true,
  can_view_attendance BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE student_parent_relations IS 'Many-to-many relationship between students and parents';
COMMENT ON COLUMN student_parent_relations.is_primary IS 'Whether this is the primary parent/guardian for the student';
COMMENT ON COLUMN student_parent_relations.can_pickup IS 'Whether this parent is authorized to pick up the student';

-- Constraints
ALTER TABLE student_parent_relations ADD CONSTRAINT student_parent_unique UNIQUE (school_id, student_id, parent_id);

-- Indexes
CREATE INDEX idx_student_parent_relations_school_id ON student_parent_relations(school_id);
CREATE INDEX idx_student_parent_relations_student_id ON student_parent_relations(student_id);
CREATE INDEX idx_student_parent_relations_parent_id ON student_parent_relations(parent_id);

-- ============================================
-- TABLE: ENROLLMENTS
-- ============================================

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status enrollment_status_enum DEFAULT 'enrolled',
  withdrawal_date DATE,
  withdrawal_reason TEXT,
  is_repeating BOOLEAN DEFAULT false,
  previous_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE enrollments IS 'Student enrollments in classes for specific academic years';
COMMENT ON COLUMN enrollments.is_repeating IS 'Whether the student is repeating this class (redoublement)';
COMMENT ON COLUMN enrollments.previous_class_id IS 'Previous class if student is repeating or transferred';

-- Constraints
ALTER TABLE enrollments ADD CONSTRAINT enrollments_student_year_unique UNIQUE (school_id, student_id, academic_year_id);
ALTER TABLE enrollments ADD CONSTRAINT enrollments_withdrawal_date_check CHECK (
  (status = 'withdrawn' AND withdrawal_date IS NOT NULL) OR
  (status != 'withdrawn' AND withdrawal_date IS NULL)
);

-- Indexes
CREATE INDEX idx_enrollments_school_id ON enrollments(school_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON enrollments(class_id);
CREATE INDEX idx_enrollments_academic_year_id ON enrollments(academic_year_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);

-- Trigger for updated_at
CREATE TRIGGER enrollments_updated_at
  BEFORE UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: STUDENT_DOCUMENTS
-- ============================================

CREATE TABLE student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type student_document_type_enum NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE student_documents IS 'Documents uploaded for students (certificates, transcripts, etc.)';
COMMENT ON COLUMN student_documents.file_url IS 'URL to document in Supabase Storage';
COMMENT ON COLUMN student_documents.uploaded_by IS 'User who uploaded the document';

-- Indexes
CREATE INDEX idx_student_documents_school_id ON student_documents(school_id);
CREATE INDEX idx_student_documents_student_id ON student_documents(student_id);
CREATE INDEX idx_student_documents_document_type ON student_documents(document_type);
CREATE INDEX idx_student_documents_uploaded_at ON student_documents(uploaded_at DESC);

-- ============================================
-- MATRICULE GENERATION FUNCTION
-- ============================================

-- Function to generate unique student matricule
CREATE OR REPLACE FUNCTION generate_student_matricule(p_school_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_year VARCHAR(4);
  v_sequence INTEGER;
  v_matricule VARCHAR(50);
  v_school_code VARCHAR(20);
BEGIN
  -- Get current academic year (last 2 digits)
  v_year := TO_CHAR(CURRENT_DATE, 'YY');

  -- Get school code
  SELECT code INTO v_school_code FROM schools WHERE id = p_school_id;

  -- Handle missing school code
  IF v_school_code IS NULL OR v_school_code = '' THEN
    v_school_code := 'SCH';
  END IF;

  -- Get next sequence number for this school and year
  -- Extract only the trailing sequence after the dash
  SELECT COALESCE(MAX(CAST(SPLIT_PART(matricule, '-', 2) AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM students
  WHERE school_id = p_school_id
  AND matricule LIKE v_school_code || v_year || '-%';

  -- Format: SCHOOLCODE + YY + 4-digit sequence (e.g., ABC24-0001)
  v_matricule := v_school_code || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');

  RETURN v_matricule;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_student_matricule(UUID) IS 'Generates unique student matricule: SCHOOLCODE + YY + sequence (e.g., ABC24-0001)';

-- Trigger to auto-generate matricule on insert if not provided
CREATE OR REPLACE FUNCTION auto_generate_student_matricule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.matricule IS NULL OR NEW.matricule = '' THEN
    NEW.matricule := generate_student_matricule(NEW.school_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER students_auto_matricule
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_student_matricule();
