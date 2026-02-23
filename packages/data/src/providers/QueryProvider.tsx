'use client';

import React from 'react';
import {
  QueryClient,
  QueryClientProvider,
  QueryClientProviderProps,
} from '@tanstack/react-query';

/**
 * QueryClient configuré pour NovaConnect
 * Optimisé pour les requêtes authentifiées avec cache intelligent
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Les données restent fraîches pendant 5 minutes
      staleTime: 5 * 60 * 1000,
      // Les données mises en cache sont gardées pendant 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry 1 fois en cas d'erreur (pas de spam en cas d'échec)
      retry: 1,
      // Ne pas rafraîchir automatiquement sur focus de fenêtre
      refetchOnWindowFocus: false,
      // Rafraîchir si la connexion est rétablie
      refetchOnReconnect: true,
      // Rafraîchir si le composant est monté
      refetchOnMount: true,
    },
    mutations: {
      // Pas de retry pour les mutations (évite les doubles soumissions)
      retry: false,
      // Le succès d'une mutation invalide les queries liées
      onMutate: async () => {
        // Annuler les requêtes en cours pour éviter les conflits
        await queryClient.cancelQueries();
      },
    },
  },
});

/**
 * Props du QueryProvider
 */
export interface QueryProviderProps extends Partial<QueryClientProviderProps> {
  children: React.ReactNode;
}

/**
 * QueryProvider - Provider React Query pour l'application
 * Wrappe l'application avec QueryClientProvider
 *
 * @example
 * ```tsx
 * <QueryProvider>
 *   <App />
 * </QueryProvider>
 * ```
 */
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Hook pour accéder au QueryClient depuis n'importe où dans l'application
 */
export function useQueryClient() {
  return queryClient;
}

/**
 * Hook pour invalider toutes les queries (utile après logout)
 */
export function useInvalidateQueries() {
  const client = useQueryClient();

  return React.useCallback(() => {
    client.invalidateQueries();
  }, [client]);
}

/**
 * Hook pour vider tout le cache (utile après logout complet)
 */
export function useClearQueryCache() {
  const client = useQueryClient();

  return React.useCallback(() => {
    client.clear();
  }, [client]);
}

export default QueryProvider;
