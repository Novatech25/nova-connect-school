-- ============================================================================
-- Pre-Migration Cleanup
-- Description: Supprime les fonctions conflictuelles avant les migrations
-- Date: 2026-02-15
-- ============================================================================

-- Supprimer les fonctions conflictuelles si elles existent
DROP FUNCTION IF EXISTS publish_schedule_v2(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_v3(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_simple(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS nova_publish_schedule(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS fix_publish_schedule_simple(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_ultra_simple(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_no_triggers(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_minimal(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_simple_rpc(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_rpc_final(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_rpc_fixed(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_rpc_v4_fixed(UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS publish_schedule_rpc_secure(UUID, UUID, UUID, UUID);

-- Supprimer les triggers conflictuels
DROP TRIGGER IF EXISTS trigger_notify_parents_on_absence ON attendance_records;

\echo 'Cleanup completed - conflicting functions removed'
