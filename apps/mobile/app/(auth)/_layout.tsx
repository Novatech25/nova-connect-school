import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthContext } from '@novaconnect/data';

/**
 * Layout pour les écrans d'authentification mobile
 *
 * Ce layout :
 * - Utilise un Stack Navigator sans header
 * - Vérifie si l'utilisateur est déjà connecté et redirige vers le dashboard
 * - Définit les écrans : login, register, forgot-password
 */
export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const router = useRouter();
  const segments = useSegments();

  /**
   * Rediriger vers le dashboard mobile si déjà authentifié
   */
  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      // Rediriger vers le stack protégé (le layout gérera les tabs selon le rôle)
      router.replace('/(protected)');
    }
  }, [isAuthenticated, isLoading, router]);

  // Ne rien rendre car c'est un layout de navigation
  return null;
}
