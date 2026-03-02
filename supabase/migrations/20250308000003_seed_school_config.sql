-- Seed Script: School Configuration Data
-- Description: Populates school_config tables with realistic test data
-- Usage: Run this script after creating migrations to populate sample data
-- Created: 2025-01-17

-- ============================================
-- SETUP
-- ============================================

-- Assuming you have a test school created. Replace with actual school_id.
DO $$
DECLARE
  v_school_id UUID;
  v_admin_user_id UUID;
  v_teacher1_id UUID;
  v_teacher2_id UUID;
  v_teacher3_id UUID;
  v_teacher4_id UUID;
  v_teacher5_id UUID;
  v_academic_year_id UUID;
BEGIN
  -- Get or create test school (adjust as needed)
  SELECT id INTO v_school_id FROM schools WHERE code = 'TEST-SCHOOL' LIMIT 1;

  IF v_school_id IS NULL THEN
    INSERT INTO schools (name, code, city, country, status)
    VALUES ('Ã‰cole Test Nouakchott', 'TEST-SCHOOL', 'Nouakchott', 'Mauritanie', 'active')
    RETURNING id INTO v_school_id;

    RAISE NOTICE 'Created test school: %', v_school_id;
  END IF;

  -- Get test users (assuming they exist from other seed scripts)
  SELECT id INTO v_admin_user_id FROM users WHERE email = 'admin@testschool.com' LIMIT 1;
  SELECT id INTO v_teacher1_id FROM users WHERE email = 'teacher1@testschool.com' LIMIT 1;
  SELECT id INTO v_teacher2_id FROM users WHERE email = 'teacher2@testschool.com' LIMIT 1;
  SELECT id INTO v_teacher3_id FROM users WHERE email = 'teacher3@testschool.com' LIMIT 1;
  SELECT id INTO v_teacher4_id FROM users WHERE email = 'teacher4@testschool.com' LIMIT 1;
  SELECT id INTO v_teacher5_id FROM users WHERE email = 'teacher5@testschool.com' LIMIT 1;

  -- ============================================
  -- ACADEMIC YEARS
  -- ============================================

  INSERT INTO academic_years (school_id, name, start_date, end_date, is_current)
  VALUES
    (v_school_id, '2024-2025', '2024-09-01', '2025-07-31', true),
    (v_school_id, '2023-2024', '2023-09-01', '2024-07-31', false),
    (v_school_id, '2025-2026', '2025-09-01', '2026-07-31', false)
  ON CONFLICT (school_id, name) DO NOTHING;

  -- Get current academic year
  SELECT id INTO v_academic_year_id
  FROM academic_years
  WHERE school_id = v_school_id AND is_current = true
  LIMIT 1;

  RAISE NOTICE 'Created academic years';

  -- ============================================
  -- LEVELS
  -- ============================================

  INSERT INTO levels (school_id, name, code, level_type, order_index)
  VALUES
    -- Primary
    (v_school_id, 'CP', 'CP', 'primary', 1),
    (v_school_id, 'CE1', 'CE1', 'primary', 2),
    (v_school_id, 'CE2', 'CE2', 'primary', 3),
    (v_school_id, 'CM1', 'CM1', 'primary', 4),
    (v_school_id, 'CM2', 'CM2', 'primary', 5),
    -- Middle School
    (v_school_id, '6Ã¨me', '6EME', 'middle_school', 6),
    (v_school_id, '5Ã¨me', '5EME', 'middle_school', 7),
    (v_school_id, '4Ã¨me', '4EME', 'middle_school', 8),
    (v_school_id, '3Ã¨me', '3EME', 'middle_school', 9),
    -- High School
    (v_school_id, 'Seconde', '2ND', 'high_school', 10),
    (v_school_id, 'PremiÃ¨re', '1ERE', 'high_school', 11),
    (v_school_id, 'Terminale', 'TERM', 'high_school', 12)
  ON CONFLICT (school_id, code) DO NOTHING;

  RAISE NOTICE 'Created levels';

  -- ============================================
  -- CAMPUSES
  -- ============================================

  INSERT INTO campuses (school_id, name, code, address, city, latitude, longitude, is_main)
  VALUES
    (v_school_id, 'Campus Principal', 'MAIN', 'Avenue Mohammed V', 'Nouakchott', 18.0735, -15.9582, true),
    (v_school_id, 'Annexe Nord', 'NORTH', 'Route de Nouadhibou', 'Nouakchott', 18.1050, -15.9250, false)
  ON CONFLICT (school_id, code) DO NOTHING;

  RAISE NOTICE 'Created campuses';

  -- ============================================
  -- ROOMS
  -- ============================================

  WITH campus_main AS (
    SELECT id FROM campuses WHERE school_id = v_school_id AND code = 'MAIN' LIMIT 1
  ),
  campus_north AS (
    SELECT id FROM campuses WHERE school_id = v_school_id AND code = 'NORTH' LIMIT 1
  )
  INSERT INTO rooms (school_id, campus_id, name, code, capacity, room_type, equipment, is_available)
  SELECT
    v_school_id,
    (SELECT id FROM campus_main),
    'Salle ' || generate_series(1, 10),
    'S' || generate_series(1, 10),
    30,
    'classroom'::room_type_enum,
    '{"projector": true, "smart_board": true, "computers": 0}'::jsonb,
    true
  UNION ALL
  SELECT
    v_school_id,
    (SELECT id FROM campus_main),
    'Laboratoire ' || chr(65 + generate_series(1, 3)),
    'LAB' || generate_series(1, 3),
    20,
    'lab'::room_type_enum,
    '{"projector": true, "computers": 20, "chemistry_hood": true}'::jsonb,
    true
  UNION ALL
  SELECT
    v_school_id,
    (SELECT id FROM campus_main),
    'AmphithÃ©Ã¢tre ' || generate_series(1, 2),
    'AMPH' || generate_series(1, 2),
    100,
    'amphitheater'::room_type_enum,
    '{"projector": true, "sound_system": true, "computers": 5}'::jsonb,
    true
  UNION ALL
  SELECT
    v_school_id,
    (SELECT id FROM campus_north),
    'Salle ' || generate_series(11, 15),
    'S' || generate_series(11, 15),
    25,
    'classroom'::room_type_enum,
    '{"projector": true}'::jsonb,
    true
  ON CONFLICT (school_id, campus_id, code) DO NOTHING;

  RAISE NOTICE 'Created rooms';

  -- ============================================
  -- SUBJECTS
  -- ============================================

  INSERT INTO subjects (school_id, name, code, description, coefficient, color, icon)
  VALUES
    (v_school_id, 'MathÃ©matiques', 'MATHS', 'Apprentissage des mathÃ©matiques', 4, '#3b82f6', 'ðŸ“'),
    (v_school_id, 'FranÃ§ais', 'FRA', 'Langue et littÃ©rature franÃ§aise', 4, '#ef4444', 'ðŸ“š'),
    (v_school_id, 'Anglais', 'ENG', 'Langue anglaise', 3, '#10b981', 'ðŸ‡¬ðŸ‡§'),
    (v_school_id, 'Arabe', 'ARA', 'Langue et littÃ©rature arabe', 4, '#8b5cf6', 'ðŸ•Œ'),
    (v_school_id, 'Histoire-GÃ©ographie', 'HG', 'Histoire et gÃ©ographie', 3, '#f59e0b', 'ðŸŒ'),
    (v_school_id, 'Physique-Chimie', 'PHY', 'Sciences physiques', 3, '#ec4899', 'âš—ï¸'),
    (v_school_id, 'SVT', 'SVT', 'Sciences de la vie et de la terre', 3, '#06b6d4', 'ðŸ§¬'),
    (v_school_id, 'Informatique', 'INFO', 'Bureautique et programmation', 2, '#6366f1', 'ðŸ’»'),
    (v_school_id, 'Ã‰ducation Physique', 'EPS', 'Sport et Ã©ducation physique', 2, '#84cc16', 'âš½'),
    (v_school_id, 'Ã‰ducation Civique', 'CIVIQUE', 'Ã‰ducation civique et morale', 1, '#a3a3a3', 'âš–ï¸')
  ON CONFLICT (school_id, code) DO NOTHING;

  RAISE NOTICE 'Created subjects';

  -- ============================================
  -- GRADING SCALES
  -- ============================================

  INSERT INTO grading_scales (school_id, name, min_score, max_score, passing_score, scale_config, is_default)
  VALUES
    (v_school_id, 'Ã‰chelle Standard 0-20', 0, 20, 10, '{
      "mentions": [
        {"min": 16, "max": 20, "label": "TrÃ¨s Bien", "color": "#10b981"},
        {"min": 14, "max": 16, "label": "Bien", "color": "#3b82f6"},
        {"min": 12, "max": 14, "label": "Assez Bien", "color": "#f59e0b"},
        {"min": 10, "max": 12, "label": "Passable", "color": "#6b7280"},
        {"min": 0, "max": 10, "label": "Insuffisant", "color": "#ef4444"}
      ]
    }'::jsonb, true),
    (v_school_id, 'Ã‰chelle Primaire 0-10', 0, 10, 5, '{
      "mentions": [
        {"min": 8, "max": 10, "label": "Excellent", "color": "#10b981"},
        {"min": 7, "max": 8, "label": "TrÃ¨s Bien", "color": "#3b82f6"},
        {"min": 6, "max": 7, "label": "Bien", "color": "#f59e0b"},
        {"min": 5, "max": 6, "label": "Assez Bien", "color": "#6b7280"},
        {"min": 0, "max": 5, "label": "Ã€ amÃ©liorer", "color": "#ef4444"}
      ]
    }'::jsonb, false)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Created grading scales';

  -- ============================================
  -- PERIODS
  -- ============================================

  INSERT INTO periods (school_id, academic_year_id, name, period_type, start_date, end_date, order_index, weight)
  VALUES
    (v_school_id, v_academic_year_id, 'Trimestre 1', 'trimester', '2024-09-01', '2024-12-15', 1, 1.0),
    (v_school_id, v_academic_year_id, 'Trimestre 2', 'trimester', '2025-01-05', '2025-04-10', 2, 1.0),
    (v_school_id, v_academic_year_id, 'Trimestre 3', 'trimester', '2025-04-20', '2025-07-15', 3, 1.0)
  ON CONFLICT (school_id, academic_year_id, name) DO NOTHING;

  RAISE NOTICE 'Created periods';

  -- ============================================
  -- CLASSES
  -- ============================================

  WITH levels_data AS (
    SELECT id, code, name FROM levels WHERE school_id = v_school_id
  ),
  rooms_data AS (
    SELECT id, code FROM rooms WHERE school_id = v_school_id AND room_type = 'classroom' LIMIT 20
  )
  INSERT INTO classes (school_id, level_id, academic_year_id, name, code, capacity, homeroom_teacher_id, room_id, metadata)
  SELECT
    v_school_id,
    ld.id,
    v_academic_year_id,
    ld.name || ' ' || CASE WHEN gs.num < 3 THEN gs.num::text ELSE '' END,
    ld.code || CASE WHEN gs.num < 3 THEN gs.num::text ELSE '' END,
    30,
    NULL, -- homeroom teacher assigned later
    (SELECT id FROM rooms_data WHERE rooms_data.code = 'S' || gs.num),
    '{"double_streaming": false}'::jsonb
  FROM levels_data ld
  CROSS JOIN (SELECT generate_series(1, 2) as num) gs
  WHERE ld.code IN ('CP', 'CE1', 'CE2', 'CM1', 'CM2', '6EME', '5EME', '4EME', '3EME', '2ND', '1ERE', 'TERM')
  ON CONFLICT (school_id, academic_year_id, code) DO NOTHING;

  RAISE NOTICE 'Created classes';

  -- ============================================
  -- TEACHER ASSIGNMENTS
  -- ============================================

  -- Assign teachers to classes and subjects
  -- (This assumes teacher users exist. Adjust user IDs as needed)

  INSERT INTO teacher_assignments (school_id, teacher_id, class_id, subject_id, academic_year_id, is_primary, hourly_rate)
  WITH classes_data AS (
    SELECT c.id, s.id as subject_id, c.code
    FROM classes c
    CROSS JOIN subjects s
    WHERE c.school_id = v_school_id
      AND c.academic_year_id = v_academic_year_id
      AND s.school_id = v_school_id
      AND s.code IN ('MATHS', 'FRA', 'ENG', 'ARA', 'HG')
    LIMIT 50
  )
  SELECT
    v_school_id,
    CASE WHEN row_number() OVER (ORDER BY cd.code) % 5 = 0 THEN v_teacher1_id
         WHEN row_number() OVER (ORDER BY cd.code) % 5 = 1 THEN v_teacher2_id
         WHEN row_number() OVER (ORDER BY cd.code) % 5 = 2 THEN v_teacher3_id
         WHEN row_number() OVER (ORDER BY cd.code) % 5 = 3 THEN v_teacher4_id
         ELSE v_teacher5_id END,
    cd.id,
    cd.subject_id,
    v_academic_year_id,
    true,
    CASE WHEN cd.subject_id IN (SELECT id FROM subjects WHERE code = 'MATHS') THEN 1500
         WHEN cd.subject_id IN (SELECT id FROM subjects WHERE code = 'PHY') THEN 1600
         ELSE 1200 END
  FROM classes_data cd
  ON CONFLICT (school_id, teacher_id, class_id, subject_id, academic_year_id) DO NOTHING;

  RAISE NOTICE 'Created teacher assignments';

  -- ============================================
  -- SUMMARY
  -- ============================================

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'SCHOOL CONFIGURATION SEED COMPLETE';
  RAISE NOTICE 'School: %', v_school_id;
  RAISE NOTICE 'Academic Year: %', v_academic_year_id;
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '- 3 academic years';
  RAISE NOTICE '- 12 levels (primary to high school)';
  RAISE NOTICE '- 2 campuses';
  RAISE NOTICE '- 20+ rooms';
  RAISE NOTICE '- 10 subjects';
  RAISE NOTICE '- 2 grading scales';
  RAISE NOTICE '- 3 periods (trimesters)';
  RAISE NOTICE '- 24 classes';
  RAISE NOTICE '- 50+ teacher assignments';
  RAISE NOTICE '=================================================';

END $$;
