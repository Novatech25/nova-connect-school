-- ============================================================================
-- Fix: Rendre les notifications de présence opérationnelles
-- Description: 
--   1. Crée la table push_tokens pour stocker les tokens Expo
--   2. Met à jour l'enum notification_type_enum pour inclure attendance_marked
--   3. Crée une fonction pour appeler l'Edge Function via HTTP
--   4. Met à jour le trigger pour notifier via Edge Function
-- ============================================================================

-- ============================================================================
-- 1. TABLE PUSH_TOKENS (pour les notifications push mobile)
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'mobile', -- 'mobile', 'web', 'desktop'
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un token unique par utilisateur et plateforme
  CONSTRAINT push_tokens_user_platform_unique UNIQUE (user_id, platform)
);

-- Index pour performance
CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_token ON push_tokens(token);
CREATE INDEX idx_push_tokens_is_active ON push_tokens(is_active);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_tokens_updated_at();

-- RLS Policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE push_tokens IS 'Store Expo push tokens for mobile notifications';

-- ============================================================================
-- 2. MISE À JOUR DE L'ENUM notification_type_enum
-- ============================================================================

-- Vérifier si l'enum existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
    -- Ajouter les valeurs manquantes si elles n'existent pas déjà
    BEGIN
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'attendance_marked';
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- Valeur déjà existante
    END;
    
    BEGIN
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'grade_posted';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    
    BEGIN
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'schedule_published';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    
    BEGIN
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'schedule_updated';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    
    BEGIN
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'document_blocked';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    
    BEGIN
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'payment_overdue';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    
    BEGIN
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'report_card_published';
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- ============================================================================
-- 3. FONCTION POUR APPELER L'EDGE FUNCTION VIA HTTP
-- ============================================================================

-- Fonction pour appeler l'Edge Function send-attendance-notification
CREATE OR REPLACE FUNCTION call_attendance_edge_function(
  p_student_id UUID,
  p_attendance_record_id UUID,
  p_status TEXT,
  p_session_id UUID,
  p_session_date TEXT
)
RETURNS VOID AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_payload JSONB;
BEGIN
  -- Récupérer les variables d'environnement
  BEGIN
    v_supabase_url := current_setting('app.supabase_url', true);
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
  END;
  
  -- Si pas configuré, utiliser une valeur par défaut ou logger
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    -- Essayer de récupérer depuis une autre source ou utiliser supabase_functions.http_request
    v_supabase_url := 'http://kong:8000'; -- URL interne Supabase
  END IF;
  
  -- Construire le payload
  v_payload := jsonb_build_object(
    'studentId', p_student_id::text,
    'attendanceRecordId', p_attendance_record_id::text,
    'status', p_status,
    'sessionId', p_session_id::text,
    'sessionDate', p_session_date
  );
  
  -- Appeler l'Edge Function via pg_net (si disponible)
  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-attendance-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(current_setting('app.supabase_service_role_key', true), '')
      ),
      body := v_payload
    );
  EXCEPTION WHEN OTHERS THEN
    -- Si pg_net n'est pas disponible, on logue l'erreur mais on ne bloque pas
    RAISE WARNING 'Could not call edge function: %', SQLERRM;
  END;
  
  -- Log pour debugging
  RAISE NOTICE 'Attendance notification triggered for student % with status %', p_student_id, p_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION call_attendance_edge_function IS 
  'Calls the send-attendance-notification Edge Function via HTTP';

-- ============================================================================
-- 4. MISE À JOUR DU TRIGGER DE NOTIFICATION
-- ============================================================================

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS trigger_notify_parents_on_absence ON attendance_records;

-- Créer la nouvelle fonction de notification améliorée
CREATE OR REPLACE FUNCTION notify_parents_on_absence()
RETURNS TRIGGER AS $$
DECLARE
  student_record RECORD;
  parent_record RECORD;
  notification_title TEXT;
  notification_body TEXT;
  session_info RECORD;
  v_session_date DATE;
BEGIN
  -- Only trigger for new records or updates that change status to absent or late
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    IF NEW.status IN ('absent', 'late') THEN
      -- Get student information
      SELECT * INTO student_record
      FROM students
      WHERE id = NEW.student_id;

      -- Get session date from attendance_sessions
      SELECT session_date INTO v_session_date
      FROM attendance_sessions
      WHERE id = NEW.attendance_session_id;

      -- Get planned session information for the session details
      SELECT
        ps.subject_name,
        ps.start_time,
        ps.end_time
      INTO session_info
      FROM planned_sessions ps
      INNER JOIN attendance_sessions att_s ON att_s.planned_session_id = ps.id
      WHERE att_s.id = NEW.attendance_session_id;

      -- Loop through parents and create notifications
      FOR parent_record IN
        SELECT u.id, u.first_name, u.email, u.phone
        FROM users u
        INNER JOIN student_parent_relations spr ON spr.parent_id = u.id
        WHERE spr.student_id = NEW.student_id
          AND u.is_active = true
      LOOP
        -- Build notification message
        notification_title := CASE 
          WHEN NEW.status = 'absent' THEN 'Absence de ' || COALESCE(student_record.first_name, 'votre enfant')
          ELSE 'Retard de ' || COALESCE(student_record.first_name, 'votre enfant')
        END;

        notification_body := CASE
          WHEN NEW.status = 'absent' THEN 
            'Votre enfant ' || COALESCE(student_record.first_name, '') || ' ' || COALESCE(student_record.last_name, '') ||
            ' a été marqué(e) absent(e) le ' || TO_CHAR(v_session_date, 'DD/MM/YYYY') ||
            CASE WHEN session_info.subject_name IS NOT NULL THEN ' pour ' || session_info.subject_name ELSE '' END
          ELSE 
            'Votre enfant ' || COALESCE(student_record.first_name, '') || ' ' || COALESCE(student_record.last_name, '') ||
            ' a été marqué(e) en retard le ' || TO_CHAR(v_session_date, 'DD/MM/YYYY') ||
            CASE WHEN session_info.subject_name IS NOT NULL THEN ' pour ' || session_info.subject_name ELSE '' END
        END;

        -- Create notification in-app
        INSERT INTO notifications (
          user_id,
          type,
          title,
          body,
          data,
          channels,
          read_at,
          created_at
        ) VALUES (
          parent_record.id,
          'attendance_marked',
          notification_title,
          notification_body,
          jsonb_build_object(
            'studentId', NEW.student_id,
            'attendanceRecordId', NEW.id,
            'status', NEW.status,
            'sessionDate', v_session_date::text,
            'sessionId', NEW.attendance_session_id,
            'subjectName', session_info.subject_name
          ),
          ARRAY['in_app', 'push'], -- Canaux par défaut
          NULL,
          NOW()
        );
      END LOOP;

      -- Appeler l'Edge Function pour les notifications push/email/SMS
      -- Cette partie est asynchrone et ne bloque pas la transaction
      BEGIN
        PERFORM call_attendance_edge_function(
          NEW.student_id,
          NEW.id,
          NEW.status::text,
          NEW.attendance_session_id,
          v_session_date::text
        );
      EXCEPTION WHEN OTHERS THEN
        -- Ne pas bloquer si l'appel échoue
        RAISE WARNING 'Edge function call failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger
CREATE TRIGGER trigger_notify_parents_on_absence
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION notify_parents_on_absence();

COMMENT ON FUNCTION notify_parents_on_absence() IS 
  'Creates in-app notifications for parents when a student is marked absent or late, and triggers Edge Function for push/email';

-- ============================================================================
-- 5. AJOUT DE COLONNES MANQUANTES À notification_logs
-- ============================================================================

-- Ajouter les colonnes nécessaires si elles n'existent pas
DO $$
BEGIN
  -- Colonne type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'type'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN type TEXT;
  END IF;
  
  -- Colonne recipients
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'recipients'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN recipients UUID[];
  END IF;
  
  -- Colonne data
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'data'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN data JSONB DEFAULT '{}';
  END IF;
  
  -- Colonne sent_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;
  
  -- Colonne channel
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'channel'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN channel TEXT;
  END IF;
  
  -- Colonne retry_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  
  -- Colonne next_retry_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN next_retry_at TIMESTAMPTZ;
  END IF;
  
  -- Colonne metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_logs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notification_logs ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Index pour notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- ============================================================================
-- 6. CONFIGURATION DES PRÉFÉRENCES PAR DÉFAUT
-- ============================================================================

-- Fonction pour créer les préférences de notification par défaut pour un utilisateur
CREATE OR REPLACE FUNCTION create_default_notification_preferences(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notification_preferences (user_id, preferences)
  VALUES (
    p_user_id,
    jsonb_build_object(
      'attendance_marked', jsonb_build_object(
        'in_app', true,
        'push', true,
        'email', false,
        'sms', false
      ),
      'grade_posted', jsonb_build_object(
        'in_app', true,
        'push', true,
        'email', true,
        'sms', false
      ),
      'schedule_published', jsonb_build_object(
        'in_app', true,
        'push', true,
        'email', false,
        'sms', false
      ),
      'document_blocked', jsonb_build_object(
        'in_app', true,
        'push', true,
        'email', true,
        'sms', true
      ),
      'payment_overdue', jsonb_build_object(
        'in_app', true,
        'push', true,
        'email', true,
        'sms', true
      )
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_default_notification_preferences IS 
  'Creates default notification preferences for a user';

-- Trigger pour créer automatiquement les préférences à la création d'un utilisateur
CREATE OR REPLACE FUNCTION auto_create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_notification_preferences(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_notification_preferences ON users;
CREATE TRIGGER auto_create_notification_preferences
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_notification_preferences();

-- Créer les préférences pour les utilisateurs existants qui n'en ont pas
INSERT INTO notification_preferences (user_id, preferences)
SELECT 
  u.id,
  jsonb_build_object(
    'attendance_marked', jsonb_build_object('in_app', true, 'push', true, 'email', false, 'sms', false),
    'grade_posted', jsonb_build_object('in_app', true, 'push', true, 'email', true, 'sms', false),
    'schedule_published', jsonb_build_object('in_app', true, 'push', true, 'email', false, 'sms', false)
  )
FROM users u
LEFT JOIN notification_preferences np ON np.user_id = u.id
WHERE np.id IS NULL;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE push_tokens IS 'Expo push tokens for mobile push notifications';
COMMENT ON COLUMN push_tokens.token IS 'The Expo push token';
COMMENT ON COLUMN push_tokens.platform IS 'Platform: mobile, web, or desktop';
COMMENT ON COLUMN push_tokens.is_active IS 'Whether this token is active and should be used';

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

-- Vue pour vérifier la configuration des notifications
CREATE OR REPLACE VIEW notification_system_status AS
SELECT 
  'push_tokens table' as component,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_tokens') 
    THEN 'OK' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'attendance trigger' as component,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_parents_on_absence'
  ) THEN 'OK' ELSE 'MISSING' END as status
UNION ALL
SELECT 
  'notification preferences trigger' as component,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'auto_create_notification_preferences'
  ) THEN 'OK' ELSE 'MISSING' END as status;

-- Afficher le statut
SELECT * FROM notification_system_status;
