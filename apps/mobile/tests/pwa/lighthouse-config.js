/**
 * Lighthouse PWA Audit Configuration
 *
 * Configuration for running Lighthouse audits to validate PWA compliance.
 * Integrates with CI/CD for automated testing.
 */

module.exports = {
  extends: 'lighthouse:default',

  settings: {
    // Only audit the PWA category
    onlyCategories: ['pwa', 'performance', 'accessibility', 'best-practices'],

    // Set thresholds for passing scores
    thresholds: {
      performance: 85,
      accessibility: 90,
      'best-practices': 90,
      seo: 80,
      pwa: 90,
    },

    // PWA-specific settings
    // Ensure audits run in single-page application mode
    maxWaitForFcp: 5000, // 5 seconds

    // Screen emulation
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false,
    },

    // Emulation settings
    emulatedUserAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',

    // Network throttling
    throttling: {
      rttMs: 40,
      throughputKbps: 10 * 1024,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },

    // Throttling method
    throttlingMethod: 'devtools',

    // Disable storage reset
    disableStorageReset: false,

    // List of audits to skip (if any)
    // skipAudits: [],
  },

  // PWA-specific checks
  audits: [
    // Manifest validation
    'manifest-file-exists',
    'manifest-display-name',
    'manifest-short-name',
    'manifest-start-url',
    'manifest-theme-color',
    'manifest-background-color',
    'manifest-icons',
    'manifest-prefer-related-applications',

    // Service Worker validation
    'service-worker',
    'service-worker-registered',
      'works-offline',

    // HTTPS requirement
    'is-on-https',

    // Viewport and responsive design
    'viewport',
    'content-width',

    // Mobile readiness
    'apple-touch-icon',
    'maskable-icon',
    'splash-screen',

    // Installation criteria
    'installable-manifest',
    'standalone',
    'without-javascript',

    // Performance metrics
    'first-contentful-paint',
    'first-meaningful-paint',
    'speed-index',
    'interactive',
    'first-cpu-idle',
    'time-to-first-byte',

    // Cache and offline support
    'offline-start-url',
    'offline-fallback',
  ],

  // Categories configuration
  categories: [
    {
      id: 'pwa',
      title: 'Progressive Web App',
      description: 'Is this application progressively enhanced?',
      auditRefs: [
        { id: 'viewport', weight: 1 },
        { id: 'manifest-file-exists', weight: 2 },
        { id: 'manifest-display-name', weight: 1 },
        { id: 'manifest-short-name', weight: 1 },
        { id: 'manifest-start-url', weight: 2 },
        { id: 'manifest-theme-color', weight: 1 },
        { id: 'manifest-background-color', weight: 1 },
        { id: 'manifest-icons', weight: 2 },
        { id: 'apple-touch-icon', weight: 1 },
        { id: 'maskable-icon', weight: 1 },
        { id: 'service-worker', weight: 2 },
        { id: 'service-worker-registered', weight: 1 },
        { id: 'works-offline', weight: 2 },
        { id: 'offline-start-url', weight: 2 },
        { id: 'installable-manifest', weight: 2 },
        { id: 'standalone', weight: 2 },
        { id: 'is-on-https', weight: 1 },
        { id: 'content-width', weight: 1 },
        { id: 'without-javascript', weight: 1 },
        { id: 'splash-screen', weight: 1 },
      ],
    },
    {
      id: 'performance',
      title: 'Performance',
      description: 'How fast does this app load?',
      auditRefs: [
        { id: 'first-contentful-paint', weight: 3 },
        { id: 'first-meaningful-paint', weight: 3 },
        { id: 'speed-index', weight: 2 },
        { id: 'interactive', weight: 5 },
        { id: 'first-cpu-idle', weight: 2 },
        { id: 'time-to-first-byte', weight: 1 },
      ],
    },
  ],
};
