-- Migration: School Configuration Tables
-- Description: Creates tables for academic years, levels, classes, subjects, periods, grading scales, campuses, rooms, and teacher assignments
-- Created: 2025-01-17

-- ============================================
-- ENUMS
-- ============================================

-- Level type enum for different educational levels
CREATE TYPE level_type_enum AS ENUM ('primary', 'middle_school', 'high_school', 'university');

COMMENT ON TYPE level_type_enum IS 'Educational level types: primary school, middle school, high school, university';

-- Period type enum for different academic period structures
CREATE TYPE period_type_enum AS ENUM ('trimester', 'semester', 'composition', 'exam');

COMMENT ON TYPE period_type_enum IS 'Academic period types: trimester (3 terms), semester (2 terms), composition (exam periods), exam (individual exams)';

-- Room type enum for different room types
CREATE TYPE room_type_enum AS ENUM ('classroom', 'lab', 'amphitheater', 'library', 'gym', 'other');

COMMENT ON TYPE room_type_enum IS 'Room types: standard classroom, laboratory, amphitheater/lecture hall, library, gymnasium, other';

-- ============================================
-- ACADEMIC YEARS
-- ============================================

CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "2024-2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE academic_years IS 'Academic years for a school. Each school can have multiple years (past, current, future). Only one year per school should be is_current=true.';

COMMENT ON COLUMN academic_years.name IS 'Display name for the academic year (e.g., "2024-2025", "2025-2026")';
COMMENT ON COLUMN academic_years.is_current IS 'Flag indicating if this is the currently active academic year. Only one year per school should have this flag set to true.';

-- Constraints
ALTER TABLE academic_years ADD CONSTRAINT academic_years_name_school_unique UNIQUE (school_id, name);
ALTER TABLE academic_years ADD CONSTRAINT academic_years_end_after_start CHECK (end_date > start_date);

-- Indexes
CREATE INDEX idx_academic_years_school_id ON academic_years(school_id);
CREATE INDEX idx_academic_years_is_current ON academic_years(is_current) WHERE is_current = true;
CREATE INDEX idx_academic_years_dates ON academic_years(start_date, end_date);

-- Trigger for updated_at
CREATE TRIGGER academic_years_updated_at
  BEFORE UPDATE ON academic_years
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- LEVELS
-- ============================================

CREATE TABLE levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Primaire", "6ème", "Terminale S", "Licence 1"
  code VARCHAR(20) NOT NULL, -- e.g., "PRIMARY", "6EME", "TERM_S", "L1"
  level_type level_type_enum NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE levels IS 'Educational levels within a school (e.g., grade levels, years). Used to organize classes and subjects.';

COMMENT ON COLUMN levels.name IS 'Human-readable name of the level (e.g., "6ème", "Terminale S", "Licence 1")';
COMMENT ON COLUMN levels.code IS 'Short code for the level, used in references and exports';
COMMENT ON COLUMN levels.level_type IS 'Type of educational level (primary, middle school, high school, university)';
COMMENT ON COLUMN levels.order_index IS 'Order for sorting levels (e.g., 1 for CP, 2 for CE1, etc.)';

-- Constraints
ALTER TABLE levels ADD CONSTRAINT levels_code_school_unique UNIQUE (school_id, code);

-- Indexes
CREATE INDEX idx_levels_school_id ON levels(school_id);
CREATE INDEX idx_levels_level_type ON levels(level_type);
CREATE INDEX idx_levels_order ON levels(order_index);

-- Trigger for updated_at
CREATE TRIGGER levels_updated_at
  BEFORE UPDATE ON levels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CAMPUSES
-- ============================================

CREATE TABLE campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  radius_meters INTEGER DEFAULT 200, -- For geolocation/check-in
  is_main BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE campuses IS 'Campuses or locations belonging to a school. A school can have multiple campuses.';

COMMENT ON COLUMN campuses.name IS 'Name of the campus (e.g., "Campus Principal", "Annexe Nord")';
COMMENT ON COLUMN campuses.code IS 'Short code for the campus (e.g., "MAIN", "NORTH")';
COMMENT ON COLUMN campuses.latitude IS 'Latitude coordinate for geolocation';
COMMENT ON COLUMN campuses.longitude IS 'Longitude coordinate for geolocation';
COMMENT ON COLUMN campuses.radius_meters IS 'Radius in meters for geolocation-based check-in features';
COMMENT ON COLUMN campuses.is_main IS 'Whether this is the main campus. Only one campus per school should have this flag set to true.';

-- Constraints
ALTER TABLE campuses ADD CONSTRAINT campuses_code_school_unique UNIQUE (school_id, code);
ALTER TABLE campuses ADD CONSTRAINT campuses_latitude_valid CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
ALTER TABLE campuses ADD CONSTRAINT campuses_longitude_valid CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
ALTER TABLE campuses ADD CONSTRAINT campuses_radius_positive CHECK (radius_meters > 0);

-- Indexes
CREATE INDEX idx_campuses_school_id ON campuses(school_id);
CREATE INDEX idx_campuses_is_main ON campuses(is_main) WHERE is_main = true;
CREATE INDEX idx_campuses_location ON campuses(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER campuses_updated_at
  BEFORE UPDATE ON campuses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROOMS
-- ============================================

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Salle 101", "Labo Physique", "Amphi A"
  code VARCHAR(20) NOT NULL, -- e.g., "101", "LABPHY", "AMPHIA"
  capacity INTEGER,
  room_type room_type_enum DEFAULT 'classroom',
  equipment JSONB DEFAULT '{}'::jsonb, -- e.g., {"projector": true, "computers": 20, "chemistry_hood": true}
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE rooms IS 'Rooms within a campus (classrooms, labs, amphitheaters, etc.).';

COMMENT ON COLUMN rooms.name IS 'Full name of the room (e.g., "Salle 101", "Laboratoire de Physique", "Amphithéâtre A")';
COMMENT ON COLUMN rooms.code IS 'Short code for the room (e.g., "101", "LABPHY", "AMPHIA")';
COMMENT ON COLUMN rooms.capacity IS 'Maximum number of people this room can accommodate';
COMMENT ON COLUMN rooms.room_type IS 'Type of room (classroom, lab, amphitheater, library, gym, other)';
COMMENT ON COLUMN rooms.equipment IS 'JSON object describing available equipment (e.g., {"projector": true, "computers": 20, "smart_board": true})';
COMMENT ON COLUMN rooms.is_available IS 'Whether this room is currently available for scheduling (temporarily unavailable if under renovation, etc.)';

-- Constraints
ALTER TABLE rooms ADD CONSTRAINT rooms_code_campus_unique UNIQUE (school_id, campus_id, code);
ALTER TABLE rooms ADD CONSTRAINT rooms_capacity_positive CHECK (capacity IS NULL OR capacity > 0);

-- Indexes
CREATE INDEX idx_rooms_school_id ON rooms(school_id);
CREATE INDEX idx_rooms_campus_id ON rooms(campus_id);
CREATE INDEX idx_rooms_room_type ON rooms(room_type);
CREATE INDEX idx_rooms_is_available ON rooms(is_available) WHERE is_available = true;

-- Trigger for updated_at
CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLASSES
-- ============================================

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "6ème A", "Terminale S 1"
  code VARCHAR(20) NOT NULL, -- e.g., "6EMEA", "TS1"
  capacity INTEGER,
  homeroom_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE classes IS 'Classes (groups of students) within a school for a specific academic year. Each class is linked to a level and can have a homeroom teacher and assigned room.';

COMMENT ON COLUMN classes.name IS 'Display name for the class (e.g., "6ème A", "Terminale S 1")';
COMMENT ON COLUMN classes.capacity IS 'Maximum number of students that can be enrolled in this class';
COMMENT ON COLUMN classes.homeroom_teacher_id IS 'ID of the homeroom teacher (professeur principal) for this class';
COMMENT ON COLUMN classes.room_id IS 'Default room where this class is held';
COMMENT ON COLUMN classes.metadata IS 'Additional information stored as JSON (e.g., special programs, double streaming, etc.)';

-- Constraints
ALTER TABLE classes ADD CONSTRAINT classes_code_school_year_unique UNIQUE (school_id, academic_year_id, code);
ALTER TABLE classes ADD CONSTRAINT classes_capacity_positive CHECK (capacity IS NULL OR capacity > 0);

-- Indexes
CREATE INDEX idx_classes_school_id ON classes(school_id);
CREATE INDEX idx_classes_level_id ON classes(level_id);
CREATE INDEX idx_classes_academic_year_id ON classes(academic_year_id);
CREATE INDEX idx_classes_homeroom_teacher_id ON classes(homeroom_teacher_id) WHERE homeroom_teacher_id IS NOT NULL;
CREATE INDEX idx_classes_room_id ON classes(room_id) WHERE room_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SUBJECTS
-- ============================================

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Mathématiques", "Français", "Histoire-Géographie"
  code VARCHAR(20) NOT NULL, -- e.g., "MATHS", "FRA", "HG"
  description TEXT,
  level_id UUID REFERENCES levels(id) ON DELETE CASCADE, -- NULL if subject applies to all levels
  coefficient DECIMAL(3,2) DEFAULT 1.00, -- For GPA calculation
  color VARCHAR(7), -- Hex color for UI (e.g., "#3b82f6")
  icon VARCHAR(50), -- Icon name for UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE subjects IS 'Subjects taught in the school (e.g., Mathematics, French, History). Can be specific to a level or apply to all levels.';

COMMENT ON COLUMN subjects.name IS 'Full name of the subject (e.g., "Mathématiques", "Français")';
COMMENT ON COLUMN subjects.code IS 'Short code for the subject (e.g., "MATHS", "FRA", "HG")';
COMMENT ON COLUMN subjects.level_id IS 'Level this subject is specific to (NULL if subject applies to all levels)';
COMMENT ON COLUMN subjects.coefficient IS 'Weight of this subject for GPA calculation (default: 1.0)';
COMMENT ON COLUMN subjects.color IS 'Hex color code for UI display (e.g., "#3b82f6" for blue)';
COMMENT ON COLUMN subjects.icon IS 'Icon name or emoji for UI display (e.g., "📐", "calculator")';
COMMENT ON COLUMN subjects.is_active IS 'Whether this subject is currently active (soft delete)';

-- Constraints
ALTER TABLE subjects ADD CONSTRAINT subjects_code_school_unique UNIQUE (school_id, code);
ALTER TABLE subjects ADD CONSTRAINT subjects_coefficient_positive CHECK (coefficient > 0);

-- Indexes
CREATE INDEX idx_subjects_school_id ON subjects(school_id);
CREATE INDEX idx_subjects_level_id ON subjects(level_id) WHERE level_id IS NOT NULL;
CREATE INDEX idx_subjects_is_active ON subjects(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PERIODS
-- ============================================

CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- e.g., "Trimestre 1", "Semestre 2", "Composition 1"
  period_type period_type_enum NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  weight DECIMAL(3,2) DEFAULT 1.00, -- Weight for final grade calculation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE periods IS 'Academic periods (trimesters, semesters, exam periods) within an academic year. Used for grade calculation and reporting.';

COMMENT ON COLUMN periods.name IS 'Display name for the period (e.g., "Trimestre 1", "Semestre 2", "Composition 1")';
COMMENT ON COLUMN periods.period_type IS 'Type of period (trimester, semester, composition, exam)';
COMMENT ON COLUMN periods.weight IS 'Weight of this period for final grade calculation (e.g., trimesters might have weight 1.0, final exam might have weight 2.0)';

-- Constraints
ALTER TABLE periods ADD CONSTRAINT periods_name_school_year_unique UNIQUE (school_id, academic_year_id, name);
ALTER TABLE periods ADD CONSTRAINT periods_end_after_start CHECK (end_date > start_date);
ALTER TABLE periods ADD CONSTRAINT periods_weight_positive CHECK (weight > 0);

-- Indexes
CREATE INDEX idx_periods_school_id ON periods(school_id);
CREATE INDEX idx_periods_academic_year_id ON periods(academic_year_id);
CREATE INDEX idx_periods_period_type ON periods(period_type);
CREATE INDEX idx_periods_dates ON periods(start_date, end_date);

-- Trigger for updated_at
CREATE TRIGGER periods_updated_at
  BEFORE UPDATE ON periods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRADING SCALES
-- ============================================

CREATE TABLE grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  min_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  max_score DECIMAL(5,2) NOT NULL DEFAULT 20,
  passing_score DECIMAL(5,2) NOT NULL DEFAULT 10,
  scale_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE grading_scales IS 'Grading scales used by the school. Defines score ranges, passing thresholds, and honor/mention levels.';

COMMENT ON COLUMN grading_scales.name IS 'Name of the grading scale (e.g., "Standard 0-20", "Primary School Scale")';
COMMENT ON COLUMN grading_scales.min_score IS 'Minimum possible score (typically 0)';
COMMENT ON COLUMN grading_scales.max_score IS 'Maximum possible score (typically 20 in French system)';
COMMENT ON COLUMN grading_scales.passing_score IS 'Minimum score to pass (typically 10 in French system)';
COMMENT ON COLUMN grading_scales.scale_config IS 'JSON configuration for mentions, thresholds, colors (e.g., mentions array with min/max/label/color)';
COMMENT ON COLUMN grading_scales.is_default IS 'Whether this is the default grading scale for the school. Only one scale per school should be is_default=true.';

-- Constraints
ALTER TABLE grading_scales ADD CONSTRAINT grading_scales_passing_between_min_max CHECK (passing_score >= min_score AND passing_score <= max_score);
ALTER TABLE grading_scales ADD CONSTRAINT grading_scales_max_greater_than_min CHECK (max_score > min_score);

-- Indexes
CREATE INDEX idx_grading_scales_school_id ON grading_scales(school_id);
CREATE INDEX idx_grading_scales_is_default ON grading_scales(is_default) WHERE is_default = true;

-- Trigger for updated_at
CREATE TRIGGER grading_scales_updated_at
  BEFORE UPDATE ON grading_scales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TEACHER ASSIGNMENTS
-- ============================================

CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false, -- Primary teacher for this subject in this class
  hourly_rate DECIMAL(10,2), -- For payroll calculation (NULL if salaried)
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE teacher_assignments is 'Assignments of teachers to classes and subjects for a specific academic year. Defines which teacher teaches what subject to which class.';

COMMENT ON COLUMN teacher_assignments.teacher_id IS 'ID of the teacher (user with role "teacher")';
COMMENT ON COLUMN teacher_assignments.class_id IS 'ID of the class being taught';
COMMENT ON COLUMN teacher_assignments.subject_id IS 'ID of the subject being taught';
COMMENT ON COLUMN teacher_assignments.is_primary IS 'Whether this is the primary teacher for this subject in this class (used if multiple teachers share a subject)';
COMMENT ON COLUMN teacher_assignments.hourly_rate IS 'Hourly rate for payroll (only if teacher is paid hourly). NULL for salaried teachers.';
COMMENT ON COLUMN teacher_assignments.assigned_at IS 'Timestamp when this assignment was created';

-- Constraints
ALTER TABLE teacher_assignments ADD CONSTRAINT teacher_assignments_unique UNIQUE (school_id, teacher_id, class_id, subject_id, academic_year_id);
ALTER TABLE teacher_assignments ADD CONSTRAINT teacher_assignments_hourly_rate_positive CHECK (hourly_rate IS NULL OR hourly_rate > 0);

-- Note: Teacher role validation is done via trigger function in school_config_audit_triggers migration

-- Indexes
CREATE INDEX idx_teacher_assignments_school_id ON teacher_assignments(school_id);
CREATE INDEX idx_teacher_assignments_teacher_id ON teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_class_id ON teacher_assignments(class_id);
CREATE INDEX idx_teacher_assignments_subject_id ON teacher_assignments(subject_id);
CREATE INDEX idx_teacher_assignments_academic_year_id ON teacher_assignments(academic_year_id);
CREATE INDEX idx_teacher_assignments_assigned_at ON teacher_assignments(assigned_at);

-- Trigger for updated_at
CREATE TRIGGER teacher_assignments_updated_at
  BEFORE UPDATE ON teacher_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- END OF MIGRATION
-- ============================================
