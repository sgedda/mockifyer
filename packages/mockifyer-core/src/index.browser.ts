/**
 * Browser entry - excludes modules with Node built-in dependencies.
 * Exports all browser-safe types and utilities.
 */

// Re-export most types and utilities from main index
// Exclude only the specific files that import Node built-ins
export * from './types';
export * from './types/http-client';
export * from './types/override-group';
export * from './clients/base-http-client';
export * from './utils/mock-matcher';
export * from './utils/mock-body-similarity';
export * from './utils/runtime-date-sync';
export * from './utils/mock-response-date-overrides';
export * from './utils/test-generator';
export * from './utils/logger';
// file-naming imports crypto-digest - EXCLUDED
// export * from './utils/file-naming';
export * from './utils/url-exclusion';
export * from './utils/recording-exclusion';
export * from './utils/mock-passthrough';
export * from './utils/mock-replay-mode';
export * from './utils/request-only-mock';
// inbound-parent-stub imports crypto-digest - EXCLUDED
// export * from './utils/inbound-parent-stub';
export * from './utils/domain-path-rules';
export * from './utils/record-passthrough-config';
export * from './utils/client-id';
export * from './utils/runtime-client-id';
export * from './utils/launch-arguments-client-id';
export * from './utils/launch-arguments-scenario';
export * from './utils/activation-mode';
export * from './utils/outbound-header';
// hop-identity imports crypto-digest - EXCLUDED
// export * from './utils/hop-identity';
// inline-trace imports crypto-digest + network-body-spill - EXCLUDED
// export * from './utils/inline-trace';
// mockifyer-trace imports request-correlation - EXCLUDED
// export * from './utils/mockifyer-trace';
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
// perform-dashboard-proxy-request imports request-correlation + serialize-proxy-request-body - EXCLUDED
// export * from './utils/perform-dashboard-proxy-request';
export * from './utils/apply-proxy-record-on-miss-env';
// init-mockifyer-presets imports scenario + request-correlation - EXCLUDED
// export * from './utils/init-mockifyer-presets';
export * from './utils/recording-default-always-live';
// mockifyer-init-log imports scenario - EXCLUDED
// export * from './utils/mockifyer-init-log';
export * from './utils/mock-response-field-overrides';
export * from './utils/mock-response-prepare';
export * from './utils/override-group';
export * from './utils/override-group-runtime';
export * from './utils/override-group-resolve';
export * from './utils/mock-recording-sidecars';
// network-log imports crypto-digest + network-body-spill + atlas-doc-html - EXCLUDED
// export * from './utils/network-log';
export * from './utils/network-event-twins';
export * from './utils/append-params-to-url';
export * from './utils/dashboard-network-trace-fetch';
export * from './utils/graphql-body-display';
export * from './utils/network-trace';
// metro-network-stream imports crypto-digest + network-body-spill - EXCLUDED
// export * from './utils/metro-network-stream';
export * from './utils/metro-atlas-runtime-sync';
export * from './utils/hop-chain';
// atlas imports crypto-digest + network-body-spill + atlas-doc-html - EXCLUDED
// export * from './utils/atlas';
export * from './utils/atlas-cache';
export * from './utils/atlas-cms-renderer';
// atlas-doc imports scenario + atlas-doc-html - EXCLUDED
// export * from './utils/atlas-doc';
export * from './utils/atlas-live-html';
export * from './utils/atlas-trace-replay';
export * from './utils/atlas-syntax-highlight';
// atlas-doc-data imports crypto-digest + network-body-spill + scenario + atlas-doc-html - EXCLUDED
// export * from './utils/atlas-doc-data';
// atlas-usage imports crypto-digest - EXCLUDED
// export * from './utils/atlas-usage';
export * from './utils/atlas-request-scrubber';
export * from './utils/flight-recorder';
export * from './utils/response-shape';
// incidents imports crypto-digest - EXCLUDED
// export * from './utils/incidents';
export * from './utils/fixture-pool';

// EXCLUDED - Direct Node dependencies:
// - ./utils/date, ./utils/scenario, ./utils/scenario-meta (fs/path)
// - ./utils/domain-path-rules-file, ./utils/domain-path-rules-session (fs)
// - ./utils/request-correlation (http/https)
// - ./utils/mirror-proxy-recording-to-client (fs/path)
// - ./utils/proxy-request-body (buffer)
// - ./utils/override-sets (imports crypto-digest)
// - ./utils/network-body-spill, ./utils/atlas-doc-html, ./utils/atlas-screenshot (fs)
// 
// EXCLUDED - Transitive Node dependencies:
// - ./utils/file-naming, ./utils/hop-identity (→ crypto-digest)
// - ./utils/inline-trace (→ crypto-digest, network-body-spill)
// - ./utils/network-log (→ crypto-digest, network-body-spill, atlas-doc-html)
// - ./utils/metro-network-stream (→ crypto-digest, network-body-spill)
// - ./utils/atlas* (→ crypto-digest, network-body-spill, atlas-doc-html, scenario)
// - ./utils/mockifyer-init-log (→ scenario)
// - ./utils/init-mockifyer-presets (→ scenario, request-correlation)
// - ./utils/mockifyer-trace (→ request-correlation)
// - ./utils/perform-dashboard-proxy-request (→ request-correlation, serialize-proxy-request-body)
// - ./utils/incidents (→ crypto-digest)
// - ./utils/redis-mock-write-limits (→ crypto-digest)

// Memory provider only (browser-safe)
export * from './providers/types';
export * from './providers/memory-provider';
export { MemoryProvider } from './providers/memory-provider';

import { DatabaseProvider, DatabaseProviderConfig } from './providers/types';
import { MemoryProvider } from './providers/memory-provider';

/**
 * Create a database provider (browser bundle).
 * Only `memory` provider is available.
 */
export function createProvider(
  type: string,
  config: DatabaseProviderConfig
): DatabaseProvider {
  if (type === 'memory') {
    return new MemoryProvider(config);
  }
  throw new Error(
    `[Mockifyer Browser] Provider '${type}' requires Node.js built-ins. ` +
    `In browser builds, only 'memory' provider is supported.`
  );
}
