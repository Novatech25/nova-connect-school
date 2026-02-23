/**
 * Cache Configuration
 *
 * Defines cache strategies for different routes and resource types.
 * Used by the Service Worker to determine caching behavior.
 */

// ============================================
// TYPES
// ============================================

export type CacheStrategy = 'cache-first' | 'network-first' | 'network-only' | 'stale-while-revalidate';

export interface CacheRule {
  pattern: RegExp | string | ((url: string) => boolean);
  strategy: CacheStrategy;
  maxAge?: number; // in seconds
  maxEntries?: number;
  version?: string;
}

// ============================================
// CACHE STRATEGIES BY ROUTE
// ============================================

/**
 * Essential screens that should be cached for offline access
 * These are critical for daily operations
 */
export const ESSENTIAL_ROUTES = [
  '/attendance',
  '/attendance-scan',
  '/grades',
  '/schedule',
  '/lesson-log',
  '/notifications',
  '/profile',
  '/students',
  '/classes',
];

/**
 * Secondary screens that can be prefetched during idle time
 */
export const PREFETCH_ROUTES = [
  '/report-cards',
  '/student-card',
  '/payroll',
  '/homework',
  '/absences',
];

/**
 * Routes that should never be cached (sensitive or dynamic content)
 */
export const NETWORK_ONLY_ROUTES = [
  '/(auth)/login',
  '/(auth)/register',
  '/(auth)/forgot-password',
  '/payments',
  '/admin',
];

/**
 * Routes that should use network-first strategy
 */
export const NETWORK_FIRST_ROUTES = [
  '/attendance',
  '/grades',
  '/lesson-log',
  '/notifications',
];

// ============================================
// CACHE RULES BY MODULE
// ============================================

/**
 * Cache rules for the Attendance module
 */
export const ATTENDANCE_CACHE_RULES: CacheRule[] = [
  {
    pattern: /^\/attendance/,
    strategy: 'network-first',
    maxAge: 3600, // 1 hour
    maxEntries: 50,
  },
  {
    pattern: /^\/attendance-scan/,
    strategy: 'network-first',
    maxAge: 1800, // 30 minutes
    maxEntries: 20,
  },
  {
    pattern: /\/api\/attendance/,
    strategy: 'network-first',
    maxAge: 300, // 5 minutes
  },
];

/**
 * Cache rules for the Grades module
 */
export const GRADES_CACHE_RULES: CacheRule[] = [
  {
    pattern: /^\/grades/,
    strategy: 'network-first',
    maxAge: 1800, // 30 minutes
    maxEntries: 100,
  },
  {
    pattern: /\/api\/grades/,
    strategy: 'network-first',
    maxAge: 600, // 10 minutes
  },
  {
    pattern: /\/api\/report-cards/,
    strategy: 'cache-first',
    maxAge: 86400, // 24 hours
    maxEntries: 50,
  },
];

/**
 * Cache rules for the Schedule (EDT) module
 */
export const SCHEDULE_CACHE_RULES: CacheRule[] = [
  {
    pattern: /^\/schedule/,
    strategy: 'cache-first',
    maxAge: 43200, // 12 hours
    maxEntries: 20,
  },
  {
    pattern: /\/api\/schedule/,
    strategy: 'cache-first',
    maxAge: 43200, // 12 hours
  },
  {
    pattern: /\/api\/events/,
    strategy: 'network-first',
    maxAge: 300, // 5 minutes
  },
];

/**
 * Cache rules for the Lesson Log (Cahier de texte) module
 */
export const LESSON_LOG_CACHE_RULES: CacheRule[] = [
  {
    pattern: /^\/lesson-log/,
    strategy: 'network-first',
    maxAge: 7200, // 2 hours
    maxEntries: 100,
  },
  {
    pattern: /\/api\/lesson-log/,
    strategy: 'network-first',
    maxAge: 3600, // 1 hour
  },
  {
    pattern: /\/api\/homework/,
    strategy: 'network-first',
    maxAge: 3600, // 1 hour
  },
];

/**
 * Cache rules for the Notifications module
 */
export const NOTIFICATIONS_CACHE_RULES: CacheRule[] = [
  {
    pattern: /^\/notifications/,
    strategy: 'network-first',
    maxAge: 300, // 5 minutes
    maxEntries: 100,
  },
  {
    pattern: /\/api\/notifications/,
    strategy: 'network-first',
    maxAge: 300, // 5 minutes
  },
];

/**
 * Cache rules for the Payments module
 */
export const PAYMENTS_CACHE_RULES: CacheRule[] = [
  {
    pattern: /^\/payments/,
    strategy: 'network-only',
  },
  {
    pattern: /\/api\/payments/,
    strategy: 'network-only',
  },
  {
    pattern: /\/api\/invoices/,
    strategy: 'network-first',
    maxAge: 86400, // 24 hours (for historical invoices)
  },
];

/**
 * Cache rules for the Profile module
 */
export const PROFILE_CACHE_RULES: CacheRule[] = [
  {
    pattern: /^\/profile/,
    strategy: 'network-first',
    maxAge: 3600, // 1 hour
    maxEntries: 20,
  },
  {
    pattern: /\/api\/profile/,
    strategy: 'network-first',
    maxAge: 3600, // 1 hour
  },
  {
    pattern: /\/api\/settings/,
    strategy: 'network-first',
    maxAge: 3600, // 1 hour
  },
];

// ============================================
// CACHE RULES BY RESOURCE TYPE
// ============================================

/**
 * Cache rules for static assets
 */
export const STATIC_ASSETS_CACHE_RULES: CacheRule[] = [
  {
    pattern: /\.(js|css)$/,
    strategy: 'cache-first',
    maxAge: 604800, // 7 days
    maxEntries: 100,
  },
  {
    pattern: /\.(png|jpg|jpeg|gif|webp|svg|ico)$/,
    strategy: 'cache-first',
    maxAge: 5184000, // 60 days
    maxEntries: 100,
  },
  {
    pattern: /\.(woff|woff2|ttf|eot)$/,
    strategy: 'cache-first',
    maxAge: 31536000, // 1 year
    maxEntries: 50,
  },
];

/**
 * Cache rules for API calls
 */
export const API_CACHE_RULES: CacheRule[] = [
  {
    pattern: /\/rest\/v1\/.*\/?/,
    strategy: 'network-first',
    maxAge: 600, // 10 minutes
    maxEntries: 200,
  },
  {
    pattern: /\/auth\/v1\/(?!token).*/,
    strategy: 'network-first',
    maxAge: 300, // 5 minutes
  },
  {
    pattern: /\/auth\/v1\/token/,
    strategy: 'network-only',
  },
  {
    pattern: /\/storage\/v1\/.*/,
    strategy: 'cache-first',
    maxAge: 86400, // 24 hours
    maxEntries: 100,
  },
];

// ============================================
// CACHE STRATEGY CONFIGURATION
// ============================================

/**
 * Combined cache configuration
 */
export const CACHE_CONFIG: CacheRule[] = [
  ...ATTENDANCE_CACHE_RULES,
  ...GRADES_CACHE_RULES,
  ...SCHEDULE_CACHE_RULES,
  ...LESSON_LOG_CACHE_RULES,
  ...NOTIFICATIONS_CACHE_RULES,
  ...PAYMENTS_CACHE_RULES,
  ...PROFILE_CACHE_RULES,
  ...STATIC_ASSETS_CACHE_RULES,
  ...API_CACHE_RULES,
];

/**
 * Get cache strategy for a given URL
 */
export function getCacheStrategyForUrl(url: string): CacheStrategy {
  for (const rule of CACHE_CONFIG) {
    if (typeof rule.pattern === 'string') {
      if (url.includes(rule.pattern)) {
        return rule.strategy;
      }
    } else if (rule.pattern instanceof RegExp) {
      if (rule.pattern.test(url)) {
        return rule.strategy;
      }
    } else if (typeof rule.pattern === 'function') {
      if (rule.pattern(url)) {
        return rule.strategy;
      }
    }
  }

  // Default strategy
  return 'network-first';
}

/**
 * Get cache rule for a given URL
 */
export function getCacheRuleForUrl(url: string): CacheRule | undefined {
  return CACHE_CONFIG.find((rule) => {
    if (typeof rule.pattern === 'string') {
      return url.includes(rule.pattern);
    } else if (rule.pattern instanceof RegExp) {
      return rule.pattern.test(url);
    } else if (typeof rule.pattern === 'function') {
      return rule.pattern(url);
    }
    return false;
  });
}

/**
 * Check if a route should be cached
 */
export function shouldCacheRoute(route: string): boolean {
  return NETWORK_ONLY_ROUTES.every((excludedRoute) => !route.startsWith(excludedRoute));
}

/**
 * Check if a route should use network-first
 */
export function shouldUseNetworkFirst(route: string): boolean {
  return NETWORK_FIRST_ROUTES.some((r) => route.startsWith(r));
}

/**
 * Check if a route is essential
 */
export function isEssentialRoute(route: string): boolean {
  return ESSENTIAL_ROUTES.some((r) => route.startsWith(r));
}

/**
 * Check if a route should be prefetched
 */
export function shouldPrefetchRoute(route: string): boolean {
  return PREFETCH_ROUTES.some((r) => route.startsWith(r));
}

/**
 * Get essential routes for precaching
 */
export function getEssentialRoutesForPrecache(): string[] {
  return [...ESSENTIAL_ROUTES];
}

/**
 * Get prefetch routes for background loading
 */
export function getPrefetchRoutes(): string[] {
  return [...PREFETCH_ROUTES];
}

// ============================================
// EXPORTS
// ============================================

export const CacheConfig = {
  ESSENTIAL_ROUTES,
  PREFETCH_ROUTES,
  NETWORK_ONLY_ROUTES,
  NETWORK_FIRST_ROUTES,
  ATTENDANCE_CACHE_RULES,
  GRADES_CACHE_RULES,
  SCHEDULE_CACHE_RULES,
  LESSON_LOG_CACHE_RULES,
  NOTIFICATIONS_CACHE_RULES,
  PAYMENTS_CACHE_RULES,
  PROFILE_CACHE_RULES,
  STATIC_ASSETS_CACHE_RULES,
  API_CACHE_RULES,
  CACHE_CONFIG,
  getCacheStrategyForUrl,
  getCacheRuleForUrl,
  shouldCacheRoute,
  shouldUseNetworkFirst,
  isEssentialRoute,
  shouldPrefetchRoute,
  getEssentialRoutesForPrecache,
  getPrefetchRoutes,
};
