-- =====================================================
-- Migration : Ajouter les colonnes de retry à notification_logs
-- =====================================================

-- Ajouter la colonne retry_count
ALTER TABLE notification_logs
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Ajouter la colonne next_retry_at
ALTER TABLE notification_logs
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Créer un index sur status et next_retry_at pour optimiser les queries de retry
CREATE INDEX IF NOT EXISTS idx_notification_logs_status_next_retry
ON notification_logs(status, next_retry_at)
WHERE status = 'failed';

-- Créer un index sur notification_id pour les lookups rapides
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_id
ON notification_logs(notification_id);

-- Ajouter un commentaire pour documenter
COMMENT ON COLUMN notification_logs.retry_count IS 'Nombre de tentatives de retry pour cette notification';
COMMENT ON COLUMN notification_logs.next_retry_at IS 'Timestamp du prochain retry (NULL si pas de retry planifié)';
