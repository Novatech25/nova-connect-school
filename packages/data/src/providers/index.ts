/**
 * Providers pour l'application NovaConnect
 *
 * Ce module exporte tous les providers nécessaires pour l'application :
 * - QueryProvider : React Query pour la gestion du cache et des requêtes
 * - AuthProvider : Contexte d'authentification avec rôle et permissions
 */

export {
  QueryProvider,
  useQueryClient,
  useInvalidateQueries,
  useClearQueryCache,
} from './QueryProvider';

export {
  AuthProvider,
  useAuthContext,
  useIsAuthenticated,
  useHasRole,
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions,
  type AuthContextValue,
  type AuthProviderProps,
} from './AuthProvider';

export type { QueryProviderProps } from './QueryProvider';
