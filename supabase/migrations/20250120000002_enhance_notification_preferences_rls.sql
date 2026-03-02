-- =====================================================
-- Migration : Améliorer les RLS policies pour notification_preferences
-- Created: 2025-01-17
-- Description: Ajouter les policies pour admins et service role
-- =====================================================

-- Politique pour que les admins puissent gérer les préférences de tous les utilisateurs
CREATE POLICY "Admins can manage all notification preferences"
  ON notification_preferences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'school_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('super_admin', 'school_admin')
    )
  );

-- Politique pour le service role (nécessaire pour les Edge Functions et triggers)
CREATE POLICY "Service role can bypass RLS for notification_preferences"
  ON notification_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Commentaires
COMMENT ON POLICY "Admins can manage all notification preferences" ON notification_preferences IS
'Permet aux super_admins et school_admins de gérer les préférences de notification de tous les utilisateurs';

COMMENT ON POLICY "Service role can bypass RLS for notification_preferences" ON notification_preferences IS
'Permet au service role de contourner RLS pour les opérations automatisées (triggers, Edge Functions)';
