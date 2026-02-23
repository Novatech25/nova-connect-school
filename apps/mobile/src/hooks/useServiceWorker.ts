/**
 * useServiceWorker Hook
 *
 * Custom React hook for managing Service Worker lifecycle and communication.
 * Integrates with the SWMessaging module for bidirectional communication.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as SWMessaging from '../service-worker/sw-messaging';

// ============================================
// TYPES
// ============================================

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isReady: boolean;
  registration: ServiceWorkerRegistration | null;
  swVersion: string | null;
  updateAvailable: boolean;
  controllerChanged: boolean;
}

export interface QueueStats {
  count: number;
  entries: Array<{
    url: string;
    method: string;
    timestamp: number;
  }>;
}

export interface UseServiceWorkerReturn extends ServiceWorkerState {
  register: (scriptURL?: string) => Promise<void>;
  unregister: () => Promise<boolean>;
  sendMessage: <T = any>(type: SWMessaging.AppToSWMessageType, payload?: any) => Promise<T>;
  getQueueStats: () => Promise<QueueStats>;
  syncNow: () => Promise<void>;
  clearCache: () => Promise<void>;
  skipWaiting: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: SWMessaging.isServiceWorkerSupported(),
    isRegistered: false,
    isReady: false,
    registration: null,
    swVersion: null,
    updateAvailable: false,
    controllerChanged: false,
  });

  const cleanupMessageListenerRef = useRef<(() => void) | null>(null);

  // Register the Service Worker
  const register = useCallback(async (scriptURL: string = '/service-worker.js') => {
    if (!state.isSupported) {
      console.warn('[useServiceWorker] Service Worker not supported');
      return;
    }

    try {
      console.log('[useServiceWorker] Registering Service Worker...');

      const registration = await navigator.serviceWorker.register(scriptURL, {
        scope: '/',
      });

      console.log('[useServiceWorker] Service Worker registered:', registration);

      setState((prev) => ({
        ...prev,
        isRegistered: true,
        registration,
      }));

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;

      setState((prev) => ({
        ...prev,
        isReady: true,
      }));

      console.log('[useServiceWorker] Service Worker ready');

      // Set up message listener
      if (!cleanupMessageListenerRef.current) {
        const cleanup = SWMessaging.initSWMessageListener();
        cleanupMessageListenerRef.current = cleanup;
      }

      // Listen for service worker updates
      setupUpdateListeners(registration);
    } catch (error) {
      console.error('[useServiceWorker] Registration failed:', error);

      setState((prev) => ({
        ...prev,
        isRegistered: false,
        isReady: false,
      }));
    }
  }, [state.isSupported]);

  // Unregister the Service Worker
  const unregister = useCallback(async () => {
    if (!state.registration) {
      console.warn('[useServiceWorker] No Service Worker to unregister');
      return false;
    }

    try {
      const result = await state.registration.unregister();
      console.log('[useServiceWorker] Unregister result:', result);

      setState((prev) => ({
        ...prev,
        isRegistered: false,
        isReady: false,
        registration: null,
      }));

      return result;
    } catch (error) {
      console.error('[useServiceWorker] Unregister failed:', error);
      return false;
    }
  }, [state.registration]);

  // Send a message to the Service Worker
  const sendMessage = useCallback(async <T = any>(
    type: SWMessaging.AppToSWMessageType,
    payload?: any
  ): Promise<T> => {
    if (!state.isReady) {
      throw new Error('Service Worker not ready');
    }

    return SWMessaging.sendMessageToSW<T>(type, payload);
  }, [state.isReady]);

  // Get queue statistics from Service Worker
  const getQueueStats = useCallback(async (): Promise<QueueStats> => {
    if (!state.isReady) {
      throw new Error('Service Worker not ready');
    }

    return SWMessaging.getQueueStats();
  }, [state.isReady]);

  // Trigger immediate synchronization
  const syncNow = useCallback(async () => {
    if (!state.isReady) {
      console.warn('[useServiceWorker] Service Worker not ready, cannot sync');
      return;
    }

    await SWMessaging.syncNow();
  }, [state.isReady]);

  // Clear all Service Worker caches
  const clearCache = useCallback(async () => {
    if (!state.isReady) {
      throw new Error('Service Worker not ready');
    }

    await SWMessaging.clearCache();
  }, [state.isReady]);

  // Skip waiting for the new Service Worker to activate
  const skipWaiting = useCallback(async () => {
    if (!state.isReady) {
      throw new Error('Service Worker not ready');
    }

    await SWMessaging.skipWaiting();
  }, [state.isReady]);

  // Check for Service Worker updates
  const checkForUpdates = useCallback(async () => {
    if (!state.registration) {
      console.warn('[useServiceWorker] No Service Worker registration');
      return;
    }

    try {
      await state.registration.update();
      console.log('[useServiceWorker] Update check completed');
    } catch (error) {
      console.error('[useServiceWorker] Update check failed:', error);
    }
  }, [state.registration]);

  // Set up listeners for Service Worker updates
  const setupUpdateListeners = useCallback((registration: ServiceWorkerRegistration) => {
    // Listen for updatefound event
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // A new service worker is available
            console.log('[useServiceWorker] New version available');
            setState((prev) => ({ ...prev, updateAvailable: true }));
          }
        });
      }
    });

    // Listen for controllerchange event
    const handleControllerChange = () => {
      console.log('[useServiceWorker] Controller changed, reloading...');
      setState((prev) => ({ ...prev, controllerChanged: true }));

      // Reload the page to activate the new service worker
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
  }, []);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    // Register Service Worker on mount
    if (state.isSupported && !state.isRegistered) {
      register();
    }

    // Cleanup on unmount
    return () => {
      if (cleanupMessageListenerRef.current) {
        cleanupMessageListenerRef.current();
        cleanupMessageListenerRef.current = null;
      }
    };
  }, [state.isSupported, state.isRegistered, register]);

  // Listen for update available messages from Service Worker
  useEffect(() => {
    const cleanup = SWMessaging.onUpdateAvailable(() => {
      console.log('[useServiceWorker] Update available (via message)');
      setState((prev) => ({ ...prev, updateAvailable: true }));
    });

    return cleanup;
  }, []);

  // ============================================
  // RETURN VALUES
  // ============================================

  return {
    ...state,
    register,
    unregister,
    sendMessage,
    getQueueStats,
    syncNow,
    clearCache,
    skipWaiting,
    checkForUpdates,
  };
}

// ============================================
// CONVENIENCE HOOKS FOR SPECIFIC FUNCTIONALITY
// ============================================

/**
 * Hook to listen for sync complete events
 */
export function useSyncComplete(handler: (payload: SWMessaging.SyncCompletePayload) => void) {
  useEffect(() => {
    const cleanup = SWMessaging.onSyncComplete(handler);
    return cleanup;
  }, [handler]);
}

/**
 * Hook to listen for sync failed events
 */
export function useSyncFailed(handler: (payload: SWMessaging.SyncFailedPayload) => void) {
  useEffect(() => {
    const cleanup = SWMessaging.onSyncFailed(handler);
    return cleanup;
  }, [handler]);
}

/**
 * Hook to listen for queue updated events
 */
export function useQueueUpdated(handler: (payload: SWMessaging.QueueUpdatedPayload) => void) {
  useEffect(() => {
    const cleanup = SWMessaging.onQueueUpdated(handler);
    return cleanup;
  }, [handler]);
}
