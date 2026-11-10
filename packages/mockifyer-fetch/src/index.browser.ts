// Browser entry - wraps main index.ts with browser-specific validation
// Re-exports everything except validates provider type

export * from './index';

// Re-export with type narrowing for browser
import type { MockifyerConfig } from '@sgedda/mockifyer-core';
import { setupMockifyer as setupMockifyerNode, type MockifyerInstance } from './index';

/**
 * Setup Mockifyer for browser/Expo web with in-memory provider.
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
 *       fixtures: [rates] // Preload from static JSON imports
 *     }
 *   },
 *   recordMode: false,
 *   failOnMissingMock: true, // Throw on cache miss
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

  return setupMockifyerNode(config);
}
