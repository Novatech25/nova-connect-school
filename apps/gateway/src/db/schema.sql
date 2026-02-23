-- NovaConnect Gateway SQLite Schema
-- Mirror of critical Supabase tables with local adaptations

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  settings TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  user_id TEXT,
  student_number TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  class_id TEXT,
  date_of_birth TEXT,
  enrollment_date TEXT,
  is_active INTEGER DEFAULT 1,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Attendance sessions
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  planned_session_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  session_date TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  submitted_at TEXT,
  validated_at TEXT,
  validated_by TEXT,
  notes TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  attendance_session_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT DEFAULT 'teacher_manual',
  record_status TEXT DEFAULT 'confirmed',
  justification TEXT,
  comment TEXT,
  marked_by TEXT NOT NULL,
  marked_at TEXT DEFAULT (datetime('now')),
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (marked_by) REFERENCES users(id)
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  grade_type TEXT NOT NULL,
  value REAL NOT NULL,
  max_value REAL NOT NULL,
  coefficient REAL DEFAULT 1.0,
  grading_date TEXT NOT NULL,
  comments TEXT,
  status TEXT DEFAULT 'draft',
  published_at TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Lesson logs (cahier de texte)
CREATE TABLE IF NOT EXISTS lesson_logs (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  lesson_date TEXT NOT NULL,
  planned_session_id TEXT,
  content TEXT NOT NULL,
  homework TEXT,
  attachments TEXT,
  status TEXT DEFAULT 'draft',
  validated_at TEXT,
  validated_by TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_date TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  reference TEXT,
  receipt_number TEXT,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Schedule (EDT)
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  room_id TEXT,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  semester TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Event log for synchronization
CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT,
  sync_status TEXT DEFAULT 'pending',
  sync_error TEXT,
  retry_count INTEGER DEFAULT 0,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_data TEXT,
  new_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Gateway license
CREATE TABLE IF NOT EXISTS gateway_license (
  id INTEGER PRIMARY KEY,
  license_key TEXT NOT NULL,
  school_id TEXT NOT NULL,
  hardware_fingerprint TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_validated_at TEXT,
  status TEXT DEFAULT 'active',
  metadata TEXT
);

-- Sync metadata
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Receipt sequences for sequential numbering
CREATE TABLE IF NOT EXISTS receipt_sequences (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('student_payment', 'teacher_salary')),
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  prefix TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(school_id, receipt_type, year),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Printer profiles for different formats
CREATE TABLE IF NOT EXISTS printer_profiles (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('A4_STANDARD', 'THERMAL_80', 'THERMAL_58')),
  is_default INTEGER DEFAULT 0,
  template_config TEXT DEFAULT '{}',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(school_id, profile_name),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);

-- Payment receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  pdf_url TEXT NOT NULL,
  pdf_size_bytes INTEGER NOT NULL,
  generated_by TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  receipt_data_hash TEXT,
  generated_at TEXT DEFAULT (datetime('now')),
  printer_profile_id TEXT,
  verification_token_id TEXT,
  auto_sent INTEGER DEFAULT 0,
  send_channels TEXT DEFAULT '[]',
  send_status TEXT DEFAULT '{}',
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (generated_by) REFERENCES users(id),
  FOREIGN KEY (printer_profile_id) REFERENCES printer_profiles(id)
);

-- Receipt verification tokens
CREATE TABLE IF NOT EXISTS receipt_verification_tokens (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  short_code TEXT UNIQUE,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  verified_by TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS receipt_verification_logs (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL,
  token_hash TEXT,
  verified_at TEXT DEFAULT (datetime('now')),
  success INTEGER NOT NULL DEFAULT 1,
  ip TEXT,
  user_agent TEXT,
  metadata TEXT DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_log_sync_status ON event_log(sync_status, created_at);
CREATE INDEX IF NOT EXISTS idx_event_log_school_id ON event_log(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(attendance_session_id);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_id ON attendance_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_school_id ON grades(school_id);
CREATE INDEX IF NOT EXISTS idx_lesson_logs_school_id ON lesson_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_school_id ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_schedules_school_id ON schedules(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_receipt_sequences_school_year ON receipt_sequences(school_id, year);
CREATE INDEX IF NOT EXISTS idx_printer_profiles_school ON printer_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_school ON payment_receipts(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment ON payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_hash ON receipt_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON receipt_verification_tokens(expires_at);
