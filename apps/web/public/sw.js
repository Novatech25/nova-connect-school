// Service Worker for NovaConnectSchool PWA
const CACHE_NAME = 'novaconnect-v1';
const OFFLINE_URL = '/offline';

// Assets to cache on install
const STATIC_CACHE = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first, fall back to network
  cacheFirst: (request) => {
    return caches.match(request).then((cacheResponse) => {
      if (cacheResponse) {
        // Update cache in background
        fetch(request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse);
          });
        }).catch(() => {});
        return cacheResponse;
      }

      return fetch(request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, networkResponse.clone());
        });
        return networkResponse;
      });
    });
  },

  // Network first, fall back to cache
  networkFirst: (request) => {
    return fetch(request).then((networkResponse) => {
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, networkResponse.clone());
      });
      return networkResponse;
    }).catch(() => {
      return caches.match(request);
    });
  },

  // Network only, no cache
  networkOnly: (request) => {
    return fetch(request);
  },

  // Cache only, no network
  cacheOnly: (request) => {
    return caches.match(request);
  },

  // Stale while revalidate
  staleWhileRevalidate: (request) => {
    return caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cacheResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          cache.put(request, networkResponse.clone());
          return networkResponse;
        });
        return cacheResponse || fetchPromise;
      });
    });
  },
};

// Determine cache strategy based on request
function getStrategy(request) {
  const url = new URL(request.url);

  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    return CACHE_STRATEGIES.networkFirst;
  }

  // Static assets - cache first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2)$/)) {
    return CACHE_STRATEGIES.cacheFirst;
  }

  // Static pages - stale while revalidate
  if (url.pathname.match(/^\/(about|contact|help)/)) {
    return CACHE_STRATEGIES.staleWhileRevalidate;
  }

  // Dynamic pages - network only
  return CACHE_STRATEGIES.networkFirst;
}

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_CACHE);
    })
  );

  // Force activation
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME;
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );

  // Take control immediately
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Apply strategy
  const strategy = getStrategy(request);

  if (strategy) {
    event.respondWith(strategy(request));
  }
});

// Message event
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// Background sync for offline operations
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-offline-operations') {
    event.waitUntil(
      // Sync offline operations with server
      self.registration.sync.register('sync-offline-operations')
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from NovaConnectSchool',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/icons/icon-96x96.png',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-96x96.png',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification('NovaConnectSchool', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
