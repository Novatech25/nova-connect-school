/**
 * Cache Modules
 *
 * Defines cache configurations and sync strategies for each functional module.
 * Used by the Service Worker for offline data management.
 */

import { QueuedOperation } from './sw-wrapper';

// ============================================
// TYPES
// ============================================

export interface CacheModuleConfig {
  name: string;
  routes: string[];
  apiPatterns: RegExp[];
  cacheStrategy: 'cache-first' | 'network-first' | 'network-only';
  maxAge: number; // in seconds
  maxEntries: number;
  syncable: boolean;
  prefetchOnInstall: boolean;
  backgroundSync: boolean;
}

// ============================================
// MODULE CONFIGURATIONS
// ============================================

/**
 * Attendance Module Configuration
 *
 * Caches: class lists, student lists, daily sessions
 * Strategy: Network-first with 1h cache
 * Sync: Offline queue for attendance marking
 */
export const ATTENDANCE_MODULE: CacheModuleConfig = {
  name: 'attendance',
  routes: ['/attendance', '/attendance-scan', '/students', '/classes'],
  apiPatterns: [
    /\/api\/attendance/,
    /\/api\/classes/,
    /\/api\/students/,
    /\/rest\/v1\/attendance/,
    /\/rest\/v1\/classes/,
    /\/rest\/v1\/students/,
  ],
  cacheStrategy: 'network-first',
  maxAge: 3600, // 1 hour
  maxEntries: 50,
  syncable: true,
  prefetchOnInstall: true,
  backgroundSync: true,
};

/**
 * Grades Module Configuration
 *
 * Caches: grade grids, periods, subjects
 * Strategy: Network-first with 30min cache
 * Sync: Offline queue for grade entry
 */
export const GRADES_MODULE: CacheModuleConfig = {
  name: 'grades',
  routes: ['/grades', '/report-cards', '/student-card'],
  apiPatterns: [
    /\/api\/grades/,
    /\/api\/report-cards/,
    /\/api\/subjects/,
    /\/api\/periods/,
    /\/rest\/v1\/grades/,
    /\/rest\/v1\/report-cards/,
  ],
  cacheStrategy: 'network-first',
  maxAge: 1800, // 30 minutes
  maxEntries: 100,
  syncable: true,
  prefetchOnInstall: true,
  backgroundSync: true,
};

/**
 * Schedule (EDT) Module Configuration
 *
 * Caches: current week schedules
 * Strategy: Cache-first with daily revalidation
 * Sync: Auto-pull every Monday
 */
export const SCHEDULE_MODULE: CacheModuleConfig = {
  name: 'schedule',
  routes: ['/schedule', '/events'],
  apiPatterns: [
    /\/api\/schedule/,
    /\/api\/events/,
    /\/api\/calendar/,
    /\/rest\/v1\/schedule/,
    /\/rest\/v1\/events/,
  ],
  cacheStrategy: 'cache-first',
  maxAge: 43200, // 12 hours
  maxEntries: 20,
  syncable: false,
  prefetchOnInstall: true,
  backgroundSync: false,
};

/**
 * Lesson Log (Cahier de texte) Module Configuration
 *
 * Caches: planned sessions, homework
 * Strategy: Network-first with 2h cache
 * Sync: Offline queue for lesson log + document uploads
 */
export const LESSON_LOG_MODULE: CacheModuleConfig = {
  name: 'lesson-log',
  routes: ['/lesson-log', '/homework'],
  apiPatterns: [
    /\/api\/lesson-log/,
    /\/api\/homework/,
    /\/api\/sessions/,
    /\/rest\/v1\/lesson_log/,
    /\/rest\/v1\/homework/,
    /\/rest\/v1\/sessions/,
  ],
  cacheStrategy: 'network-first',
  maxAge: 7200, // 2 hours
  maxEntries: 100,
  syncable: true,
  prefetchOnInstall: true,
  backgroundSync: true,
};

/**
 * Notifications Module Configuration
 *
 * Caches: notification list
 * Strategy: Network-first with 5min cache
 * Sync: Real-time via WebSocket/Supabase subscription
 */
export const NOTIFICATIONS_MODULE: CacheModuleConfig = {
  name: 'notifications',
  routes: ['/notifications'],
  apiPatterns: [
    /\/api\/notifications/,
    /\/rest\/v1\/notifications/,
  ],
  cacheStrategy: 'network-first',
  maxAge: 300, // 5 minutes
  maxEntries: 100,
  syncable: false,
  prefetchOnInstall: false,
  backgroundSync: false,
};

/**
 * Payments Module Configuration
 *
 * Caches: None (sensitive data)
 * Strategy: Network-only
 * Sync: Offline queue for payment registration (with strict server validation)
 */
export const PAYMENTS_MODULE: CacheModuleConfig = {
  name: 'payments',
  routes: ['/payments', '/invoices'],
  apiPatterns: [
    /\/api\/payments/,
    /\/api\/invoices/,
    /\/rest\/v1\/payments/,
    /\/rest\/v1\/invoices/,
  ],
  cacheStrategy: 'network-only',
  maxAge: 0,
  maxEntries: 0,
  syncable: true,
  prefetchOnInstall: false,
  backgroundSync: true,
};

/**
 * Profile Module Configuration
 *
 * Caches: user profile, settings
 * Strategy: Network-first with 1h cache
 * Sync: Offline queue for profile updates
 */
export const PROFILE_MODULE: CacheModuleConfig = {
  name: 'profile',
  routes: ['/profile', '/settings'],
  apiPatterns: [
    /\/api\/profile/,
    /\/api\/settings/,
    /\/api\/preferences/,
    /\/rest\/v1\/profile/,
    /\/rest\/v1\/settings/,
    /\/rest\/v1\/preferences/,
  ],
  cacheStrategy: 'network-first',
  maxAge: 3600, // 1 hour
  maxEntries: 20,
  syncable: true,
  prefetchOnInstall: true,
  backgroundSync: false,
};

// ============================================
// MODULE REGISTRY
// ============================================

export const CACHE_MODULES: CacheModuleConfig[] = [
  ATTENDANCE_MODULE,
  GRADES_MODULE,
  SCHEDULE_MODULE,
  LESSON_LOG_MODULE,
  NOTIFICATIONS_MODULE,
  PAYMENTS_MODULE,
  PROFILE_MODULE,
];

// ============================================
// MODULE LOOKUP FUNCTIONS
// ============================================

/**
 * Get module configuration by name
 */
export function getModuleConfig(moduleName: string): CacheModuleConfig | undefined {
  return CACHE_MODULES.find((module) => module.name === moduleName);
}

/**
 * Get module configuration for a given route
 */
export function getModuleForRoute(route: string): CacheModuleConfig | undefined {
  return CACHE_MODULES.find((module) =>
    module.routes.some((r) => route.startsWith(r))
  );
}

/**
 * Get module configuration for a given API URL
 */
export function getModuleForApiUrl(url: string): CacheModuleConfig | undefined {
  return CACHE_MODULES.find((module) =>
    module.apiPatterns.some((pattern) => pattern.test(url))
  );
}

/**
 * Check if a route is syncable (supports offline operations)
 */
export function isRouteSyncable(route: string): boolean {
  const module = getModuleForRoute(route);
  return module?.syncable ?? false;
}

/**
 * Check if an API call is syncable
 */
export function isApiCallSyncable(url: string): boolean {
  const module = getModuleForApiUrl(url);
  return module?.syncable ?? false;
}

// ============================================
// QUEUE OPERATION HELPERS
// ============================================

/**
 * Create a queued operation for a specific module
 */
export function createQueuedOperation(
  module: string,
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  body?: any,
  headers?: Record<string, string>
): QueuedOperation {
  return {
    id: `${module}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    url,
    method,
    body,
    headers,
    timestamp: Date.now(),
    retryCount: 0,
    module: module as any,
  };
}

/**
 * Create a queued operation for attendance marking
 */
export function createAttendanceOperation(
  studentId: string,
  status: 'present' | 'absent' | 'late' | 'excused',
  sessionId: string,
  apiBaseUrl: string
): QueuedOperation {
  return createQueuedOperation(
    'attendance',
    `${apiBaseUrl}/rest/v1/attendance`,
    'POST',
    {
      student_id: studentId,
      session_id: sessionId,
      status,
      timestamp: new Date().toISOString(),
    },
    {}
  );
}

/**
 * Create a queued operation for grade entry
 */
export function createGradeOperation(
  studentId: string,
  subjectId: string,
  grade: number,
  periodId: string,
  apiBaseUrl: string
): QueuedOperation {
  return createQueuedOperation(
    'grades',
    `${apiBaseUrl}/rest/v1/grades`,
    'POST',
    {
      student_id: studentId,
      subject_id: subjectId,
      grade,
      period_id: periodId,
      timestamp: new Date().toISOString(),
    },
    {}
  );
}

/**
 * Create a queued operation for lesson log entry
 */
export function createLessonLogOperation(
  sessionId: string,
  content: string,
  homework?: string,
  documents?: Array<{ name: string; url: string }>,
  apiBaseUrl: string
): QueuedOperation {
  return createQueuedOperation(
    'lesson-log',
    `${apiBaseUrl}/rest/v1/lesson_log`,
    'POST',
    {
      session_id: sessionId,
      content,
      homework,
      documents,
      timestamp: new Date().toISOString(),
    },
    {}
  );
}

/**
 * Create a queued operation for payment registration
 */
export function createPaymentOperation(
  studentId: string,
  amount: number,
  paymentMethod: string,
  apiBaseUrl: string
): QueuedOperation {
  return createQueuedOperation(
    'payments',
    `${apiBaseUrl}/rest/v1/payments`,
    'POST',
    {
      student_id: studentId,
      amount,
      payment_method: paymentMethod,
      timestamp: new Date().toISOString(),
    },
    {}
  );
}

// ============================================
// SYNC STRATEGIES
// ============================================

/**
 * Get sync strategy for a module
 */
export function getSyncStrategy(moduleName: string): {
  strategy: 'immediate' | 'batch' | 'scheduled';
  interval?: number;
  retryBackoff: number[];
} {
  const module = getModuleConfig(moduleName);

  if (!module || !module.syncable) {
    return {
      strategy: 'immediate',
      retryBackoff: [1000, 5000, 15000, 30000, 60000],
    };
  }

  // Payments and attendance use immediate sync
  if (moduleName === 'payments' || moduleName === 'attendance') {
    return {
      strategy: 'immediate',
      retryBackoff: [1000, 5000, 15000, 30000, 60000],
    };
  }

  // Grades and lesson log use batch sync (every 30 seconds)
  if (moduleName === 'grades' || moduleName === 'lesson-log') {
    return {
      strategy: 'batch',
      interval: 30000, // 30 seconds
      retryBackoff: [1000, 5000, 15000, 30000, 60000],
    };
  }

  // Default: immediate sync
  return {
    strategy: 'immediate',
    retryBackoff: [1000, 5000, 15000, 30000, 60000],
  };
}

// ============================================
// EXPORTS
// ============================================

export const CacheModules = {
  ATTENDANCE_MODULE,
  GRADES_MODULE,
  SCHEDULE_MODULE,
  LESSON_LOG_MODULE,
  NOTIFICATIONS_MODULE,
  PAYMENTS_MODULE,
  PROFILE_MODULE,
  CACHE_MODULES,
  getModuleConfig,
  getModuleForRoute,
  getModuleForApiUrl,
  isRouteSyncable,
  isApiCallSyncable,
  createQueuedOperation,
  createAttendanceOperation,
  createGradeOperation,
  createLessonLogOperation,
  createPaymentOperation,
  getSyncStrategy,
};
