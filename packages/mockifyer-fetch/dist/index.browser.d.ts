/**
 * Browser entry for mockifyer-fetch.
 * Avoids statically loading Node built-ins by not re-exporting the full main index barrel.
 */
import type { MockifyerConfig, MockData, StoredRequest, StoredResponse, HTTPClient, HTTPResponse, DatabaseProvider, DatabaseProviderConfig } from '@sgedda/mockifyer-core';
export type { MockifyerConfig, MockData, StoredRequest, StoredResponse, HTTPClient, HTTPResponse, DatabaseProvider, DatabaseProviderConfig, };
export { MemoryProvider, createProvider, } from '@sgedda/mockifyer-core';
export { FetchHTTPClient } from './clients/fetch-client';
export { bodyInitForFetchResponse } from './utils/fetch-response-body';
export { resolvePatchedFetchRequest } from './utils/resolve-patched-fetch-request';
export { canUseDashboardRedisProxy, canUseDashboardCentralProxy, } from './utils/dashboard-redis-health';
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
export declare function setupMockifyer(config: MockifyerConfig): MockifyerInstance;
