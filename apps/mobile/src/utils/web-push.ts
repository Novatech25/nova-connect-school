/**
 * Web Push Utilities
 *
 * Functions for managing web push notifications with browser support detection.
 */

// ============================================
// TYPES
// ============================================

export type NotificationPermission = 'default' | 'granted' | 'denied';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscription extends PushSubscriptionData {
  createdAt: number;
}

// ============================================
// SUPPORT DETECTION
// ============================================

/**
 * Check if the browser supports notifications
 */
export function supportsNotifications(): boolean {
  return 'Notification' in window;
}

/**
 * Check if the browser supports service workers
 */
export function supportsServiceWorker(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Check if the browser supports push notifications
 */
export function supportsPushNotifications(): boolean {
  return (
    supportsNotifications() &&
    supportsServiceWorker() &&
    'PushManager' in window &&
    'getKey' in PushSubscription.prototype
  );
}

/**
 * Check if the browser supports background sync
 */
export function supportsBackgroundSync(): boolean {
  return 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype;
}

// ============================================
// PERMISSION MANAGEMENT
// ============================================

/**
 * Get the current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!supportsNotifications()) {
    return 'denied';
  }

  return Notification.permission;
}

/**
 * Check if notification permission is granted
 */
export function isNotificationPermissionGranted(): boolean {
  return getNotificationPermission() === 'granted';
}

/**
 * Check if notification permission has been denied
 */
export function isNotificationPermissionDenied(): boolean {
  return getNotificationPermission() === 'denied';
}

/**
 * Check if notification permission is in default state (not requested yet)
 */
export function isNotificationPermissionDefault(): boolean {
  return getNotificationPermission() === 'default';
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!supportsNotifications()) {
    console.warn('[WebPush] Notifications not supported');
    return 'denied';
  }

  if (isNotificationPermissionDenied()) {
    console.warn('[WebPush] Notification permission already denied');
    return 'denied';
  }

  if (isNotificationPermissionGranted()) {
    console.log('[WebPush] Notification permission already granted');
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('[WebPush] Permission requested:', permission);
    return permission;
  } catch (error) {
    console.error('[WebPush] Failed to request permission:', error);
    return 'denied';
  }
}

// ============================================
// PUSH SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
  vapidPublicKey: string,
  swRegistration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  if (!supportsPushNotifications()) {
    console.warn('[WebPush] Push notifications not supported');
    return null;
  }

  if (!isNotificationPermissionGranted()) {
    console.warn('[WebPush] Notification permission not granted');
    return null;
  }

  try {
    // Convert VAPID key to Uint8Array
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });

    // Convert subscription to JSON format
    const subscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(subscription.getKey('auth')!),
      },
      createdAt: Date.now(),
    };

    console.log('[WebPush] Subscribed to push notifications');
    return subscriptionData;
  } catch (error) {
    console.error('[WebPush] Failed to subscribe:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
  swRegistration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await swRegistration.pushManager.getSubscription();

    if (!subscription) {
      console.log('[WebPush] No subscription found');
      return true;
    }

    const result = await subscription.unsubscribe();
    console.log('[WebPush] Unsubscribed from push notifications');
    return result;
  } catch (error) {
    console.error('[WebPush] Failed to unsubscribe:', error);
    return false;
  }
}

/**
 * Get the current push subscription
 */
export async function getPushSubscription(
  swRegistration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const subscription = await swRegistration.pushManager.getSubscription();

    if (!subscription) {
      return null;
    }

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(subscription.getKey('auth')!),
      },
      createdAt: Date.now(), // We don't have the exact creation time
    };
  } catch (error) {
    console.error('[WebPush] Failed to get subscription:', error);
    return null;
  }
}

/**
 * Check if the user is currently subscribed
 */
export async function isSubscribedToPush(swRegistration: ServiceWorkerRegistration): Promise<boolean> {
  const subscription = await getPushSubscription(swRegistration);
  return subscription !== null;
}

// ============================================
// SERVER INTEGRATION
// ============================================

/**
 * Send subscription to backend server
 */
export async function sendSubscriptionToServer(
  subscription: PushSubscription,
  userId: string,
  apiBaseUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        created_at: new Date(subscription.createdAt).toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('[WebPush] Subscription sent to server');
    return true;
  } catch (error) {
    console.error('[WebPush] Failed to send subscription to server:', error);
    return false;
  }
}

/**
 * Remove subscription from backend server
 */
export async function removeSubscriptionFromServer(
  endpoint: string,
  apiBaseUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('[WebPush] Subscription removed from server');
    return true;
  } catch (error) {
    console.error('[WebPush] Failed to remove subscription from server:', error);
    return false;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
}

/**
 * Get auth token from storage (placeholder - implement with your auth system)
 */
async function getAuthToken(): Promise<string> {
  // TODO: Implement with your auth system
  // For example, get token from localStorage or secure storage
  const token = localStorage.getItem('auth_token');
  return token || '';
}

// ============================================
// LOCAL NOTIFICATIONS (FALLBACK)
// ============================================

/**
 * Show a local notification (fallback when push is not supported)
 */
export function showLocalNotification(title: string, options?: NotificationOptions): void {
  if (!supportsNotifications() || !isNotificationPermissionGranted()) {
    console.warn('[WebPush] Cannot show local notification');
    return;
  }

  try {
    new Notification(title, {
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      ...options,
    });
  } catch (error) {
    console.error('[WebPush] Failed to show local notification:', error);
  }
}

/**
 * Show a notification with actions
 */
export function showNotificationWithActions(
  title: string,
  body: string,
  actions: Array<{
    action: string;
    title: string;
    icon?: string;
  }>,
  data?: any
): void {
  if (!supportsNotifications() || !isNotificationPermissionGranted()) {
    console.warn('[WebPush] Cannot show notification with actions');
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      tag: 'novaconnect-notification',
      renotify: true,
      actions,
      data,
    });

    // Handle notification clicks
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.error('[WebPush] Failed to show notification with actions:', error);
  }
}

// ============================================
// EXPORTS
// ============================================

export const WebPush = {
  supportsNotifications,
  supportsServiceWorker,
  supportsPushNotifications,
  supportsBackgroundSync,
  getNotificationPermission,
  isNotificationPermissionGranted,
  isNotificationPermissionDenied,
  isNotificationPermissionDefault,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscription,
  isSubscribedToPush,
  sendSubscriptionToServer,
  removeSubscriptionFromServer,
  showLocalNotification,
  showNotificationWithActions,
};
