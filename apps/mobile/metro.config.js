const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure Metro bundler for PWA support
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'web.tsx',
  'web.ts',
];

// Enable web bundler with optimizations for PWA
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add service worker middleware headers
      if (req.url === '/service-worker.js') {
        res.setHeader('Service-Worker-Allowed', '/');
        res.setHeader('Content-Type', 'application/javascript');
      }
      return middleware(req, res, next);
    };
  },
};

// Optimize for web tree-shaking
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  keep_fnames: false,
  mangle: {
    ...config.transformer.minifierConfig?.mangle,
    keep_fnames: false,
  },
};

module.exports = config;
