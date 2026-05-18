import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // instrumentation.ts runs once per Node server process (see Next.js guides)
  serverExternalPackages: ['@sgedda/mockifyer-fetch', '@sgedda/mockifyer-core', 'ioredis'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  webpack: (config, { isServer }) => {
    if (isServer) {
      const nextExternals = config.externals;
      config.externals = [
        ...(Array.isArray(nextExternals) ? nextExternals : [nextExternals]),
        {
          '@sgedda/mockifyer-fetch': 'commonjs @sgedda/mockifyer-fetch',
          '@sgedda/mockifyer-core': 'commonjs @sgedda/mockifyer-core',
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
