/**
 * useWebPush Hook
 *
 * Custom React hook for managing web push notifications.
 * Handles subscription, permissions, and integration with user preferences.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as WebPush from '../utils/web-push';

// ============================================
// TYPES
// ============================================

export interface WebPushState {
  isSupported: boolean;
  permission: WebPush.NotificationPermission;
  isSubscribed: boolean;
  subscription: WebPush.PushSubscription | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseWebPushOptions {
  /**
   * VAPID public key for push notifications
   */
  vapidPublicKey?: string;

  /**
   * Service worker registration
   */
  swRegistration: ServiceWorkerRegistration | null;

  /**
   * User ID for subscription tracking
   */
  userId?: string;

  /**
   * API base URL for server communication
   */
  apiBaseUrl?: string;

  /**
   * Auto-request permission on mount
   * @default false
   */
  autoRequest?: boolean;

  /**
   * Auto-subscribe on permission grant
   * @default false
   */
  autoSubscribe?: boolean;

  /**
   * Integrate with user notification preferences
   * @default true
   */
  usePreferences?: boolean;
}

export interface UseWebPushReturn extends WebPushState {
  requestPermission: () => Promise<WebPush.NotificationPermission>;
  subscribe: () => Promise<WebPush.PushSubscription | null>;
  unsubscribe: () => Promise<boolean>;
  showNotification: (title: string, options?: NotificationOptions) => void;
  refreshSubscription: () => Promise<void>;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useWebPush(options: UseWebPushOptions): UseWebPushReturn {
  const {
    vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || '',
    swRegistration,
    userId,
    apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || '',
    autoRequest = false,
    autoSubscribe = false,
    usePreferences = true,
  } = options;

  const [state, setState] = useState<WebPushState>({
    isSupported: WebPush.supportsPushNotifications(),
    permission: WebPush.getNotificationPermission(),
    isSubscribed: false,
    subscription: null,
    isLoading: false,
    error: null,
  });

  const isMountedRef = useRef(true);
  const initialCheckDoneRef = useRef(false);

  // Load subscription from service worker
  const loadSubscription = useCallback(async () => {
    if (!swRegistration || !state.isSupported) {
      return;
    }

    try {
      const subscription = await WebPush.getPushSubscription(swRegistration);

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          subscription,
          isSubscribed: subscription !== null,
        }));
      }
    } catch (error) {
      console.error('[useWebPush] Failed to load subscription:', error);
    }
  }, [swRegistration, state.isSupported]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<WebPush.NotificationPermission> => {
    if (!state.isSupported) {
      const error = 'Push notifications not supported';
      setState((prev) => ({ ...prev, error }));
      return 'denied';
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await WebPush.requestNotificationPermission();

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          permission,
          isLoading: false,
        }));
      }

      return permission;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return 'denied';
    }
  }, [state.isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<WebPush.PushSubscription | null> => {
    if (!swRegistration || !state.isSupported || !vapidPublicKey) {
      const error = !swRegistration
        ? 'Service worker not registered'
        : !state.isSupported
        ? 'Push notifications not supported'
        : 'VAPID public key not configured';

      setState((prev) => ({ ...prev, error }));
      return null;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission if not already granted
      if (state.permission !== 'granted') {
        const permission = await requestPermission();
        if (permission !== 'granted') {
          setState((prev) => ({ ...prev, isLoading: false }));
          return null;
        }
      }

      // Subscribe to push
      const subscription = await WebPush.subscribeToPush(vapidPublicKey, swRegistration);

      if (!subscription) {
        throw new Error('Failed to subscribe to push notifications');
      }

      // Send subscription to server
      if (userId && apiBaseUrl) {
        await WebPush.sendSubscriptionToServer(subscription, userId, apiBaseUrl);
      }

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          subscription,
          isSubscribed: true,
          isLoading: false,
          error: null,
        }));
      }

      return subscription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [swRegistration, state.isSupported, vapidPublicKey, state.permission, userId, apiBaseUrl, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!swRegistration) {
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Unsubscribe from push
      const result = await WebPush.unsubscribeFromPush(swRegistration);

      // Remove subscription from server
      if (state.subscription && apiBaseUrl) {
        await WebPush.removeSubscriptionFromServer(state.subscription.endpoint, apiBaseUrl);
      }

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          subscription: null,
          isSubscribed: false,
          isLoading: false,
          error: null,
        }));
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unsubscribe';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [swRegistration, state.subscription, apiBaseUrl]);

  // Show a local notification
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    WebPush.showLocalNotification(title, options);
  }, []);

  // Refresh subscription (check if still valid)
  const refreshSubscription = useCallback(async () => {
    await loadSubscription();
  }, [loadSubscription]);

  // ============================================
  // EFFECTS
  // ============================================

  // Initial permission and subscription check
  useEffect(() => {
    if (initialCheckDoneRef.current || !swRegistration) {
      return;
    }

    initialCheckDoneRef.current = true;

    // Update permission state
    const permission = WebPush.getNotificationPermission();
    setState((prev) => ({ ...prev, permission }));

    // Load existing subscription
    loadSubscription();

    // Auto-request permission if enabled
    if (autoRequest && permission === 'default') {
      requestPermission();
    }

    // Auto-subscribe if enabled and permission is granted
    if (autoSubscribe && permission === 'granted') {
      subscribe();
    }
  }, [swRegistration, autoRequest, autoSubscribe, loadSubscription, requestPermission, subscribe]);

  // Listen for permission changes
  useEffect(() => {
    const handlePermissionChange = () => {
      const permission = WebPush.getNotificationPermission();
      setState((prev) => ({ ...prev, permission }));

      // Auto-subscribe if permission was just granted
      if (permission === 'granted' && autoSubscribe && !state.isSubscribed) {
        subscribe();
      }
    };

    // Listen for permission changes (not directly available in browsers,
    // but we can check when the app regains focus)
    window.addEventListener('focus', handlePermissionChange);

    return () => {
      window.removeEventListener('focus', handlePermissionChange);
    };
  }, [autoSubscribe, state.isSubscribed, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================
  // RETURN VALUES
  // ============================================

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    refreshSubscription,
  };
}

// ============================================
// CONVENIENCE HOOKS
// ============================================

/**
 * Hook to check if push notifications are supported
 */
export function useWebPushSupport(): boolean {
  const [isSupported, setIsSupported] = useState(WebPush.supportsPushNotifications());

  useEffect(() => {
    setIsSupported(WebPush.supportsPushNotifications());
  }, []);

  return isSupported;
}

/**
 * Hook to get notification permission status
 */
export function useNotificationPermission(): WebPush.NotificationPermission {
  const [permission, setPermission] = useState(WebPush.getNotificationPermission());

  useEffect(() => {
    const updatePermission = () => {
      setPermission(WebPush.getNotificationPermission());
    };

    window.addEventListener('focus', updatePermission);

    return () => {
      window.removeEventListener('focus', updatePermission);
    };
  }, []);

  return permission;
}
