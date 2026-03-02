-- =====================================================
-- Seed Data: Lesson Logs (Cahier de Texte)
-- Description: Test data for lesson logs system
-- =====================================================

-- Note: This file references IDs from seed.sql and seed-school-config.sql
-- Make sure those files have been run first

SET session_replication_role = 'replica';

-- =====================================================
-- ENSURE PLANNED SESSIONS (SCHEDULE SEED)
-- =====================================================

DO $$
DECLARE
  v_school_id UUID;
  v_academic_year_id UUID;
  v_schedule_id UUID;
  v_teacher_id UUID;
  v_class_id UUID;
  v_subject_id UUID;
  v_room_id UUID;
BEGIN
  SELECT id INTO v_school_id FROM schools WHERE code = 'TEST-SCHOOL' LIMIT 1;
  IF v_school_id IS NULL THEN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
  END IF;

  SELECT id INTO v_academic_year_id
  FROM academic_years
  WHERE school_id = v_school_id AND is_current = true
  LIMIT 1;

  SELECT ur.user_id INTO v_teacher_id
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'teacher' AND (ur.school_id = v_school_id OR ur.school_id IS NULL)
  LIMIT 1;

  SELECT id INTO v_class_id FROM classes WHERE school_id = v_school_id LIMIT 1;
  SELECT id INTO v_subject_id FROM subjects WHERE school_id = v_school_id LIMIT 1;
  SELECT id INTO v_room_id FROM rooms WHERE school_id = v_school_id LIMIT 1;

  IF v_school_id IS NULL OR v_academic_year_id IS NULL OR v_teacher_id IS NULL OR v_class_id IS NULL OR v_subject_id IS NULL THEN
    RAISE NOTICE 'Skipping planned_sessions seed due to missing data';
    RETURN;
  END IF;

  SELECT id INTO v_schedule_id
  FROM schedules
  WHERE school_id = v_school_id AND academic_year_id = v_academic_year_id AND version = 1
  LIMIT 1;

  IF v_schedule_id IS NULL THEN
    INSERT INTO schedules (school_id, academic_year_id, name, status, version, published_at, published_by)
    VALUES (v_school_id, v_academic_year_id, 'EDT Seed', 'published', 1, NOW(), v_teacher_id)
    RETURNING id INTO v_schedule_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM schedule_slots WHERE schedule_id = v_schedule_id LIMIT 1) THEN
    INSERT INTO schedule_slots (
      schedule_id,
      school_id,
      day_of_week,
      start_time,
      end_time,
      teacher_id,
      class_id,
      subject_id,
      room_id
    )
    VALUES (
      v_schedule_id,
      v_school_id,
      'monday',
      '08:00',
      '09:00',
      v_teacher_id,
      v_class_id,
      v_subject_id,
      v_room_id
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM planned_sessions WHERE school_id = v_school_id LIMIT 1) THEN
    INSERT INTO planned_sessions (
      school_id,
      schedule_slot_id,
      teacher_id,
      class_id,
      subject_id,
      room_id,
      session_date,
      start_time,
      end_time,
      duration_minutes
    )
    SELECT
      v_school_id,
      ss.id,
      v_teacher_id,
      v_class_id,
      v_subject_id,
      v_room_id,
      (CURRENT_DATE - (gs || ' days')::interval)::date,
      ss.start_time,
      ss.end_time,
      (EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 60)::int
    FROM schedule_slots ss
    CROSS JOIN generate_series(0, 4) gs
    WHERE ss.schedule_id = v_schedule_id
    LIMIT 5;
  END IF;
END $$;

-- =====================================================
-- LESSON LOGS
-- =====================================================

-- Insert draft lesson log
INSERT INTO lesson_logs (
  id,
  school_id,
  planned_session_id,
  teacher_id,
  class_id,
  subject_id,
  session_date,
  theme,
  content,
  homework,
  duration_minutes,
  status,
  latitude,
  longitude,
  wifi_ssid,
  device_info,
  metadata
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM schools LIMIT 1),
  (SELECT id FROM planned_sessions LIMIT 1),
  (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'teacher' LIMIT 1),
  (SELECT id FROM classes LIMIT 1),
  (SELECT id FROM subjects LIMIT 1),
  CURRENT_DATE,
  'Introduction aux Ã©quations linÃ©aires',
  'Nous avons commencÃ© le chapitre sur les Ã©quations linÃ©aires. Les Ã©lÃ¨ves ont appris Ã  rÃ©soudre des Ã©quations simples de la forme ax + b = c. Nous avons vu plusieurs exemples et fait des exercices pratiques. La majoritÃ© de la classe a bien compris le concept.',
  'Exercices 1 Ã  5 page 42 du manuel',
  55,
  'draft',
  14.6928,
  -17.4467,
  'EcoleWiFi',
  '{"platform": "ios", "appVersion": "1.0.0"}'::jsonb,
  '{"draftVersion": 1}'::jsonb
);

-- Insert pending_validation lesson log
INSERT INTO lesson_logs (
  id,
  school_id,
  planned_session_id,
  teacher_id,
  class_id,
  subject_id,
  session_date,
  theme,
  content,
  homework,
  duration_minutes,
  status,
  submitted_at,
  latitude,
  longitude,
  wifi_ssid,
  device_info,
  metadata
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM schools LIMIT 1),
  (SELECT id FROM planned_sessions OFFSET 1 LIMIT 1),
  (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'teacher' OFFSET 1 LIMIT 1),
  (SELECT id FROM classes OFFSET 1 LIMIT 1),
  (SELECT id FROM subjects OFFSET 1 LIMIT 1),
  CURRENT_DATE - INTERVAL '1 day',
  'La RÃ©volution FranÃ§aise - Causes et consÃ©quences',
  'Cours sur les causes de la RÃ©volution FranÃ§aise: crise Ã©conomique, injustice sociale, idÃ©es des LumiÃ¨res. Nous avons analysÃ© les Ã©vÃ©nements clÃ©s de 1789. Les Ã©lÃ¨ves ont participÃ© activement Ã  la discussion.',
  'RÃ©viser le chapitre pour le contrÃ´le de jeudi',
  60,
  'pending_validation',
  NOW() - INTERVAL '2 hours',
  14.6930,
  -17.4465,
  'EcoleWiFi',
  '{"platform": "android", "appVersion": "1.0.0"}'::jsonb,
  '{}'::jsonb
);

-- Insert validated lesson log
INSERT INTO lesson_logs (
  id,
  school_id,
  planned_session_id,
  teacher_id,
  class_id,
  subject_id,
  session_date,
  theme,
  content,
  homework,
  duration_minutes,
  status,
  submitted_at,
  validated_at,
  validated_by,
  latitude,
  longitude,
  wifi_ssid,
  device_info,
  metadata
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM schools LIMIT 1),
  (SELECT id FROM planned_sessions OFFSET 2 LIMIT 1),
  (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'teacher' LIMIT 1),
  (SELECT id FROM classes LIMIT 1),
  (SELECT id FROM subjects LIMIT 1),
  CURRENT_DATE - INTERVAL '2 days',
  'Les verbes irrÃ©guliers en anglais',
  'Revision des verbes irreguliers en anglais. Exercices de conjugaison au preterit. Nous avons travaille avec des jeux de cartes et des quiz interactifs. Les eleves ont fait des progres significatifs.',
  'Apprendre la liste des 20 verbes irrÃ©guliers distribuÃ©e',
  50,
  'validated',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '1 day',
  (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'school_admin' LIMIT 1),
  14.6929,
  -17.4468,
  'EcoleWiFi',
  '{"platform": "ios", "appVersion": "1.0.0"}'::jsonb,
  '{}'::jsonb
);

-- Insert rejected lesson log
INSERT INTO lesson_logs (
  id,
  school_id,
  planned_session_id,
  teacher_id,
  class_id,
  subject_id,
  session_date,
  theme,
  content,
  homework,
  duration_minutes,
  status,
  submitted_at,
  rejected_at,
  rejection_reason,
  latitude,
  longitude,
  wifi_ssid,
  device_info,
  metadata
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM schools LIMIT 1),
  (SELECT id FROM planned_sessions OFFSET 3 LIMIT 1),
  (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'teacher' OFFSET 1 LIMIT 1),
  (SELECT id FROM classes OFFSET 1 LIMIT 1),
  (SELECT id FROM subjects OFFSET 1 LIMIT 1),
  CURRENT_DATE - INTERVAL '3 days',
  'GÃ©omÃ©trie: Les triangles',
  'Introduction aux triangles (Ã©quilatÃ©ral, isocÃ¨le, rectangle).',
  NULL,
  45,
  'rejected',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days',
  'Contenu trop court. Veuillez dÃ©tailler les exercices rÃ©alisÃ©s et la comprÃ©hension des Ã©lÃ¨ves.',
  14.6931,
  -17.4466,
  'EcoleWiFi',
  '{"platform": "android", "appVersion": "1.0.0"}'::jsonb,
  '{}'::jsonb
);

-- Insert another validated lesson log (for testing stats)
INSERT INTO lesson_logs (
  id,
  school_id,
  planned_session_id,
  teacher_id,
  class_id,
  subject_id,
  session_date,
  theme,
  content,
  homework,
  duration_minutes,
  status,
  submitted_at,
  validated_at,
  validated_by,
  latitude,
  longitude,
  wifi_ssid,
  device_info,
  metadata
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM schools LIMIT 1),
  (SELECT id FROM planned_sessions OFFSET 4 LIMIT 1),
  (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'teacher' LIMIT 1),
  (SELECT id FROM classes LIMIT 1),
  (SELECT id FROM subjects OFFSET 2 LIMIT 1),
  CURRENT_DATE - INTERVAL '4 days',
  'Physique: Les forces et le mouvement',
  'ExpÃ©riences sur la gravitÃ© et les forces de frottement. Les Ã©lÃ¨ves ont mesurÃ© la vitesse d''objets sur diffÃ©rents plans inclinÃ©s. Travaux pratiques en groupes de 3-4 Ã©lÃ¨ves.',
  'ComplÃ©ter le graphique du TP',
  60,
  'validated',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '3 days',
  (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'school_admin' LIMIT 1),
  14.6927,
  -17.4469,
  'EcoleWiFi',
  '{"platform": "ios", "appVersion": "1.0.0"}'::jsonb,
  '{}'::jsonb
);

-- =====================================================
-- LESSON LOG DOCUMENTS
-- =====================================================

-- Insert documents for the first validated lesson log
INSERT INTO lesson_log_documents (
  id,
  lesson_log_id,
  school_id,
  file_name,
  file_path,
  file_size,
  mime_type,
  uploaded_by,
  metadata
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM lesson_logs WHERE status = 'validated' LIMIT 1),
  (SELECT id FROM schools LIMIT 1),
  'exercices_verbes_irreguliers.pdf',
  'lesson-documents/school-id/lesson-log-id/exercices_verbes_irreguliers.pdf',
  524288, -- 512KB
  'application/pdf',
  (SELECT teacher_id FROM lesson_logs WHERE status = 'validated' LIMIT 1),
  '{"description": "Liste d''exercices sur les verbes irrÃ©guliers"}'::jsonb
);

-- Insert another document
INSERT INTO lesson_log_documents (
  id,
  lesson_log_id,
  school_id,
  file_name,
  file_path,
  file_size,
  mime_type,
  uploaded_by,
  metadata
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM lesson_logs WHERE status = 'validated' LIMIT 1),
  (SELECT id FROM schools LIMIT 1),
  'quiz_verbes.pdf',
  'lesson-documents/school-id/lesson-log-id/quiz_verbes.pdf',
  262144, -- 256KB
  'application/pdf',
  (SELECT teacher_id FROM lesson_logs WHERE status = 'validated' LIMIT 1),
  '{"description": "Quiz sur les verbes irrÃ©guliers"}'::jsonb
);

-- Insert a document for the physics lesson log
INSERT INTO lesson_log_documents (
  id,
  lesson_log_id,
  school_id,
  file_name,
  file_path,
  file_size,
  mime_type,
  uploaded_by,
  metadata
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM lesson_logs WHERE theme LIKE 'Physique%' LIMIT 1),
  (SELECT id FROM schools LIMIT 1),
  'tp_forces_et_mouvement.pdf',
  'lesson-documents/school-id/lesson-log-id/tp_forces_et_mouvement.pdf',
  1048576, -- 1MB
  'application/pdf',
  (SELECT teacher_id FROM lesson_logs WHERE theme LIKE 'Physique%' LIMIT 1),
  '{"description": "Travaux pratiques sur les forces"}'::jsonb
);

-- =====================================================
-- AUDIT LOGS FOR LESSON LOGS
-- =====================================================

-- Insert audit log for create action
INSERT INTO audit_logs (
  action,
  resource_type,
  resource_id,
  school_id,
  user_id,
  old_data,
  new_data,
  created_at
) SELECT
  'INSERT',
  'lesson_log',
  id,
  school_id,
  teacher_id,
  '{}'::jsonb,
  jsonb_build_object(
    'theme', theme,
    'duration_minutes', duration_minutes,
    'status', status
  ),
  created_at
FROM lesson_logs
WHERE status = 'draft'
LIMIT 1;

-- Insert audit log for submit action
INSERT INTO audit_logs (
  action,
  resource_type,
  resource_id,
  school_id,
  user_id,
  old_data,
  new_data,
  created_at
) SELECT
  'UPDATE',
  'lesson_log',
  id,
  school_id,
  teacher_id,
  '{}'::jsonb,
  jsonb_build_object(
    'submitted_at', submitted_at,
    'status', status
  ),
  submitted_at
FROM lesson_logs
WHERE status = 'pending_validation'
LIMIT 1;

-- Insert audit log for validate action
INSERT INTO audit_logs (
  action,
  resource_type,
  resource_id,
  school_id,
  user_id,
  old_data,
  new_data,
  created_at
) SELECT
  'VALIDATE',
  'lesson_log',
  id,
  school_id,
  validated_by,
  '{}'::jsonb,
  jsonb_build_object(
    'validated_at', validated_at,
    'status', status
  ),
  validated_at
FROM lesson_logs
WHERE status = 'validated'
LIMIT 1;

-- Insert audit log for reject action
INSERT INTO audit_logs (
  action,
  resource_type,
  resource_id,
  school_id,
  user_id,
  old_data,
  new_data,
  created_at
) SELECT
  'UPDATE',
  'lesson_log',
  id,
  school_id,
  teacher_id,
  '{}'::jsonb,
  jsonb_build_object(
    'rejected_at', rejected_at,
    'rejection_reason', rejection_reason,
    'status', status
  ),
  rejected_at
FROM lesson_logs
WHERE status = 'rejected'
LIMIT 1;

-- =====================================================
-- COMMENTS FOR SEED DATA
-- =====================================================

-- This seed data creates:
-- - 5 lesson logs with different statuses (draft, pending_validation, validated x2, rejected)
-- - 3 lesson log documents (PDFs)
-- - 4 audit log entries for lesson log actions
-- - All linked to existing schools, teachers, classes, subjects, and planned_sessions

-- To use this seed data:
-- 1. Ensure seed.sql and seed-school-config.sql have been run
-- 2. Run: psql -U postgres -d novaconnect -f supabase/seed-lesson-logs.sql

-- To query the seed data:
-- SELECT * FROM lesson_logs ORDER BY created_at DESC;
-- SELECT * FROM lesson_log_documents ORDER BY uploaded_at;
-- SELECT * FROM audit_logs WHERE resource_type = 'lesson_log' ORDER BY created_at;

SET session_replication_role = 'origin';




