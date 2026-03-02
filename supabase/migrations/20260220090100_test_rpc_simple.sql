-- ============================================
-- Test function - Version simplifiée
-- ============================================

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS calculate_room_assignments_rpc(UUID, DATE, UUID, BOOLEAN);

-- Créer une version simplifiée
CREATE OR REPLACE FUNCTION calculate_room_assignments_rpc(
  p_school_id UUID,
  p_session_date DATE,
  p_schedule_id UUID DEFAULT NULL,
  p_auto_publish BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config JSONB;
BEGIN
  -- Get school configuration
  SELECT settings->'dynamicRoomAssignment' AS config
  INTO v_config
  FROM schools
  WHERE id = p_school_id;

  IF v_config IS NULL OR NOT COALESCE((v_config->>'enabled')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Module non activé. Allez dans Paramètres → Attrib. Salles pour l\'activer.',
      'assignmentsCreated', 0,
      'assignmentsUpdated', 0,
      'insufficientCapacity', '[]'::JSONB,
      'message', 'Module non activé'
    );
  END IF;

  -- Return success (simplified for testing)
  RETURN jsonb_build_object(
    'success', true,
    'assignmentsCreated', 0,
    'assignmentsUpdated', 0,
    'insufficientCapacity', '[]'::JSONB,
    'message', 'Fonction RPC testée avec succès! School: ' || p_school_id::TEXT || ', Date: ' || p_session_date::TEXT
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Erreur SQL: ' || SQLERRM,
    'detail', SQLSTATE,
    'assignmentsCreated', 0,
    'assignmentsUpdated', 0,
    'insufficientCapacity', '[]'::JSONB,
    'message', 'Erreur: ' || SQLERRM
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION calculate_room_assignments_rpc(UUID, DATE, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_room_assignments_rpc(UUID, DATE, UUID, BOOLEAN) TO anon;

COMMENT ON FUNCTION calculate_room_assignments_rpc IS 'Version simplifiée pour test';
