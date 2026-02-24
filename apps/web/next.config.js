/** @type {import('next').NextConfig} */

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

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dgram: false,
        dns: false,
        multicast_dns: false,
        fs: false,
        net: false,
        tls: false,
        path: false,
      };
      config.externals = config.externals || [];
      config.externals.push('multicast-dns');
    }
    return config;
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
