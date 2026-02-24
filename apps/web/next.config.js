/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  transpilePackages: [
    "@novaconnect/ui",
    "@novaconnect/core",
    "@novaconnect/data",
    "@novaconnect/sync",
  ],
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Webpack configuration to handle Node.js-only modules
  webpack: (config, { isServer }) => {
    // Exclude multicast-dns and related Node.js modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dgram: false,
        dns: false,
        multicast_dns: false,
      };

      // Externalize multicast-dns for client-side builds
      config.externals = config.externals || [];
      config.externals.push('multicast-dns');
    }

    return config;
  },

  // Security and PWA Headers Configuration
  async headers() {
    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:3001 http://localhost:3002 http://localhost:3003; frame-ancestors 'none';",
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(self)',
          },
        ],
      },
      // PWA Configuration
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
