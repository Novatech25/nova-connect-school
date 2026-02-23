-- Migration 0003: add parents, student_parent_relations, payment_exemptions

CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  user_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  occupation TEXT,
  workplace TEXT,
  is_primary_contact INTEGER DEFAULT 0,
  is_emergency_contact INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parents_email_school_unique
  ON parents(school_id, email)
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parents_school_id ON parents(school_id);
CREATE INDEX IF NOT EXISTS idx_parents_user_id ON parents(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_phone ON parents(phone);

CREATE TABLE IF NOT EXISTS student_parent_relations (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  relationship TEXT,
  is_primary INTEGER DEFAULT 0,
  can_pickup INTEGER DEFAULT 1,
  can_view_grades INTEGER DEFAULT 1,
  can_view_attendance INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (parent_id) REFERENCES parents(id),
  UNIQUE (school_id, student_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_student_parent_relations_school_id
  ON student_parent_relations(school_id);
CREATE INDEX IF NOT EXISTS idx_student_parent_relations_student_id
  ON student_parent_relations(student_id);
CREATE INDEX IF NOT EXISTS idx_student_parent_relations_parent_id
  ON student_parent_relations(parent_id);

CREATE TABLE IF NOT EXISTS payment_exemptions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  exemption_type TEXT NOT NULL,
  amount REAL,
  percentage REAL,
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TEXT DEFAULT (datetime('now')),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  applies_to_fee_types TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  CHECK (exemption_type IN ('scholarship', 'discount', 'exemption', 'other')),
  CHECK (amount IS NULL OR amount >= 0),
  CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  CHECK (amount IS NOT NULL OR percentage IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_payment_exemptions_school_id
  ON payment_exemptions(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_exemptions_student_id
  ON payment_exemptions(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_exemptions_exemption_type
  ON payment_exemptions(exemption_type);
CREATE INDEX IF NOT EXISTS idx_payment_exemptions_is_active
  ON payment_exemptions(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_exemptions_valid_from
  ON payment_exemptions(valid_from);
CREATE INDEX IF NOT EXISTS idx_payment_exemptions_valid_until
  ON payment_exemptions(valid_until);
