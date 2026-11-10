// Browser-only entry point - NO imports from index.ts or Node-only modules
// This file must never transitively import fs, path, crypto, or any Node built-ins

// Types
export * from './types';
export * from './types/http-client';
export * from './types/override-group';

// HTTP client
export * from './clients/base-http-client';

// Browser-safe utils
export * from './utils/mock-matcher';
export * from './utils/mock-body-similarity';
// date.ts uses fs - exclude
// export * from './utils/date';
export * from './utils/runtime-date-sync';
export * from './utils/mock-response-date-overrides';
// scenario.ts uses fs/path - exclude
// export * from './utils/scenario';
// scenario-meta.ts uses fs - exclude  
// export * from './utils/scenario-meta';
export * from './utils/test-generator';
export * from './utils/logger';
export * from './utils/file-naming';
export * from './utils/url-exclusion';
export * from './utils/recording-exclusion';
export * from './utils/mock-passthrough';
export * from './utils/mock-replay-mode';
export * from './utils/request-only-mock';
export * from './utils/inbound-parent-stub';
// domain-path-rules.ts is safe
export * from './utils/domain-path-rules';
// domain-path-rules-file.ts uses fs - exclude
// export * from './utils/domain-path-rules-file';
// domain-path-rules-session.ts uses fs - exclude
// export * from './utils/domain-path-rules-session';
export * from './utils/record-passthrough-config';
export * from './utils/client-id';
export * from './utils/runtime-client-id';
export * from './utils/launch-arguments-client-id';
export * from './utils/launch-arguments-scenario';
export * from './utils/activation-mode';
export * from './utils/outbound-header';
export * from './utils/request-correlation';
export * from './utils/hop-identity';
export * from './utils/inline-trace';
export * from './utils/mockifyer-trace';
export * from './utils/runtime-mode';
export * from './utils/runtime-enabled-persist';
export * from './utils/react-native-activation';
export * from './utils/strict-proxy-scenario';
export * from './utils/proxy-strict-lane-scenario';
export * from './utils/proxy-upstream-tls-insecure';
export * from './utils/proxy-record-on-miss-env';
export * from './utils/join-proxy-dashboard-api-url';
export * from './utils/redis-mock-write-limits';
export * from './utils/dashboard-central-proxy-health';
export * from './utils/dashboard-proxy-envelope';
export * from './utils/proxy-request-body';
export * from './utils/perform-dashboard-proxy-request';
export * from './utils/apply-proxy-record-on-miss-env';
export * from './utils/init-mockifyer-presets';
// mirror-proxy-recording-to-client.ts uses fs/path - exclude
// export * from './utils/mirror-proxy-recording-to-client';
export * from './utils/recording-default-always-live';
export * from './utils/mockifyer-init-log';
export * from './utils/mock-response-field-overrides';
export * from './utils/mock-response-prepare';
export * from './utils/override-group';
export * from './utils/override-group-runtime';
export * from './utils/override-group-resolve';
export * from './utils/mock-recording-sidecars';
export * from './utils/network-log';
export * from './utils/network-event-twins';
export * from './utils/append-params-to-url';
export * from './utils/dashboard-network-trace-fetch';
export * from './utils/graphql-body-display';
// network-body-spill.ts uses fs - exclude
// export * from './utils/network-body-spill';
export * from './utils/network-trace';
export * from './utils/metro-network-stream';
export * from './utils/metro-atlas-runtime-sync';
export * from './utils/hop-chain';
export * from './utils/atlas';
export * from './utils/atlas-cache';
export * from './utils/atlas-cms-renderer';
export * from './utils/atlas-doc';
// atlas-doc-html.ts uses fs - exclude
// export * from './utils/atlas-doc-html';
export * from './utils/atlas-live-html';
export * from './utils/atlas-trace-replay';
export * from './utils/atlas-syntax-highlight';
export * from './utils/atlas-doc-data';
export * from './utils/atlas-usage';
// atlas-screenshot.ts uses fs - exclude
// export * from './utils/atlas-screenshot';
export * from './utils/atlas-request-scrubber';
export * from './utils/flight-recorder';
export * from './utils/response-shape';
export * from './utils/incidents';
export * from './utils/fixture-pool';

// EXCLUDED (use Node built-ins):
// - ./utils/override-sets (uses fs)
// - ./utils/override-sets-fs (uses fs)
// - ./utils/override-group-fs (uses fs)
// - ./utils/metro-network-stream-tty (uses url, path)
// - ./utils/atlas-har (uses fs)
// - ./utils/ai-context (uses fs)
// - ./utils/redis-cluster-ops (uses ioredis)
// - ./utils/create-io-redis-client (uses ioredis)
// - ./utils/build-utils (uses fs, path)

// Browser-safe provider only
export { MemoryProvider } from './providers/memory-provider';
export * from './providers/types';

// DO NOT export FilesystemProvider, RedisProvider, SQLiteProvider, HybridProvider, ExpoFileSystemProvider
// DO NOT export ./providers/index (contains createProvider with all providers)

// Browser-safe provider factory
import { DatabaseProvider, DatabaseProviderConfig } from './providers/types';
import { MemoryProvider } from './providers/memory-provider';

export type BrowserProviderType = 'memory';

/**
 * Create a database provider for browser environments.
 * Only 'memory' is supported. For Node.js providers, import from '@sgedda/mockifyer-core' (default entry).
 */
export function createProvider(
  type: BrowserProviderType,
  config: DatabaseProviderConfig
): DatabaseProvider {
  if (type === 'memory') {
    return new MemoryProvider(config);
  }
  throw new Error(
    `[Mockifyer Browser] Provider '${type}' is not supported. ` +
    `Only 'memory' is available in browser builds. ` +
    `For filesystem/redis/sqlite providers, use Node.js (import from '@sgedda/mockifyer-core' without /browser).`
  );
}
