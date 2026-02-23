'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { useAuth, useRole, usePermissions } from '../hooks';
import type { UserRole } from '@novaconnect/core/types';
import { useInvalidateQueries } from './QueryProvider';

/**
 * Interface du contexte d'authentification
 */
export interface AuthContextValue {
  // Données utilisateur
  user: User | null;
  role: UserRole | null;
  permissions: string[] | null;
  profile: any | null; // Profil utilisateur enrichi

  // États de chargement
  isLoading: boolean;
  isAuthenticated: boolean;

  // Méthodes d'authentification
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  signUp: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    schoolCode?: string;
  }) => Promise<any>;

  // Rafraîchissement
  refreshUser: () => Promise<void>;
}

/**
 * Contexte d'authentification
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Props du AuthProvider
 */
export interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider - Provider d'authentification pour l'application
 *
 * Ce provider :
 * - Utilise useAuth() hook pour gérer l'authentification Supabase
 * - Utilise useRole() et usePermissions() pour enrichir le contexte
 * - Expose les données utilisateur, rôle, permissions via Context
 * - Gère l'état de chargement initial
 * - Invalide les queries React Query lors du logout
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const invalidateQueries = useInvalidateQueries();

  // Récupérer l'utilisateur et les méthodes d'authentification
  const {
    user,
    signIn,
    signOut,
    signUp,
    isLoading: authLoading,
  } = useAuth();

  // Check if we're in offline mode (client-side only)
  const [isOfflineMode, setIsOfflineMode] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const authMode = localStorage.getItem('auth_mode');
      setIsOfflineMode(authMode === 'offline');
    }
  }, [user]); // Re-check when user changes

  // Récupérer le rôle de l'utilisateur
  const {
    data: role,
    isLoading: roleLoading,
  } = useRole();

  // Récupérer les permissions de l'utilisateur
  const {
    data: permissionsData,
    isLoading: permissionsLoading,
  } = usePermissions();

  // En mode offline, utiliser le rôle depuis l'utilisateur directement
  const effectiveRole = React.useMemo(() => {
    if (isOfflineMode && user) {
      // En mode offline, le rôle est dans les métadonnées utilisateur
      return user.user_metadata?.role || user.role || null;
    }
    return role || null;
  }, [isOfflineMode, user, role]);

  // En mode offline, pas de permissions (tableau vide)
  const permissions = React.useMemo(() => {
    if (isOfflineMode) {
      return []; // En mode offline, on ne vérifie pas les permissions
    }
    return permissionsData?.map(p => `${p.resource}:${p.action}`) || [];
  }, [isOfflineMode, permissionsData]);

  // En mode offline, le rôle et permissions sont "chargés" immédiatement
  const effectiveRoleLoading = isOfflineMode ? false : roleLoading;
  const effectivePermissionsLoading = isOfflineMode ? false : permissionsLoading;

  // Profil enrichi
  const profile = React.useMemo(() => {
    if (!user) {
      return null;
    }

    if (isOfflineMode) {
      // En mode offline, créer un profil basique depuis les données utilisateur
      return {
        school: {
          id: user.school_id,
          name: 'Mon École', // Nom par défaut en mode offline
          code: user.school_code,
        },
        schoolId: user.school_id,
        school_id: user.school_id,
      };
    }

    // En mode online, utiliser le schoolId du user (récupéré via useAuth qui combine authUser + userProfile)
    return {
      school: user.schoolId ? { id: user.schoolId } : null,
      schoolId: user.schoolId || user.school_id,
      school_id: user.schoolId || user.school_id,
    };
  }, [user, isOfflineMode]);

  /**
   * Handler de déconnexion
   * Invalide toutes les queries après la déconnexion
   */
  const handleSignOut = useCallback(async () => {
    await signOut();
    // Vider le cache React Query
    invalidateQueries();
  }, [signOut, invalidateQueries]);

  /**
   * Handler de connexion
   * Wrapper autour de signIn
   */
  const handleSignIn = useCallback(async (email: string, password: string) => {
    return await signIn(email, password);
  }, [signIn]);

  /**
   * Handler d'inscription
   * Wrapper autour de signUp
   */
  const handleSignUp = useCallback(async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    schoolCode?: string;
  }) => {
    return await signUp(data);
  }, [signUp]);

  /**
   * Rafraîchir les données utilisateur
   * Force le rechargement du profil, rôle et permissions
   */
  const refreshUser = useCallback(async () => {
    // Force le rechargement en invalidant les queries
    // Les hooks useRole et usePermissions vont automatiquement recharger
    await invalidateQueries();
  }, [invalidateQueries]);

  /**
   * Écouter les changements de session Supabase
   * Invalide les queries lors des changements de session
   */
  useEffect(() => {
    // Cette logique est gérée dans le hook useAuth
    // Nous pourrions ajouter de la logique supplémentaire ici si nécessaire
  }, [user]);

  /**
   * Valeur du contexte
   */
  const value: AuthContextValue = {
    // Données utilisateur
    user: user || null,
    role: effectiveRole,
    permissions: permissions || [],
    profile: profile || null,

    // États de chargement
    isLoading: authLoading || effectiveRoleLoading || effectivePermissionsLoading,
    isAuthenticated: !!user,

    // Méthodes d'authentification
    signIn: handleSignIn,
    signOut: handleSignOut,
    signUp: handleSignUp,

    // Rafraîchissement
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook pour accéder au contexte d'authentification
 *
 * @throws Error si utilisé hors du AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, signOut } = useAuthContext();
 *
 *   if (!isAuthenticated) {
 *     return <Login />;
 *   }
 *
 *   return <div>Welcome {user?.email}</div>;
 * }
 * ```
 */
export function useAuthContext() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

/**
 * Hook pour vérifier si l'utilisateur est authentifié
 * Simplification de useAuthContext pour les checks rapides
 */
export function useIsAuthenticated() {
  const { isAuthenticated, isLoading } = useAuthContext();
  return isAuthenticated && !isLoading;
}

/**
 * Hook pour vérifier si l'utilisateur a un rôle spécifique
 */
export function useHasRole(requiredRole: UserRole) {
  const { role, isLoading } = useAuthContext();

  if (isLoading) {
    return false;
  }

  // Super admin a accès à tout
  if (role === 'super_admin') {
    return true;
  }

  return role === requiredRole;
}

/**
 * Hook pour vérifier si l'utilisateur a une permission spécifique
 */
export function useHasPermission(requiredPermission: string) {
  const { permissions, isLoading } = useAuthContext();

  if (isLoading) {
    return false;
  }

  return permissions?.includes(requiredPermission) || false;
}

/**
 * Hook pour vérifier si l'utilisateur a l'une des permissions requises
 */
export function useHasAnyPermission(requiredPermissions: string[]) {
  const { permissions, isLoading } = useAuthContext();

  if (isLoading) {
    return false;
  }

  return requiredPermissions.some(permission => permissions?.includes(permission)) || false;
}

/**
 * Hook pour vérifier si l'utilisateur a toutes les permissions requises
 */
export function useHasAllPermissions(requiredPermissions: string[]) {
  const { permissions, isLoading } = useAuthContext();

  if (isLoading) {
    return false;
  }

  return requiredPermissions.every(permission => permissions?.includes(permission)) || false;
}

export default AuthProvider;
