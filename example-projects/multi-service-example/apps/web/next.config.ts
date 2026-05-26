import type { NextConfig } from 'next';
import path from 'path';

/** Monorepo root (`mockifyer`), four levels above apps/web — includes `packages/mockifyer-*` for imports */
const repoRoot = path.join(__dirname, '../../../../');

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sgedda/mockifyer-fetch', '@sgedda/mockifyer-core', 'ioredis'],
  outputFileTracingRoot: repoRoot,
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
