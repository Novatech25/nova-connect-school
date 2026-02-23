/**
 * PWA Configuration
 *
 * Centralized configuration for Progressive Web App features.
 * Reads environment variables and provides constants for use throughout the app.
 */

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

export const PWA_ENABLED = process.env.EXPO_PUBLIC_PWA_ENABLED === 'true';
export const SW_UPDATE_INTERVAL = parseInt(process.env.EXPO_PUBLIC_SW_UPDATE_INTERVAL || '3600000', 10);
export const CACHE_VERSION = process.env.EXPO_PUBLIC_CACHE_VERSION || '1.0.0';
export const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || '';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.novaconnect.fr';

// ============================================
// CACHE NAMES
// ============================================

export const CACHE_NAMES = {
  STATIC: `novaconnect-static-v${CACHE_VERSION}`,
  DYNAMIC: `novaconnect-dynamic-v${CACHE_VERSION}`,
  API: `novaconnect-api-v${CACHE_VERSION}`,
  IMAGES: `novaconnect-images-v${CACHE_VERSION}`,
} as const;

// ============================================
// SERVICE WORKER SETTINGS
// ============================================

export const SW_CONFIG = {
  /**
   * Service worker script URL
   */
  SCRIPT_URL: '/service-worker.js',

  /**
   * Service worker scope
   */
  SCOPE: '/',

  /**
   * Update check interval (milliseconds)
   */
  UPDATE_INTERVAL: SW_UPDATE_INTERVAL,

  /**
   * Maximum number of retry attempts for failed sync operations
   */
  MAX_SYNC_RETRIES: 5,

  /**
   * Backoff intervals for sync retries (in milliseconds)
   */
  SYNC_RETRY_BACKOFF: [1000, 5000, 15000, 30000, 60000],
} as const;

// ============================================
// CACHE SETTINGS
// ============================================

export const CACHE_CONFIG = {
  /**
   * Maximum age for static assets (seconds)
   */
  STATIC_MAX_AGE: 60 * 60 * 24 * 7, // 7 days

  /**
   * Maximum age for dynamic content (seconds)
   */
  DYNAMIC_MAX_AGE: 60 * 60 * 2, // 2 hours

  /**
   * Maximum age for API responses (seconds)
   */
  API_MAX_AGE: 60 * 60, // 1 hour

  /**
   * Maximum age for images (seconds)
   */
  IMAGE_MAX_AGE: 60 * 60 * 24 * 60, // 60 days

  /**
   * Maximum entries per cache
   */
  MAX_CACHE_ENTRIES: {
    STATIC: 100,
    DYNAMIC: 50,
    API: 200,
    IMAGES: 100,
  },
} as const;

// ============================================
// OFFLINE QUEUE SETTINGS
// ============================================

export const OFFLINE_QUEUE_CONFIG = {
  /**
   * IndexedDB database name
   */
  DB_NAME: 'NovaConnectOfflineQueue',

  /**
   * IndexedDB database version
   */
  DB_VERSION: 1,

  /**
   * Object store name for operations
   */
  STORE_NAME: 'operations',

  /**
   * Maximum number of operations to keep in queue
   */
  MAX_QUEUE_SIZE: 1000,

  /**
   * Maximum age for queued operations (milliseconds)
   * Operations older than this will be discarded
   */
  MAX_OPERATION_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days

  /**
   * Sync interval for automatic synchronization (milliseconds)
   */
  SYNC_INTERVAL: 30000, // 30 seconds

  /**
   * Whether to enable automatic sync on connection restoration
   */
  AUTO_SYNC_ON_CONNECT: true,
} as const;

// ============================================
// PUSH NOTIFICATION SETTINGS
// ============================================

export const PUSH_CONFIG = {
  /**
   * VAPID public key for web push
   */
  VAPID_PUBLIC_KEY,

  /**
   * Push notification endpoint on backend
   */
  PUSH_ENDPOINT: `${API_URL}/rest/v1/push_subscriptions`,

  /**
   * Whether to automatically request permission
   */
  AUTO_REQUEST_PERMISSION: false,

  /**
   * Whether to automatically subscribe after permission grant
   */
  AUTO_SUBSCRIBE: false,

  /**
   * Notification categories
   */
  CATEGORIES: {
    ATTENDANCE: 'attendance',
    GRADES: 'grades',
    HOMEWORK: 'homework',
    SCHEDULE: 'schedule',
    NOTIFICATIONS: 'notifications',
    PAYMENTS: 'payments',
  },
} as const;

// ============================================
// INSTALL PROMPT SETTINGS
// ============================================

export const INSTALL_PROMPT_CONFIG = {
  /**
   * Delay before showing install prompt (milliseconds)
   */
  SHOW_DELAY: 2000,

  /**
   * Number of days to wait before re-prompting after dismissal
   */
  DISMISSAL_DAYS: 7,

  /**
   * Local storage key for dismissal timestamp
   */
  DISMISSAL_STORAGE_KEY: 'pwa-install-prompt-dismissed',

  /**
   * Whether to auto-show the prompt
   */
  AUTO_SHOW: true,
} as const;

// ============================================
// UPDATE NOTIFICATION SETTINGS
// ============================================

export const UPDATE_NOTIFICATION_CONFIG = {
  /**
   * Whether to automatically reload after update
   */
  AUTO_RELOAD: true,

  /**
   * Delay before auto-reload (milliseconds)
   */
  AUTO_RELOAD_DELAY: 3000,

  /**
   * Whether to show the notification
   */
  AUTO_SHOW: true,
} as const;

// ============================================
// OFFLINE INDICATOR SETTINGS
// ============================================

export const OFFLINE_INDICATOR_CONFIG = {
  /**
   * Whether to show the indicator automatically
   */
  AUTO_SHOW: true,

  /**
   * Interval to refresh queue stats (milliseconds)
   */
  STATS_REFRESH_INTERVAL: 5000,

  /**
   * Whether to use queue stats
   */
  USE_QUEUE_STATS: true,
} as const;

// ============================================
// PERFORMANCE SETTINGS
// ============================================

export const PERFORMANCE_CONFIG = {
  /**
   * Network timeout for API calls (seconds)
   */
  NETWORK_TIMEOUT: 5,

  /**
   * Idle timeout for preloading resources (milliseconds)
   */
  IDLE_TIMEOUT: 3000,

  /**
   * Maximum concurrent sync operations
   */
  MAX_CONCURRENT_SYNC: 5,

  /**
   * Batch size for sync operations
   */
  SYNC_BATCH_SIZE: 10,
} as const;

// ============================================
// DEBUGGING SETTINGS
// ============================================

export const DEBUG_CONFIG = {
  /**
   * Enable debug logging
   */
  ENABLED: process.env.EXPO_PUBLIC_DEBUG_MODE === 'true',

  /**
   * Log levels
   */
  LEVELS: {
    SERVICE_WORKER: 'Service Worker',
    OFFLINE_QUEUE: 'Offline Queue',
    CACHE: 'Cache',
    PUSH: 'Push Notifications',
    SYNC: 'Background Sync',
  },

  /**
   * Log prefix
   */
  PREFIX: '[NovaConnect PWA]',
} as const;

// ============================================
// EXPORTS
// ============================================

export const PWA_CONFIG = {
  PWA_ENABLED,
  CACHE_VERSION,
  API_URL,
  CACHE_NAMES,
  SW_CONFIG,
  CACHE_CONFIG,
  OFFLINE_QUEUE_CONFIG,
  PUSH_CONFIG,
  INSTALL_PROMPT_CONFIG,
  UPDATE_NOTIFICATION_CONFIG,
  OFFLINE_INDICATOR_CONFIG,
  PERFORMANCE_CONFIG,
  DEBUG_CONFIG,
} as const;

// Helper function to log debug messages
export function debugLog(category: string, message: string, ...args: any[]) {
  if (DEBUG_CONFIG.ENABLED) {
    console.log(`${DEBUG_CONFIG.PREFIX} [${DEBUG_CONFIG.LEVELS[category] || category}]`, message, ...args);
  }
}

// Helper function to check if PWA is enabled
export function isPWAEnabled(): boolean {
  return PWA_ENABLED && typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

// Helper function to get VAPID key
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

// Helper function to get cache name with version
export function getCacheName(type: keyof typeof CACHE_NAMES): string {
  return CACHE_NAMES[type];
}
