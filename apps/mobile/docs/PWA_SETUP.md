# NovaConnect PWA - Technical Setup Guide

This document provides technical documentation for setting up, developing, and debugging the NovaConnect Progressive Web App.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Worker Configuration](#service-worker-configuration)
3. [Cache Strategies](#cache-strategies)
4. [Offline Queue Management](#offline-queue-management)
5. [Push Notifications](#push-notifications)
6. [Testing](#testing)
7. [Debugging](#debugging)
8. [Deployment](#deployment)

## Architecture Overview

The NovaConnect PWA is built on top of Expo Web with the following key components:

```
┌─────────────────────────────────────────────────────────────┐
│                     React App (Expo)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   usePWA     │  │ useService   │  │  useWebPush  │      │
│  │   Hook       │  │  Worker Hook │  │    Hook      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ postMessage
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Worker                            │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Workbox Cache   │  │  Background Sync │               │
│  │    Strategies    │  │     (Offline)    │               │
│  └──────────────────┘  └──────────────────┘               │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Offline Queue   │  │ Push Notifications│               │
│  │   (IndexedDB)    │  │                  │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Supabase)                       │
│  - Authentication                                            │
│  - Database (PostgreSQL)                                     │
│  - Storage                                                   │
│  - Edge Functions (Push notifications)                       │
└─────────────────────────────────────────────────────────────┘
```

## Service Worker Configuration

### File Structure

- `public/service-worker.js` - Main service worker with Workbox
- `src/service-worker/sw-wrapper.ts` - TypeScript wrapper for queue management
- `src/service-worker/sw-messaging.ts` - Bidirectional communication
- `src/service-worker/cache-modules.ts` - Module-specific cache configs

### Service Worker Lifecycle

```javascript
// Install event - precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAMES.STATIC).then(cache =>
        cache.addAll(['/', '/index.html', '/manifest.json'])
      ),
      self.skipWaiting()
    ])
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      cleanupOutdatedCaches(),
      self.clients.claim()
    ])
  );
});
```

## Cache Strategies

### Cache-First Strategy

Used for static assets (images, fonts, icons):

```javascript
new CacheFirst({
  cacheName: 'novaconnect-images',
  plugins: [
    new ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 60 * 60 * 24 * 60 // 60 days
    })
  ]
})
```

### Network-First Strategy

Used for dynamic data (API calls, user-specific content):

```javascript
new NetworkFirst({
  cacheName: 'novaconnect-api',
  networkTimeoutSeconds: 5,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 60 * 60 * 24 // 24 hours
    })
  ]
})
```

### Network-Only Strategy

Used for sensitive operations (authentication, payments):

```javascript
new NetworkOnly()
```

## Offline Queue Management

### Queue Structure

```typescript
interface QueuedOperation {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  module: 'attendance' | 'grades' | 'lesson-log' | 'payments';
}
```

### Queue Operations

```typescript
// Add to queue
await addToQueue({
  id: 'attendance-123',
  url: '/api/attendance',
  method: 'POST',
  body: { student_id: '123', status: 'present' },
  timestamp: Date.now(),
  retryCount: 0,
  module: 'attendance'
});

// Sync queue
await syncQueue(authToken);

// Get queue stats
const stats = await getQueueStats();
```

## Push Notifications

### VAPID Keys Setup

Generate VAPID keys for web push:

```bash
npx web-push generate-vapid-keys
```

Add to `.env`:

```env
EXPO_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
EXPO_PUBLIC_VAPID_PRIVATE_KEY=your_private_key
```

### Subscription Flow

```typescript
// Request permission
const permission = await requestNotificationPermission();

if (permission === 'granted') {
  // Subscribe to push
  const subscription = await subscribeToPush(
    vapidPublicKey,
    swRegistration
  );

  // Send to backend
  await sendSubscriptionToServer(
    subscription,
    userId,
    apiBaseUrl
  );
}
```

## Testing

### Unit Tests

```bash
# Run PWA unit tests
pnpm test --tests/pwa
```

### E2E Tests with Playwright

```bash
# Run browser tests
pnpm test:pwa

# Run on specific browser
pnpm playwright test --project=chromium

# Run with UI
pnpm playwright test --ui
```

### Lighthouse Audits

```bash
# Run Lighthouse audit
pnpm audit:pwa

# Run in CI mode
lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json --throttling-method=devtools
```

### Test Coverage

The test suite covers:
- PWA installation (Chrome, Safari, Firefox, Edge)
- Service Worker registration and activation
- Offline functionality
- Cache strategies
- Background sync
- Push notifications
- Performance metrics

## Debugging

### Chrome DevTools

1. **Application Tab**:
   - Service Workers: View SW status and debug
   - Cache Storage: Inspect cached resources
   - IndexedDB: View offline queue
   - Notifications: Test push notifications

2. **Network Tab**:
   - Enable "Offline" checkbox to test offline mode
   - View Service Worker responses (from cache vs network)

3. **Background Sync**:
   - Application → Background Sync → "novaconnect-sync"
   - Click "Run" to trigger sync manually

### Service Worker Debugging

```javascript
// In browser console
navigator.serviceWorker.addEventListener('controllerchange', () => {
  console.log('SW Controller changed');
  window.location.reload();
});

// Get SW registration
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW:', reg);
  console.log('Active:', reg.active);
  console.log('Waiting:', reg.waiting);
  console.log('Installing:', reg.installing);
});
```

### IndexedDB Inspection

```javascript
// View offline queue
const request = indexedDB.open('NovaConnectOfflineQueue', 1);
request.onsuccess = () => {
  const db = request.result;
  const tx = db.transaction(['operations'], 'readonly');
  const store = tx.objectStore('operations');
  const getAll = store.getAll();

  getAll.onsuccess = () => {
    console.log('Queue:', getAll.result);
  };
};
```

### Troubleshooting Common Issues

#### Service Worker Not Updating

```javascript
// Force skip waiting
navigator.serviceWorker.getRegistration().then(reg => {
  reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
});
```

#### Cache Not Clearing

```javascript
// Clear all caches
caches.keys().then(cacheNames => {
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
});
```

#### Offline Queue Not Syncing

Check IndexedDB for stuck operations and verify network connectivity.

## Deployment

### Build for Production

```bash
# Build PWA with Service Worker
pnpm build:pwa

# This runs:
# 1. expo export:web
# 2. node scripts/build-sw.js (bundles SW)
# 3. Copies to dist/
```

### Deploy to Static Hosting

#### Vercel

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ]
}
```

#### Netlify

```toml
# netlify.toml
[[redirects]]
  from = "/*"
  to = "/dist/:splat"
  status = 200

[build]
  command = "pnpm build:pwa"
  publish = "dist"
```

### Environment Variables

Ensure these are set in production:

```env
EXPO_PUBLIC_API_URL=https://api.novaconnect.fr
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
EXPO_PUBLIC_PWA_ENABLED=true
```

### Service Worker Scope

The Service Worker is served from `/` with scope `/`. Ensure:

1. `service-worker.js` is in the root of `dist/`
2. The file is served with `Content-Type: application/javascript`
3. No CORS issues when loading the SW

## Monitoring

### Analytics Integration

Track PWA-specific metrics:

```typescript
// Track installation
usePWA().isInstalled && analytics.track('pwa_installed');

// Track offline usage
navigator.onLine === false && analytics.track('offline_mode');

// Track sync events
onSyncComplete((payload) => {
  analytics.track('sync_complete', {
    operationsProcessed: payload.operationsProcessed,
    operationsFailed: payload.operationsFailed,
  });
});
```

### Error Tracking

```typescript
// Service Worker errors
navigator.serviceWorker.addEventListener('error', (event) => {
  Sentry.captureException(event.error);
});
```

## Best Practices

1. **Always test offline mode** before deploying
2. **Monitor cache size** to avoid hitting quota limits
3. **Set appropriate cache expiration** for each resource type
4. **Implement retry logic** for failed sync operations
5. **Test on real devices**, not just emulators
6. **Keep Service Worker updates** backward compatible
7. **Use background sync** for critical operations only
8. **Provide user feedback** for all offline operations

## Resources

- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [PWA Best Practices](https://web.dev/pwa/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Sync_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

## Support

For issues or questions:
- GitHub: https://github.com/novaconnect/app
- Documentation: https://docs.novaconnect.fr
- Email: support@novaconnect.fr
