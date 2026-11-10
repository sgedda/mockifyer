/**
 * Browser entry - excludes Node-only providers (filesystem, sqlite, redis)
 * so nothing in this graph statically imports `fs`, `path`, `crypto`, or `ioredis`.
 */
export * from './types';
export * from './types/http-client';
export * from './clients/base-http-client';
export * from './utils/mock-matcher';
export * from './utils/mock-body-similarity';
export * from './utils/date';
export * from './utils/runtime-date-sync';
export * from './utils/mock-response-date-overrides';
export * from './utils/scenario';
export * from './utils/scenario-meta';
// Export only browser-safe providers (no fs/path/crypto)
export * from './providers/types';
export * from './providers/memory-provider';
export * from './utils/test-generator';
export * from './utils/logger';
export * from './utils/file-naming';
export * from './utils/url-exclusion';
export * from './utils/recording-exclusion';
export * from './utils/mock-passthrough';
export * from './utils/mock-replay-mode';
export * from './utils/request-only-mock';
export * from './utils/inbound-parent-stub';
export * from './utils/domain-path-rules';
export * from './utils/domain-path-rules-session';
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
export * from './utils/dashboard-central-proxy-health';
export * from './utils/dashboard-proxy-envelope';
export * from './utils/proxy-request-body';
export * from './utils/perform-dashboard-proxy-request';
export * from './utils/apply-proxy-record-on-miss-env';
export * from './utils/init-mockifyer-presets';
export * from './utils/mirror-proxy-recording-to-client';
export * from './utils/recording-default-always-live';
export * from './utils/mockifyer-init-log';
export * from './utils/mock-response-field-overrides';
export * from './utils/mock-response-prepare';
export * from './utils/override-sets';
export * from './types/override-group';
export * from './utils/override-group';
export * from './utils/override-group-runtime';
export * from './utils/override-group-resolve';
export * from './utils/mock-recording-sidecars';
export * from './utils/network-log';
export * from './utils/network-event-twins';
export * from './utils/append-params-to-url';
export * from './utils/dashboard-network-trace-fetch';
export * from './utils/graphql-body-display';
export * from './utils/network-body-spill';
export * from './utils/network-trace';
export * from './utils/metro-network-stream';
export * from './utils/metro-atlas-runtime-sync';
export * from './utils/hop-chain';
export * from './utils/atlas';
export * from './utils/atlas-cache';
export * from './utils/atlas-cms-renderer';
export * from './utils/atlas-doc';
export * from './utils/atlas-doc-html';
export * from './utils/atlas-live-html';
export * from './utils/atlas-trace-replay';
export * from './utils/atlas-syntax-highlight';
export * from './utils/atlas-doc-data';
export * from './utils/atlas-har';
export * from './utils/atlas-usage';
export * from './utils/atlas-screenshot';
export * from './utils/atlas-request-scrubber';
export * from './utils/flight-recorder';
export * from './utils/response-shape';
export * from './utils/incidents';
export * from './utils/fixture-pool';

import { DatabaseProvider, DatabaseProviderConfig } from './providers/types';
import { MemoryProvider } from './providers/memory-provider';

export { MemoryProvider };

/**
 * Create a database provider (browser bundle).
 * Only `memory` provider is available - filesystem/sqlite/redis require Node.js.
 */
export function createProvider(
  type: string,
  config: DatabaseProviderConfig
): DatabaseProvider {
  if (type === 'memory') {
    return new MemoryProvider(config);
  }
  throw new Error(
    `[Mockifyer Browser] Provider '${type}' requires Node.js built-ins (fs/path/crypto). ` +
    `In browser builds, only 'memory' provider is supported. ` +
    `Use: databaseProvider: { type: 'memory', options: { fixtures: [...] } }`
  );
}
