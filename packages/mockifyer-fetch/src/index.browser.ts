/**
 * Browser entry for mockifyer-fetch.
 * Avoids statically loading Node built-ins by not re-exporting the full main index barrel.
 */

// Re-export all browser-safe core exports (uses core's browser entry via package.json browser field)
export * from '@sgedda/mockifyer-core';

// Re-export browser-safe fetch utilities
export { FetchHTTPClient } from './clients/fetch-client';
export { bodyInitForFetchResponse } from './utils/fetch-response-body';
export { resolvePatchedFetchRequest } from './utils/resolve-patched-fetch-request';

export {
  canUseDashboardRedisProxy,
  canUseDashboardCentralProxy,
} from './utils/dashboard-redis-health';

// Import setupMockifyer from main index (specific import, not export *)
import { setupMockifyer as setupMockifyerNode, type MockifyerInstance } from './index';

// Re-export the interface
export type { MockifyerInstance };

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
export function setupMockifyer(config: import('@sgedda/mockifyer-core').MockifyerConfig): MockifyerInstance {
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

  return setupMockifyerNode(config);
}
