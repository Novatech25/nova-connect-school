/**
 * Service Worker Messaging System
 *
 * This module handles bidirectional communication between the React app
 * and the Service Worker using postMessage and MessageChannel.
 */

// ============================================
// TYPES
// ============================================

/**
 * Message types that can be sent from App to SW
 */
export type AppToSWMessageType =
  | 'SKIP_WAITING'
  | 'CLEAR_CACHE'
  | 'GET_QUEUE_STATS'
  | 'SYNC_NOW'
  | 'GET_VERSION';

/**
 * Message types that can be sent from SW to App
 */
export type SWToAppMessageType =
  | 'SYNC_COMPLETE'
  | 'SYNC_FAILED'
  | 'UPDATE_AVAILABLE'
  | 'QUEUE_UPDATED'
  | 'CONTROLLER_CHANGE';

/**
 * Base message structure
 */
export interface BaseMessage<T = any> {
  type: string;
  payload?: T;
  timestamp: number;
}

/**
 * Message from App to Service Worker
 */
export interface AppToSWMessage<T = any> extends BaseMessage<T> {
  type: AppToSWMessageType;
}

/**
 * Message from Service Worker to App
 */
export interface SWToAppMessage<T = any> extends BaseMessage<T> {
  type: SWToAppMessageType;
}

// ============================================
// PAYLOAD TYPES
// ============================================

export interface QueueStatsPayload {
  count: number;
  entries: Array<{
    url: string;
    method: string;
    timestamp: number;
  }>;
}

export interface QueueUpdatedPayload {
  url: string;
  method: string;
  timestamp: number;
}

export interface SyncCompletePayload {
  operationsProcessed: number;
  operationsFailed: number;
  timestamp: number;
}

export interface SyncFailedPayload {
  error: string;
  timestamp: number;
}

// ============================================
// APP → SERVICE WORKER MESSAGING
// ============================================

/**
 * Send a message to the Service Worker and wait for a response
 */
export async function sendMessageToSW<T = any>(
  type: AppToSWMessageType,
  payload?: any,
  timeout: number = 5000
): Promise<T> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }

  const registration = await navigator.serviceWorker.ready;

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();

    const timeoutId = setTimeout(() => {
      messageChannel.port1.close();
      reject(new Error(`Message timeout: ${type}`));
    }, timeout);

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timeoutId);
      messageChannel.port1.close();

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data);
      }
    };

    registration.active?.postMessage(
      {
        type,
        payload,
        timestamp: Date.now(),
      },
      [messageChannel.port2]
    );
  });
}

/**
 * Skip waiting for the new Service Worker to activate
 */
export async function skipWaiting(): Promise<void> {
  await sendMessageToSW('SKIP_WAITING');
}

/**
 * Clear all Service Worker caches
 */
export async function clearCache(): Promise<void> {
  await sendMessageToSW('CLEAR_CACHE');
}

/**
 * Get statistics about the offline queue
 */
export async function getQueueStats(): Promise<QueueStatsPayload> {
  return sendMessageToSW<QueueStatsPayload>('GET_QUEUE_STATS');
}

/**
 * Trigger immediate synchronization
 */
export async function syncNow(): Promise<void> {
  await sendMessageToSW('SYNC_NOW');
}

/**
 * Get the Service Worker version
 */
export async function getSWVersion(): Promise<string> {
  return sendMessageToSW<string>('GET_VERSION');
}

// ============================================
// SERVICE WORKER → APP MESSAGING
// ============================================

/**
 * Message handler callback type
 */
export type MessageHandler<T = any> = (message: SWToAppMessage<T>) => void;

/**
 * Message handlers registry
 */
const messageHandlers: Map<SWToAppMessageType, Set<MessageHandler>> = new Map();

/**
 * Register a message handler for a specific message type
 */
export function onSWMessage<T = any>(
  type: SWToAppMessageType,
  handler: MessageHandler<T>
): () => void {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, new Set());
  }

  messageHandlers.get(type)!.add(handler);

  // Return cleanup function
  return () => {
    const handlers = messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        messageHandlers.delete(type);
      }
    }
  };
}

/**
 * Handle incoming messages from Service Worker
 */
export function handleSWMessage(event: MessageEvent): void {
  const message = event.data as SWToAppMessage;

  if (!message || !message.type) {
    return;
  }

  const handlers = messageHandlers.get(message.type as SWToAppMessageType);
  if (handlers) {
    handlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error(`[SW Messaging] Error handling ${message.type}:`, error);
      }
    });
  }
}

/**
 * Initialize Service Worker message listener
 */
export function initSWMessageListener(): () => void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }

  return () => {};
}

// ============================================
// CONVENIENCE HOOKS FOR SPECIFIC MESSAGES
// ============================================

/**
 * Listen for sync complete events
 */
export function onSyncComplete(handler: (payload: SyncCompletePayload) => void): () => void {
  return onSWMessage<SyncCompletePayload>('SYNC_COMPLETE', (message) => {
    handler(message.payload!);
  });
}

/**
 * Listen for sync failed events
 */
export function onSyncFailed(handler: (payload: SyncFailedPayload) => void): () => void {
  return onSWMessage<SyncFailedPayload>('SYNC_FAILED', (message) => {
    handler(message.payload!);
  });
}

/**
 * Listen for update available events
 */
export function onUpdateAvailable(handler: () => void): () => void {
  return onSWMessage('UPDATE_AVAILABLE', () => {
    handler();
  });
}

/**
 * Listen for queue updated events
 */
export function onQueueUpdated(handler: (payload: QueueUpdatedPayload) => void): () => void {
  return onSWMessage<QueueUpdatedPayload>('QUEUE_UPDATED', (message) => {
    handler(message.payload!);
  });
}

/**
 * Listen for controller change events
 */
export function onControllerChange(handler: () => void): () => void {
  return onSWMessage('CONTROLLER_CHANGE', () => {
    handler();
  });
}

// ============================================
// BATCH NOTIFICATIONS
// ============================================

/**
 * Notify all listeners of a message (for testing purposes)
 */
export function notifyListeners<T = any>(
  type: SWToAppMessageType,
  payload?: T
): void {
  const message: SWToAppMessage<T> = {
    type,
    payload,
    timestamp: Date.now(),
  };

  const handlers = messageHandlers.get(type);
  if (handlers) {
    handlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error(`[SW Messaging] Error notifying ${type}:`, error);
      }
    });
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if Service Worker is supported
 */
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Check if Service Worker is registered
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  return registration !== undefined;
}

/**
 * Get current Service Worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    return await navigator.serviceWorker.getRegistration();
  } catch (error) {
    console.error('[SW Messaging] Failed to get registration:', error);
    return null;
  }
}

/**
 * Get current Service Worker instance
 */
export async function getServiceWorker(): Promise<ServiceWorker | null> {
  const registration = await getServiceWorkerRegistration();
  return registration?.active || registration?.installing || registration?.waiting || null;
}

// Export messaging API
export const SWMessaging = {
  sendMessage: sendMessageToSW,
  skipWaiting,
  clearCache,
  getQueueStats,
  syncNow,
  getSWVersion,
  onMessage: onSWMessage,
  onSyncComplete,
  onSyncFailed,
  onUpdateAvailable,
  onQueueUpdated,
  onControllerChange,
  initListener: initSWMessageListener,
  isSupported: isServiceWorkerSupported,
  isRegistered: isServiceWorkerRegistered,
  getRegistration: getServiceWorkerRegistration,
  getServiceWorker,
};
