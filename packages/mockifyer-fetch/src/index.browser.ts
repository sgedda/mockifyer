/**
 * Browser entry for mockifyer-fetch.
 * Avoids statically loading Node built-ins by not re-exporting the full main index barrel.
 */

// Re-export only essential types and browser-safe utilities from core
// DO NOT use `export * from '@sgedda/mockifyer-core'` - it pulls in Node-dependent modules
import type {
  MockifyerConfig,
  MockData,
  StoredRequest,
  StoredResponse,
  HTTPClient,
  HTTPResponse,
  DatabaseProvider,
  DatabaseProviderConfig,
} from '@sgedda/mockifyer-core';

export type {
  MockifyerConfig,
  MockData,
  StoredRequest,
  StoredResponse,
  HTTPClient,
  HTTPResponse,
  DatabaseProvider,
  DatabaseProviderConfig,
};

export {
  MemoryProvider,
  createProvider,
} from '@sgedda/mockifyer-core';

// Re-export browser-safe fetch utilities
export { FetchHTTPClient } from './clients/fetch-client';
export { bodyInitForFetchResponse } from './utils/fetch-response-body';
export { resolvePatchedFetchRequest } from './utils/resolve-patched-fetch-request';

export {
  canUseDashboardRedisProxy,
  canUseDashboardCentralProxy,
} from './utils/dashboard-redis-health';

// Import MockifyerClass and browser capabilities
import { MockifyerClass } from './mockifyer-class';
import { browserCapabilities } from './node-capabilities.browser';

// MockifyerInstance interface
export interface MockifyerInstance extends HTTPClient {
  reloadMockData: (syncFromProject?: boolean) => Promise<void>;
  clearStaleCacheEntries: () => number;
  clearAllMocks: () => Promise<void>;
  setClientId: (lane: string) => void;
  getClientId: () => string | undefined;
  setRecordMode: (enabled: boolean) => void;
  isRecordMode: () => boolean;
  setRecordResponses: (enabled: boolean) => void;
  isRecordResponses: () => boolean;
  enableMockifyer: () => void;
  disableMockifyer: () => void;
  isMockifyerEnabled: () => boolean;
}

/**
 * Setup Mockifyer for browser/web with in-memory provider.
 * 
 * **Browser-specific constraints:**
 * - Only `memory` provider is supported (filesystem/redis/sqlite need Node.js)
 * - Preload fixtures via `databaseProvider.options.fixtures: MockData[]`
 * 
 * @example
 * ```ts
 * import { setupMockifyer } from '@sgedda/mockifyer-fetch';
 * import rates from './mock-data/api.frankfurter.dev/v1/latest.json';
 * 
 * const mockifyer = setupMockifyer({
 *   mockDataPath: './mock-data',
 *   databaseProvider: {
 *     type: 'memory',
 *     options: {
 *       fixtures: [rates]
 *     }
 *   },
 *   recordMode: false,
 *   failOnMissingMock: true,
 *   useGlobalFetch: true
 * });
 * ```
 */
export function setupMockifyer(config: MockifyerConfig): MockifyerInstance {
  // Validate browser-safe config
  if (config.databaseProvider && config.databaseProvider.type && config.databaseProvider.type !== 'memory') {
    throw new Error(
      `[Mockifyer Browser] Provider '${config.databaseProvider.type}' requires Node.js (fs/path/crypto). ` +
      `Use databaseProvider: { type: 'memory', options: { fixtures: [...] } } in browser builds.`
    );
  }

  if (!config.databaseProvider) {
    console.warn(
      '[Mockifyer Browser] No databaseProvider configured. Falling back to memory provider. ' +
      'Preload fixtures via databaseProvider: { type: "memory", options: { fixtures: [...] } }'
    );
    config.databaseProvider = { type: 'memory', options: {} };
  }

  // Create with browser capabilities (no Node fs/path/crypto)
  const mockifyer = new MockifyerClass(config, browserCapabilities);
  
  // Return httpClient extended with mockifyer methods (same pattern as Node entry)
  const httpClient = mockifyer.getHTTPClient();
  const extendedClient = httpClient as any;
  
  extendedClient.reloadMockData = (syncFromProject?: boolean) => mockifyer.reloadMockData(syncFromProject);
  extendedClient.clearStaleCacheEntries = () => mockifyer.clearStaleCacheEntries();
  extendedClient.clearAllMocks = () => mockifyer.clearAllMocks();
  extendedClient.setClientId = (lane: string) => mockifyer.setClientId(lane);
  extendedClient.getClientId = () => mockifyer.getClientId();
  extendedClient.setRecordMode = (enabled: boolean) => mockifyer.setRecordMode(enabled);
  extendedClient.isRecordMode = () => mockifyer.isRecordMode();
  extendedClient.setRecordResponses = (enabled: boolean) => mockifyer.setRecordResponses(enabled);
  extendedClient.isRecordResponses = () => mockifyer.isRecordResponses();
  extendedClient.enableMockifyer = () => mockifyer.enableMockifyer();
  extendedClient.disableMockifyer = () => mockifyer.disableMockifyer();
  extendedClient.isMockifyerEnabled = () => mockifyer.isMockifyerEnabled();
  
  return extendedClient;
}
