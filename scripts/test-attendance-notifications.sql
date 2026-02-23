-- ============================================================================
-- Script de Test des Notifications de Présence
-- Description: Valide que tout le système de notification est correctement
--              configuré et fonctionnel
-- ============================================================================

\echo '================================================================================'
\echo 'TEST DU SYSTÈME DE NOTIFICATIONS DE PRÉSENCE'
\echo '================================================================================'

-- ============================================================================
-- 1. VÉRIFICATION DES TABLES
-- ============================================================================
\echo ''
\echo '--- 1. Vérification des tables ---'

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Vérifier push_tokens
  SELECT COUNT(*) INTO v_count FROM information_schema.tables 
  WHERE table_name = 'push_tokens';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Table push_tokens existe';
  ELSE
    RAISE NOTICE '❌ Table push_tokens MANQUANTE';
  END IF;
  
  -- Vérifier notifications
  SELECT COUNT(*) INTO v_count FROM information_schema.tables 
  WHERE table_name = 'notifications';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Table notifications existe';
  ELSE
    RAISE NOTICE '❌ Table notifications MANQUANTE';
  END IF;
  
  -- Vérifier notification_logs
  SELECT COUNT(*) INTO v_count FROM information_schema.tables 
  WHERE table_name = 'notification_logs';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Table notification_logs existe';
  ELSE
    RAISE NOTICE '❌ Table notification_logs MANQUANTE';
  END IF;
  
  -- Vérifier notification_preferences
  SELECT COUNT(*) INTO v_count FROM information_schema.tables 
  WHERE table_name = 'notification_preferences';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Table notification_preferences existe';
  ELSE
    RAISE NOTICE '❌ Table notification_preferences MANQUANTE';
  END IF;
END $$;

-- ============================================================================
-- 2. VÉRIFICATION DES TRIGGERS
-- ============================================================================
\echo ''
\echo '--- 2. Vérification des triggers ---'

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Vérifier trigger_notify_parents_on_absence
  SELECT COUNT(*) INTO v_count FROM pg_trigger 
  WHERE tgname = 'trigger_notify_parents_on_absence';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Trigger trigger_notify_parents_on_absence existe';
  ELSE
    RAISE NOTICE '❌ Trigger trigger_notify_parents_on_absence MANQUANT';
  END IF;
  
  -- Vérifier auto_create_notification_preferences
  SELECT COUNT(*) INTO v_count FROM pg_trigger 
  WHERE tgname = 'auto_create_notification_preferences';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Trigger auto_create_notification_preferences existe';
  ELSE
    RAISE NOTICE '❌ Trigger auto_create_notification_preferences MANQUANT';
  END IF;
END $$;

-- ============================================================================
-- 3. VÉRIFICATION DES FONCTIONS
-- ============================================================================
\echo ''
\echo '--- 3. Vérification des fonctions ---'

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Vérifier notify_parents_on_absence
  SELECT COUNT(*) INTO v_count FROM pg_proc 
  WHERE proname = 'notify_parents_on_absence';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Fonction notify_parents_on_absence existe';
  ELSE
    RAISE NOTICE '❌ Fonction notify_parents_on_absence MANQUANTE';
  END IF;
  
  -- Vérifier call_attendance_edge_function
  SELECT COUNT(*) INTO v_count FROM pg_proc 
  WHERE proname = 'call_attendance_edge_function';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Fonction call_attendance_edge_function existe';
  ELSE
    RAISE NOTICE '❌ Fonction call_attendance_edge_function MANQUANTE';
  END IF;
  
  -- Vérifier create_default_notification_preferences
  SELECT COUNT(*) INTO v_count FROM pg_proc 
  WHERE proname = 'create_default_notification_preferences';
  
  IF v_count > 0 THEN
    RAISE NOTICE '✅ Fonction create_default_notification_preferences existe';
  ELSE
    RAISE NOTICE '❌ Fonction create_default_notification_preferences MANQUANTE';
  END IF;
END $$;

-- ============================================================================
-- 4. STATISTIQUES ACTUELLES
-- ============================================================================
\echo ''
\echo '--- 4. Statistiques actuelles ---'

-- Nombre de tokens push
SELECT 
  COUNT(*) as total_push_tokens,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens
FROM push_tokens;

-- Nombre de notifications récentes
SELECT 
  type,
  COUNT(*) as count,
  MAX(created_at) as last_notification
FROM notifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type
ORDER BY count DESC;

-- Nombre de logs de notification
SELECT 
  type,
  channel,
  status,
  COUNT(*) as count
FROM notification_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type, channel, status
ORDER BY count DESC;

-- ============================================================================
-- 5. VÉRIFICATION DES DONNÉES DE TEST
-- ============================================================================
\echo ''
\echo '--- 5. Vérification des données pour test ---'

-- Vérifier s'il existe des élèves avec des parents
SELECT 
  'Élèves avec parents liés' as check_item,
  COUNT(DISTINCT student_id) as count
FROM student_parent_relations;

-- Vérifier s'il existe des sessions de présence
SELECT 
  'Sessions de présence' as check_item,
  COUNT(*) as count
FROM attendance_sessions
WHERE session_date >= CURRENT_DATE;

-- Vérifier s'il existe des enregistrements de présence récents
SELECT 
  'Enregistrements de présence récents' as check_item,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'absent') as absents,
  COUNT(*) FILTER (WHERE status = 'late') as retards
FROM attendance_records
WHERE created_at > NOW() - INTERVAL '7 days';

-- ============================================================================
-- 6. TEST MANUEL (DÉCOMMENTER POUR UTILISER)
-- ============================================================================
\echo ''
\echo '--- 6. Test manuel (décommenter pour utiliser) ---'
\echo ''
\echo 'Pour tester manuellement, suivez ces étapes :'
\echo ''
\echo '1. Identifiez un élève avec des parents liés :'
\echo '   SELECT s.id, s.first_name, s.last_name, u.email as parent_email'
\echo '   FROM students s'
\echo '   JOIN student_parent_relations spr ON spr.student_id = s.id'
\echo '   JOIN users u ON u.id = spr.parent_id'
\echo '   LIMIT 1;'
\echo ''
\echo '2. Identifiez une session de présence :'
\echo '   SELECT id FROM attendance_sessions LIMIT 1;'
\echo ''
\echo '3. Créez un enregistrement de test :'
\echo '   INSERT INTO attendance_records ('
\echo '     attendance_session_id,'
\echo '     school_id,'
\echo '     student_id,'
\echo '     status,'
\echo '     source,'
\echo '     marked_by'
\echo '   ) VALUES ('
\echo '     ''id-session'','  -- Remplacez par un ID réel
\echo '     ''id-ecole'','    -- Remplacez par un ID réel
\echo '     ''id-eleve'','    -- Remplacez par un ID réel
\echo '     ''absent'','      -- ou ''late''
\echo '     ''teacher_manual'','
\echo '     ''id-professeur'''  -- Remplacez par un ID réel
\echo '   );'
\echo ''
\echo '4. Vérifiez que la notification a été créée :'
\echo '   SELECT * FROM notifications '
\echo '   WHERE type = ''attendance_marked'''
\echo '   ORDER BY created_at DESC LIMIT 5;'
\echo ''

-- ============================================================================
-- 7. RÉSUMÉ
-- ============================================================================
\echo ''
\echo '================================================================================'
\echo 'RÉSUMÉ DU SYSTÈME'
\echo '================================================================================'

SELECT * FROM notification_system_status;

\echo ''
\echo '================================================================================'
\echo 'TEST TERMINÉ'
\echo '================================================================================'
