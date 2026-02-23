/**
 * usePWA Hook
 *
 * Custom React hook for managing Progressive Web App functionality:
 * - Installation detection and prompting
 * - Update management
 * - Offline status detection
 * - Service Worker registration status
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// TYPES
// ============================================

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  isOffline: boolean;
  swRegistration: ServiceWorkerRegistration | null;
  installPrompt: BeforeInstallPromptEvent | null;
}

export interface UsePWAReturn extends PWAState {
  installPWA: () => Promise<void>;
  updatePWA: () => Promise<void>;
  skipWaiting: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function usePWA(): UsePWAReturn {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isUpdateAvailable: false,
    isOffline: !navigator.onLine,
    swRegistration: null,
    installPrompt: null,
  });

  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // Check if app is already installed (running in standalone mode)
  const checkIsInstalled = useCallback(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    return isStandalone;
  }, []);

  // Check if app is installable
  const checkIsInstallable = useCallback(() => {
    return state.installPrompt !== null;
  }, [state.installPrompt]);

  // Install the PWA
  const installPWA = useCallback(async () => {
    if (!state.installPrompt) {
      console.warn('[usePWA] No install prompt available');
      return;
    }

    try {
      // Show the installation prompt
      state.installPrompt.prompt();

      // Wait for user choice
      const { outcome } = await state.installPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[usePWA] PWA installation accepted');
        setState((prev) => ({
          ...prev,
          isInstalled: true,
          installPrompt: null,
        }));
      } else {
        console.log('[usePWA] PWA installation dismissed');
      }

      // Clear the prompt (it can only be used once)
      installPromptRef.current = null;
      setState((prev) => ({ ...prev, installPrompt: null }));
    } catch (error) {
      console.error('[usePWA] Installation failed:', error);
    }
  }, [state.installPrompt]);

  // Update the PWA (reload to activate new service worker)
  const updatePWA = useCallback(async () => {
    if (!state.swRegistration) {
      console.warn('[usePWA] No service worker registration');
      return;
    }

    try {
      // Skip waiting for the new service worker to activate
      if (state.swRegistration.waiting) {
        state.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // The page will reload automatically when the new service worker activates
      // (handled by the 'controllerchange' event)
    } catch (error) {
      console.error('[usePWA] Update failed:', error);
    }
  }, [state.swRegistration]);

  // Skip waiting for the new service worker
  const skipWaiting = useCallback(async () => {
    await updatePWA();
  }, [updatePWA]);

  // Check for service worker updates
  const checkForUpdates = useCallback(async () => {
    if (!state.swRegistration) {
      return;
    }

    try {
      await state.swRegistration.update();
    } catch (error) {
      console.error('[usePWA] Update check failed:', error);
    }
  }, [state.swRegistration]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    // Guard: only run on web platform
    if (typeof window === 'undefined') {
      return;
    }

    // Check initial installation status
    const isInstalled = checkIsInstalled();
    setState((prev) => ({ ...prev, isInstalled }));

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;

      installPromptRef.current = promptEvent;
      setState((prev) => ({
        ...prev,
        isInstallable: true,
        installPrompt: promptEvent,
      }));

      console.log('[usePWA] Install prompt detected');
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('[usePWA] App installed successfully');
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
        installPrompt: null,
      }));
      installPromptRef.current = null;
    };

    // Register event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [checkIsInstalled]);

  useEffect(() => {
    // Guard: only run on web platform
    if (typeof window === 'undefined') {
      return;
    }

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('[usePWA] Connection restored');
      setState((prev) => ({ ...prev, isOffline: false }));
    };

    const handleOffline = () => {
      console.log('[usePWA] Connection lost');
      setState((prev) => ({ ...prev, isOffline: true }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ============================================
  // RETURN VALUES
  // ============================================

  return {
    ...state,
    installPWA,
    updatePWA,
    skipWaiting,
    checkForUpdates,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if the browser supports PWA installation
 */
export function supportsPWAInstallation(): boolean {
  return 'beforeinstallprompt' in window;
}

/**
 * Check if the browser supports service workers
 */
export function supportsServiceWorker(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Get the PWA display mode
 */
export function getDisplayMode(): 'standalone' | 'minimal-ui' | 'browser' {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;

  if (isStandalone) return 'standalone';
  if (isMinimalUI) return 'minimal-ui';
  return 'browser';
}

/**
 * Check if the app is running as a PWA
 */
export function isRunningAsPWA(): boolean {
  const displayMode = getDisplayMode();
  return displayMode === 'standalone' || displayMode === 'minimal-ui';
}

/**
 * Get the installation source (if available)
 */
export function getInstallationSource(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('source');
}

/**
 * Check if the app was installed as a PWA
 */
export function isInstalledPWA(): boolean {
  return getInstallationSource() === 'pwa' || isRunningAsPWA();
}

/**
 * Deferred prompt for PWA installation
 * This allows showing a custom install prompt
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }

  interface Navigator {
    standalone?: boolean;
  }
}
