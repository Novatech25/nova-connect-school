// NovaConnectSchool PWA Service Worker with Workbox
// This service worker implements comprehensive caching strategies and offline support

// Import Workbox from CDN
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-strategies.prod.js',
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-routing.prod.js',
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-precaching.prod.js',
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-expiration.prod.js',
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-cacheable-response.prod.js',
  'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-background-sync.prod.js'
);

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute, NavigationRoute } = workbox.routing;
const { CacheFirst, NetworkFirst, NetworkOnly } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { BackgroundSyncPlugin } = workbox.backgroundSync;
const { Queue } = workbox.backgroundSync;

// ============================================
// CONFIGURATION
// ============================================

const CACHE_NAMES = {
  STATIC: 'novaconnect-static-v1',
  DYNAMIC: 'novaconnect-dynamic-v1',
  API: 'novaconnect-api-v1',
  IMAGES: 'novaconnect-images-v1',
};

const CACHE_VERSION = '1.0.0';

// ============================================
// PRECACHING
// ============================================

// Precache essential assets
precacheAndRoute([
  { url: '/', revision: CACHE_VERSION },
  { url: '/index.html', revision: CACHE_VERSION },
  { url: '/manifest.json', revision: CACHE_VERSION },
  { url: '/favicon.ico', revision: CACHE_VERSION },
]);

// Cleanup outdated caches
cleanupOutdatedCaches();

// ============================================
// CACHE STRATEGIES
// ============================================

// Cache-first for static assets (images, fonts, icons)
registerRoute(
  ({ request }) => {
    return request.destination === 'image' ||
           request.destination === 'font' ||
           request.url.includes('/assets/icons/') ||
           request.url.includes('/assets/images/');
  },
  new CacheFirst({
    cacheName: CACHE_NAMES.IMAGES,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cache-first for JS/CSS bundles
registerRoute(
  ({ request }) => {
    return request.destination === 'script' ||
           request.destination === 'style';
  },
  new CacheFirst({
    cacheName: CACHE_NAMES.STATIC,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Network-first with fallback for Supabase API calls
registerRoute(
  ({ url }) => {
    return url.hostname.includes('supabase.co') &&
           (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/'));
  },
  new NetworkFirst({
    cacheName: CACHE_NAMES.API,
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Stale-while-revalidate for dynamic content
registerRoute(
  ({ url }) => {
    return url.pathname.startsWith('/attendance') ||
           url.pathname.startsWith('/grades') ||
           url.pathname.startsWith('/schedule') ||
           url.pathname.startsWith('/lesson-log') ||
           url.pathname.startsWith('/notifications');
  },
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.DYNAMIC,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 2, // 2 hours
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Network-only for critical operations (auth, payments)
registerRoute(
  ({ url }) => {
    return url.pathname.includes('/auth/v1/token') ||
           url.pathname.includes('/payments');
  },
  new NetworkOnly()
);

// ============================================
// OFFLINE QUEUE WITH BACKGROUND SYNC
// ============================================

// Create a queue for offline operations
const offlineQueue = new Queue('novaconnect-sync', {
  onSync: async ({ queue }) => {
    let entry;

    while ((entry = await queue.shiftRequest())) {
      try {
        const { request, metadata } = entry;

        // Add authentication headers if present
        const headers = new Headers();
        if (metadata?.authToken) {
          headers.append('Authorization', `Bearer ${metadata.authToken}`);
        }

        // Clone request to preserve original
        const authenticatedRequest = new Request(request, {
          headers,
        });

        await fetch(authenticatedRequest);

        // Notify client of successful sync
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_COMPLETE',
            timestamp: Date.now(),
          });
        });
      } catch (error) {
        console.error('Sync failed for request:', error);

        // Requeue the request for later retry
        await queue.unshiftRequest(entry);

        // Notify client of sync failure
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_FAILED',
            error: error.message,
            timestamp: Date.now(),
          });
        });

        // Stop processing the queue on error
        break;
      }
    }
  },
});

// Background sync plugin for critical operations
const bgSyncPlugin = new BackgroundSyncPlugin('novaconnect-sync', {
  maxRetentionTime: 60 * 24 * 7, // Retry for up to 7 days
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request);
      } catch (error) {
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// ============================================
// NAVIGATION ROUTE (APP SHELL)
// ============================================

// Create a navigation route for SPA navigation
const navigationRoute = new NavigationRoute(new NetworkFirst({
  cacheName: CACHE_NAMES.STATIC,
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
  ],
}));

registerRoute(navigationRoute);

// ============================================
// PUSH NOTIFICATIONS
// ============================================

// Handle push events
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: data.actions || [
      {
        action: 'open',
        title: 'Ouvrir',
        icon: '/assets/icons/action-open.png',
      },
      {
        action: 'dismiss',
        title: 'Ignorer',
        icon: '/assets/icons/action-dismiss.png',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'NovaConnectSchool', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a client is already open, focus it
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============================================
// SERVICE WORKER LIFECYCLE
// ============================================

// Install event - precache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    Promise.all([
      // Precache essential pages
      caches.open(CACHE_NAMES.STATIC).then((cache) => {
        return cache.addAll([
          '/',
          '/index.html',
          '/manifest.json',
        ]);
      }),
    ]).then(() => {
      // Force the waiting service worker to become active
      return self.skipWaiting();
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAMES.STATIC &&
                     cacheName !== CACHE_NAMES.DYNAMIC &&
                     cacheName !== CACHE_NAMES.API &&
                     cacheName !== CACHE_NAMES.IMAGES;
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ])
  );
});

// ============================================
// MESSAGE HANDLING (SW ↔ APP COMMUNICATION)
// ============================================

self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      // Trigger service worker update
      self.skipWaiting();
      // Send response
      if (event.ports[0]) {
        event.ports[0].postMessage({ type: 'SKIP_WAITING_COMPLETE' });
      }
      break;

    case 'CLEAR_CACHE':
      // Clear all caches
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        }).then(() => {
          // Send response
          if (event.ports[0]) {
            event.ports[0].postMessage({ type: 'CLEAR_CACHE_COMPLETE' });
          }
        })
      );
      break;

    case 'GET_QUEUE_STATS':
      // Return offline queue statistics
      event.waitUntil(
        offlineQueue.getAll().then((entries) => {
          if (event.ports[0]) {
            event.ports[0].postMessage({
              type: 'QUEUE_STATS',
              payload: {
                count: entries.length,
                entries: entries.map(e => ({
                  url: e.request.url,
                  method: e.request.method,
                  timestamp: e.metadata?.timestamp,
                })),
              },
            });
          }
        })
      );
      break;

    case 'SYNC_NOW':
      // Trigger immediate sync
      event.waitUntil(
        offlineQueue.getAll().then(() => {
          // Trigger background sync
          return self.registration.sync.register('novaconnect-sync');
        }).then(() => {
          // Send response
          if (event.ports[0]) {
            event.ports[0].postMessage({ type: 'SYNC_NOW_COMPLETE' });
          }
        })
      );
      break;

    case 'GET_VERSION':
      // Return service worker version
      if (event.ports[0]) {
        event.ports[0].postMessage({
          type: 'VERSION',
          payload: CACHE_VERSION,
        });
      }
      break;

    default:
      console.warn('[SW] Unknown message type:', type);
  }
});

// ============================================
// FETCH HANDLER WITH OFFLINE SUPPORT
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests to API (they're handled by background sync)
  if (url.hostname.includes('supabase.co') && request.method !== 'GET') {
    // Clone the request before attempting fetch
    const requestClone = request.clone();

    event.respondWith(
      fetch(request).catch((error) => {
        // Add failed POST/PUT/DELETE to offline queue
        console.log('[SW] Request failed, adding to queue:', request.url);

        // Notify client that request is queued and add to background sync queue
        event.waitUntil(
          Promise.all([
            // Add to background sync queue
            offlineQueue.pushRequest({
              request: requestClone,
              metadata: {
                timestamp: Date.now(),
                authToken: request.headers.get('Authorization'),
              },
            }),
            // Notify all clients
            self.clients.matchAll().then((clients) => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'QUEUE_UPDATED',
                  payload: {
                    url: request.url,
                    method: request.method,
                    timestamp: Date.now(),
                  },
                });
              });
            }),
          ])
        );

        // Return offline response
        return new Response(
          JSON.stringify({
            error: 'OFFLINE',
            message: 'La requête sera synchronisée lorsque vous serez en ligne',
            queued: true,
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      })
    );
    return;
  }

  // Handle other requests normally (they'll be caught by the strategies above)
});

// ============================================
// UPDATE NOTIFICATION
// ============================================

self.addEventListener('controllerchange', () => {
  console.log('[SW] Controller changed, reloading page...');
  window.location.reload();
});

// Listen for new service worker updates
self.addEventListener('updatefound', () => {
  const newWorker = self.installing;

  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && self.navigator.serviceWorker.controller) {
      // A new service worker is available
      console.log('[SW] New version available');

      // Notify all clients
      self.clients.matchAll().then((clients) => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            timestamp: Date.now(),
          });
        });
      });
    }
  });
});

console.log('[SW] Service Worker loaded successfully');
