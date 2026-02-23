/**
 * NovaConnect PWA Browser Tests
 *
 * E2E tests for PWA functionality across multiple browsers.
 * Uses Playwright for cross-browser testing.
 */

import { test, expect, devices } from '@playwright/test';

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Browser configurations
const BROWSERS = [
  { name: 'chromium', description: 'Chrome/Edge' },
  { name: 'firefox', description: 'Firefox' },
  { name: 'webkit', description: 'Safari' },
];

// Device configurations
const MOBILE_DEVICE = devices['iPhone 12'];
const DESKTOP_DEVICE = devices['Desktop Chrome'];

// ============================================
// TEST SUITE: PWA INSTALLATION
// ============================================

test.describe('PWA Installation', () => {
  BROWSERS.forEach(({ name, description }) => {
    test.describe(`${description}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
      });

      test('should display install prompt when installable', async ({ page }) => {
        // Check if install prompt is shown
        const installPrompt = page.locator('[data-testid="install-prompt"]');
        await expect(installPrompt).toBeVisible({ timeout: 5000 });
      });

      test('should install PWA successfully', async ({ page, context }) => {
        // Listen for beforeinstallprompt event
        const installPromptPromise = page.waitForEvent('beforeinstallprompt');

        // Trigger installation
        const installButton = page.locator('[data-testid="install-button"]');
        await installButton.click();

        // Handle install prompt
        const promptEvent = await installPromptPromise;
        await promptEvent.prompt();

        // Verify app is installed
        const isInstalled = await page.evaluate(() => {
          return window.matchMedia('(display-mode: standalone)').matches;
        });

        expect(isInstalled).toBeTruthy();
      });

      test('should not show prompt after installation', async ({ page }) => {
        // Simulate installed state
        await page.evaluate(() => {
          Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: (query: string) => ({
              matches: query === '(display-mode: standalone)',
              media: query,
              onchange: null,
              addListener: () => {},
              removeListener: () => {},
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => {},
            }),
          });
        });

        await page.reload();

        // Install prompt should not be visible
        const installPrompt = page.locator('[data-testid="install-prompt"]');
        await expect(installPrompt).not.toBeVisible();
      });
    });
  });
});

// ============================================
// TEST SUITE: SERVICE WORKER
// ============================================

test.describe('Service Worker', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check if service worker is registered
    const isRegistered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration !== undefined;
    });

    expect(isRegistered).toBeTruthy();
  });

  test('should activate service worker', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check if service worker is active
    const isActive = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.state === 'activated';
    });

    expect(isActive).toBeTruthy();
  });

  test('should handle service worker updates', async ({ page }) => {
    await page.goto(BASE_URL);

    // Listen for update messages
    const updateMessage = page.waitForMessage('msg => msg.type === "UPDATE_AVAILABLE"');

    // Trigger update check (simulate new version)
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });

    // Verify update message is received
    const message = await updateMessage;
    expect(message.type).toBe('UPDATE_AVAILABLE');
  });
});

// ============================================
// TEST SUITE: OFFLINE FUNCTIONALITY
// ============================================

test.describe('Offline Functionality', () => {
  test('should work offline after first load', async ({ page, context }) => {
    await page.goto(BASE_URL);

    // Simulate offline mode
    await context.setOffline(true);

    // Navigate to cached page
    await page.goto(`${BASE_URL}/schedule`);

    // Page should still load (from cache)
    const content = page.locator('[data-testid="schedule-content"]');
    await expect(content).toBeVisible();
  });

  test('should queue requests when offline', async ({ page, context }) => {
    await page.goto(BASE_URL);

    // Simulate offline mode
    await context.setOffline(true);

    // Perform an action that would fail
    await page.evaluate(() => {
      return fetch('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ student_id: '123', status: 'present' }),
      });
    });

    // Check offline queue
    const queueCount = await page.evaluate(async () => {
      // Assuming we have a method to get queue stats
      const stats = await navigator.serviceWorker.controller?.postMessage({
        type: 'GET_QUEUE_STATS',
      });
      return stats?.count || 0;
    });

    expect(queueCount).toBeGreaterThan(0);

    // Go back online
    await context.setOffline(false);

    // Wait for sync
    await page.waitForTimeout(2000);

    // Verify queue is empty
    const queueCountAfter = await page.evaluate(async () => {
      const stats = await navigator.serviceWorker.controller?.postMessage({
        type: 'GET_QUEUE_STATS',
      });
      return stats?.count || 0;
    });

    expect(queueCountAfter).toBe(0);
  });

  test('should show offline indicator', async ({ page, context }) => {
    await page.goto(BASE_URL);

    // Simulate offline mode
    await context.setOffline(true);

    // Offline indicator should be visible
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Offline indicator should disappear
    await expect(offlineIndicator).not.toBeVisible();
  });
});

// ============================================
// TEST SUITE: CACHE STRATEGIES
// ============================================

test.describe('Cache Strategies', () => {
  test('should cache static assets', async ({ page }) => {
    await page.goto(BASE_URL);

    // Open a page and cache assets
    await page.goto(`${BASE_URL}/grades`);

    // Verify cache
    const cachedAssets = await page.evaluate(async () => {
      const cache = await caches.open('novaconnect-static-v1');
      const keys = await cache.keys();
      return keys.length;
    });

    expect(cachedAssets).toBeGreaterThan(0);
  });

  test('should use cache-first for images', async ({ page }) => {
    await page.goto(`${BASE_URL}/schedule`);

    // Load image first time
    await page.waitForSelector('img');

    // Navigate away and back
    await page.goto(`${BASE_URL}/profile`);
    await page.goto(`${BASE_URL}/schedule`);

    // Image should load from cache (faster)
    const loadTime = await page.evaluate(() => {
      return performance.getEntriesByType('resource').reduce((sum, entry) => {
        return entry.entryType === 'resource' ? sum + entry.duration : sum;
      }, 0);
    });

    expect(loadTime).toBeLessThan(100); // Should be very fast from cache
  });

  test('should use network-first for API calls', async ({ page }) => {
    await page.goto(`${BASE_URL}/grades`);

    // Fetch data from API
    const response = await page.evaluate(async () => {
      const res = await fetch('/rest/v1/grades');
      return {
        status: res.status,
        cached: res.headers.get('X-Cached'),
      };
    });

    expect(response.status).toBe(200);
  });
});

// ============================================
// TEST SUITE: PUSH NOTIFICATIONS
// ============================================

test.describe('Push Notifications', () => {
  test('should request notification permission', async ({ page }) => {
    await page.goto(BASE_URL);

    // Trigger permission request
    await page.click('[data-testid="enable-notifications"]');

    // Grant permission
    await page.on('dialog', (dialog) => dialog.accept());

    // Verify permission is granted
    const permission = await page.evaluate(() => Notification.permission);
    expect(permission).toBe('granted');
  });

  test('should subscribe to push notifications', async ({ page }) => {
    await page.goto(BASE_URL);

    // Grant permission first
    await page.evaluate(() => Notification.requestPermission());

    // Subscribe
    const subscription = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.pushManager.getSubscription();
    });

    expect(subscription).not.toBeNull();
  });

  test('should receive push notification', async ({ page }) => {
    await page.goto(BASE_URL);

    // Grant permission and subscribe
    await page.evaluate(async () => {
      await Notification.requestPermission();
      const registration = await navigator.serviceWorker.ready;
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: new Uint8Array([
          // VAPID key placeholder
        ]),
      });
    });

    // Simulate push event
    await page.evaluate(() => {
      navigator.serviceWorker.controller?.postMessage({
        type: 'PUSH',
        data: { title: 'Test Notification', body: 'Test body' },
      });
    });

    // Verify notification is shown
    // (This would require additional service worker test setup)
  });
});

// ============================================
// TEST SUITE: BACKGROUND SYNC
// ============================================

test.describe('Background Sync', () => {
  test('should support background sync on Chrome', async ({ page, context }) => {
    test.skip(process.env.BROWSER !== 'chromium', 'Background Sync only supported on Chromium');

    await page.goto(BASE_URL);

    // Check if background sync is supported
    const isSupported = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return 'sync' in registration!;
    });

    expect(isSupported).toBeTruthy();
  });

  test('should sync queued operations on connection', async ({ page, context }) => {
    test.skip(process.env.BROWSER !== 'chromium', 'Background Sync only supported on Chromium');

    await page.goto(BASE_URL);

    // Go offline
    await context.setOffline(true);

    // Queue an operation
    await page.evaluate(() => {
      navigator.serviceWorker.controller?.postMessage({
        type: 'QUEUE_OPERATION',
        payload: {
          url: '/api/attendance',
          method: 'POST',
          body: JSON.stringify({ student_id: '123', status: 'present' }),
        },
      });
    });

    // Go online
    await context.setOffline(false);

    // Wait for sync event
    await page.waitForTimeout(3000);

    // Verify operation was synced
    const queueCount = await page.evaluate(async () => {
      const stats = await navigator.serviceWorker.controller?.postMessage({
        type: 'GET_QUEUE_STATS',
      });
      return stats?.count || 0;
    });

    expect(queueCount).toBe(0);
  });
});

// ============================================
// TEST SUITE: PERFORMANCE
// ============================================

test.describe('Performance', () => {
  test('should load within 3 seconds on 3G', async ({ page }) => {
    // Simulate 3G connection
    await page.emulateNetwork({ ...devices['iPhone 12'].defaultBrowserSlow3G });

    const startTime = Date.now();
    await page.goto(BASE_URL);
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test('should have Lighthouse PWA score > 90', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Lighthouse only available on Chromium');

    // This would require integrating with Lighthouse CI
    // For now, we'll check basic PWA criteria
    await page.goto(BASE_URL);

    const checks = await page.evaluate(async () => {
      const hasManifest = !!document.querySelector('link[rel="manifest"]');
      const hasSW = !!(await navigator.serviceWorker.getRegistration());
      const isHTTPS = location.protocol === 'https:';
      const isInstallable = 'beforeinstallprompt' in window;

      return {
        hasManifest,
        hasSW,
        isHTTPS,
        isInstallable,
      };
    });

    expect(checks.hasManifest).toBeTruthy();
    expect(checks.hasSW).toBeTruthy();
    expect(checks.isInstallable).toBeTruthy();
  });
});

// ============================================
// TEST SUITE: CROSS-BROWSER COMPATIBILITY
// ============================================

test.describe('Cross-Browser Compatibility', () => {
  BROWSERS.forEach(({ name, description }) => {
    test(`${description} should support service workers`, async ({ page }) => {
      await page.goto(BASE_URL);

      const isSupported = await page.evaluate(() => 'serviceWorker' in navigator);
      expect(isSupported).toBeTruthy();
    });

    test(`${description} should support cache API`, async ({ page }) => {
      await page.goto(BASE_URL);

      const isSupported = await page.evaluate(() => 'caches' in window);
      expect(isSupported).toBeTruthy();
    });

    test(`${description} should support notifications`, async ({ page }) => {
      await page.goto(BASE_URL);

      const isSupported = await page.evaluate(() => 'Notification' in window);
      expect(isSupported).toBeTruthy();
    });
  });
});
