-- Migration 0004: align students columns and add enrollments table

ALTER TABLE students ADD COLUMN matricule TEXT;
ALTER TABLE students ADD COLUMN gender TEXT;
ALTER TABLE students ADD COLUMN place_of_birth TEXT;
ALTER TABLE students ADD COLUMN nationality TEXT;
ALTER TABLE students ADD COLUMN address TEXT;
ALTER TABLE students ADD COLUMN city TEXT;
ALTER TABLE students ADD COLUMN phone TEXT;
ALTER TABLE students ADD COLUMN email TEXT;
ALTER TABLE students ADD COLUMN photo_url TEXT;
ALTER TABLE students ADD COLUMN status TEXT;
ALTER TABLE students ADD COLUMN medical_info TEXT;

CREATE INDEX IF NOT EXISTS idx_students_matricule ON students(matricule);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  academic_year_id TEXT NOT NULL,
  enrollment_date TEXT NOT NULL,
  status TEXT DEFAULT 'enrolled',
  withdrawal_date TEXT,
  withdrawal_reason TEXT,
  is_repeating INTEGER DEFAULT 0,
  previous_class_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_school_id ON enrollments(school_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_id ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_academic_year_id ON enrollments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
