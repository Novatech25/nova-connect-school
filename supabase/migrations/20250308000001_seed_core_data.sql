-- ============================================================================
-- SEED DATA FOR NOVACONNECT
-- ============================================================================

-- Disable triggers during seed
SET session_replication_role = 'replica';

-- ============================================================================
-- INSERT SYSTEM ROLES
-- ============================================================================

INSERT INTO roles (id, name, description, is_system) VALUES
  (gen_random_uuid(), 'super_admin', 'Full platform administration access', true),
  (gen_random_uuid(), 'school_admin', 'Full school administration access', true),
  (gen_random_uuid(), 'accountant', 'Financial management and payments', true),
  (gen_random_uuid(), 'teacher', 'Teaching, grades, and attendance management', true),
  (gen_random_uuid(), 'student', 'Student view and self-consultation', true),
  (gen_random_uuid(), 'parent', 'Parent view for children data', true),
  (gen_random_uuid(), 'supervisor', 'Supervision and validation of academic data', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- INSERT PERMISSIONS
-- ============================================================================

-- Schools management
INSERT INTO permissions (resource, action, description) VALUES
  ('schools', 'create', 'Create new schools'),
  ('schools', 'read', 'View school information'),
  ('schools', 'update', 'Update school details'),
  ('schools', 'delete', 'Delete schools')
ON CONFLICT (resource, action) DO NOTHING;

-- Users management
INSERT INTO permissions (resource, action, description) VALUES
  ('users', 'create', 'Create new users'),
  ('users', 'read', 'View user information'),
  ('users', 'update', 'Update user details'),
  ('users', 'delete', 'Delete users')
ON CONFLICT (resource, action) DO NOTHING;

-- Students management
INSERT INTO permissions (resource, action, description) VALUES
  ('students', 'create', 'Create new students'),
  ('students', 'read', 'View student information'),
  ('students', 'update', 'Update student details'),
  ('students', 'delete', 'Delete students')
ON CONFLICT (resource, action) DO NOTHING;

-- Grades management
INSERT INTO permissions (resource, action, description) VALUES
  ('grades', 'create', 'Create new grades'),
  ('grades', 'read', 'View grades'),
  ('grades', 'update', 'Update grades'),
  ('grades', 'delete', 'Delete grades'),
  ('grades', 'validate', 'Validate and lock grades')
ON CONFLICT (resource, action) DO NOTHING;

-- Attendance management
INSERT INTO permissions (resource, action, description) VALUES
  ('attendance', 'create', 'Create attendance records'),
  ('attendance', 'read', 'View attendance'),
  ('attendance', 'update', 'Update attendance'),
  ('attendance', 'delete', 'Delete attendance'),
  ('attendance', 'validate', 'Validate attendance records')
ON CONFLICT (resource, action) DO NOTHING;

-- Payments management
INSERT INTO permissions (resource, action, description) VALUES
  ('payments', 'create', 'Create payment records'),
  ('payments', 'read', 'View payment information'),
  ('payments', 'update', 'Update payment details'),
  ('payments', 'delete', 'Delete payment records')
ON CONFLICT (resource, action) DO NOTHING;

-- Schedules management
INSERT INTO permissions (resource, action, description) VALUES
  ('schedules', 'create', 'Create class schedules'),
  ('schedules', 'read', 'View schedules'),
  ('schedules', 'update', 'Update schedules'),
  ('schedules', 'delete', 'Delete schedules'),
  ('schedules', 'publish', 'Publish schedules to students')
ON CONFLICT (resource, action) DO NOTHING;

-- Reports
INSERT INTO permissions (resource, action, description) VALUES
  ('reports', 'read', 'View reports'),
  ('reports', 'export', 'Export data to CSV/PDF')
ON CONFLICT (resource, action) DO NOTHING;

-- Audit logs
INSERT INTO permissions (resource, action, description) VALUES
  ('audit_logs', 'read', 'View audit logs')
ON CONFLICT (resource, action) DO NOTHING;

-- Classes management
INSERT INTO permissions (resource, action, description) VALUES
  ('classes', 'create', 'Create new classes'),
  ('classes', 'read', 'View class information'),
  ('classes', 'update', 'Update class details'),
  ('classes', 'delete', 'Delete classes')
ON CONFLICT (resource, action) DO NOTHING;

-- Subjects management
INSERT INTO permissions (resource, action, description) VALUES
  ('subjects', 'create', 'Create new subjects'),
  ('subjects', 'read', 'View subject information'),
  ('subjects', 'update', 'Update subject details'),
  ('subjects', 'delete', 'Delete subjects')
ON CONFLICT (resource, action) DO NOTHING;

-- Roles and Permissions management
INSERT INTO permissions (resource, action, description) VALUES
  ('roles', 'create', 'Create new roles'),
  ('roles', 'read', 'View role information'),
  ('roles', 'update', 'Update role details'),
  ('roles', 'delete', 'Delete roles'),
  ('permissions', 'assign', 'Assign permissions to roles')
ON CONFLICT (resource, action) DO NOTHING;

-- ============================================================================
-- ASSIGN PERMISSIONS TO ROLES
-- ============================================================================

-- Get role IDs
DO $$
DECLARE
  super_admin_id UUID;
  school_admin_id UUID;
  accountant_id UUID;
  teacher_id UUID;
  student_id UUID;
  parent_id UUID;
  supervisor_id UUID;
BEGIN
  SELECT id INTO super_admin_id FROM roles WHERE name = 'super_admin';
  SELECT id INTO school_admin_id FROM roles WHERE name = 'school_admin';
  SELECT id INTO accountant_id FROM roles WHERE name = 'accountant';
  SELECT id INTO teacher_id FROM roles WHERE name = 'teacher';
  SELECT id INTO student_id FROM roles WHERE name = 'student';
  SELECT id INTO parent_id FROM roles WHERE name = 'parent';
  SELECT id INTO supervisor_id FROM roles WHERE name = 'supervisor';

  -- SUPER_ADMIN: All permissions
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT super_admin_id, id FROM permissions
  ON CONFLICT DO NOTHING;

  -- SCHOOL_ADMIN: All except platform-level operations
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT school_admin_id, id FROM permissions
    WHERE resource NOT IN ('roles')
  ON CONFLICT DO NOTHING;

  -- ACCOUNTANT: Payments and reports only
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT accountant_id, id FROM permissions
    WHERE resource IN ('payments', 'reports', 'users') AND action IN ('read', 'create', 'update', 'read', 'export')
  ON CONFLICT DO NOTHING;

  -- TEACHER: Grades, attendance, schedules, and student information
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT teacher_id, id FROM permissions
    WHERE resource IN ('grades', 'attendance', 'students', 'classes', 'subjects', 'schedules')
       AND action IN ('create', 'read', 'update')
       OR (resource = 'schedules' AND action = 'read')
       OR (resource = 'students' AND action = 'read')
  ON CONFLICT DO NOTHING;

  -- STUDENT: Read own data
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT student_id, id FROM permissions
    WHERE (resource IN ('grades', 'attendance', 'schedules', 'classes') AND action = 'read')
       OR (resource IN ('payments', 'students') AND action = 'read')
  ON CONFLICT DO NOTHING;

  -- PARENT: Read children data
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT parent_id, id FROM permissions
    WHERE (resource IN ('grades', 'attendance', 'schedules', 'classes') AND action = 'read')
       OR (resource IN ('payments', 'students') AND action = 'read')
  ON CONFLICT DO NOTHING;

  -- SUPERVISOR: Validation and read access
  INSERT INTO role_permissions (role_id, permission_id)
    SELECT supervisor_id, id FROM permissions
    WHERE (resource IN ('grades', 'attendance') AND action IN ('read', 'validate'))
       OR resource IN ('students', 'classes', 'schedules', 'reports') AND action = 'read'
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================================
-- INSERT SAMPLE SCHOOL (for testing)
-- ============================================================================

INSERT INTO schools (
  id,
  name,
  code,
  address,
  city,
  country,
  phone,
  email,
  website,
  status,
  subscription_plan,
  max_students,
  max_teachers,
  max_classes,
  enabled_modules,
  settings
) VALUES (
  'c9c9a7f3-1234-5678-9abc-def123456789',
  'École Exemple Nouakchott',
  'NOUAK-001',
  '123 Avenue de l''Indépendance',
  'Nouakchott',
  'Mauritanie',
  '+222 45 00 00 00',
  'contact@ecole-exemple.mr',
  'https://ecole-exemple.mr',
  'active',
  'premium',
  500,
  50,
  20,
  '["qr_attendance", "mobile_money", "exam_mode", "multi_campus", "api_export"]'::jsonb,
  '{
    "academic_year": "2024-2025",
    "currency": "MRU",
    "timezone": "Africa/Nouakchott",
    "language": "fr"
  }'::jsonb
) ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- INSERT SAMPLE USER (super admin - no school)
-- ============================================================================

-- Note: This requires that the auth user be created first via Supabase Auth
-- This is just a placeholder to show the structure
-- The actual user must be created via Supabase Auth UI or API

-- Example:
-- INSERT INTO users (id, email, first_name, last_name, school_id, is_active)
-- VALUES (
--   'super-admin-uuid-from-auth',
--   'admin@novaconnect.local',
--   'Super',
--   'Admin',
--   NULL, -- No school for super_admin
--   true
-- );

-- ============================================================================
-- RE-ENABLE TRIGGERS
-- ============================================================================

SET session_replication_role = 'origin';

-- ============================================================================
-- SEED COMPLETE
-- ============================================================================

-- After seeding, you should:
-- 1. Create a super admin user via Supabase Auth UI
-- 2. Update the user's profile in the users table
-- 3. Assign the super_admin role to the user in user_roles table
-- 4. Create test schools and users for development


-- ============================================================================
-- INSERT TEST SCHOOL (for seed-school-config)
-- ============================================================================

INSERT INTO schools (name, code, city, country, status)
VALUES ('Test School Nouakchott', 'TEST-SCHOOL', 'Nouakchott', 'Mauritanie', 'active')
ON CONFLICT (code) DO NOTHING;

