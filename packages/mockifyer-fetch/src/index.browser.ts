// Browser-only entry - imports from core/browser, never pulls in Node built-ins
// The MockifyerClass from index.ts uses lazy-loaded fs/path which is safe for browsers

// Re-export core browser-safe modules
export * from '@sgedda/mockifyer-core/dist/index.browser';

// Import the main MockifyerClass which has lazy fs/path loading
// This is safe because getFs()/getPath() return null in browsers
import {
  setupMockifyer as setupMockifyerNode,
  initMockifyerForDashboardProxy as initDashboardProxyNode,
  initMockifyerForLocalFilesystem as initLocalFilesystemNode,
  type MockifyerInstance,
  canUseDashboardCentralProxy,
  canUseDashboardRedisProxy,
} from './index';

// Re-export with browser-specific validation
export { canUseDashboardCentralProxy, canUseDashboardRedisProxy };
export type { MockifyerInstance };

/**
 * Setup Mockifyer for browser/Expo web environments.
 * Requires MemoryProvider with preloaded fixtures.
 * 
 * @example
 * ```ts
 * import { setupMockifyer } from '@sgedda/mockifyer-fetch';
 * import rates from './fixtures/api.frankfurter.dev/v1/GET_latest.json';
 * 
 * const mockifyer = setupMockifyer({
 *   mockDataPath: './fixtures',
 *   databaseProvider: {
 *     type: 'memory',
 *     options: { fixtures: [rates] }
 *   },
 *   recordMode: false,
 *   failOnMissingMock: true,
 *   useGlobalFetch: true
 * });
 * ```
 */
export function setupMockifyer(config: any): MockifyerInstance {
  // Validate browser-safe configuration
  if (config.databaseProvider?.type && config.databaseProvider.type !== 'memory') {
    throw new Error(
      `[Mockifyer Browser] Provider '${config.databaseProvider.type}' requires Node.js. ` +
      `Use databaseProvider: { type: 'memory', options: { fixtures: [...] } } in browser builds.`
    );
  }
  
  if (!config.databaseProvider) {
    throw new Error(
      `[Mockifyer Browser] No databaseProvider configured. ` +
      `Browser builds require: databaseProvider: { type: 'memory', options: { fixtures: [...] } }`
    );
  }

  return setupMockifyerNode(config);
}

/**
 * Dashboard proxy preset for browser (requires memory provider).
 */
export async function initMockifyerForDashboardProxy(
  options: any
): Promise<MockifyerInstance> {
  if (options.databaseProvider?.type && options.databaseProvider.type !== 'memory') {
    throw new Error(
      `[Mockifyer Browser] Dashboard proxy in browser requires memory provider. ` +
      `Set databaseProvider: { type: 'memory', options: { fixtures: [...] } }`
    );
  }
  return initDashboardProxyNode(options);
}

/**
 * Local filesystem preset is NOT supported in browser - throws error.
 * Use setupMockifyer with memory provider instead.
 */
export function initMockifyerForLocalFilesystem(_options: any): never {
  throw new Error(
    `[Mockifyer Browser] initMockifyerForLocalFilesystem requires Node.js filesystem. ` +
    `Use setupMockifyer({ databaseProvider: { type: 'memory', options: { fixtures: [...] } } }) instead.`
  );
}
