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
import { BrowserDashboardSync } from './browser-dashboard-sync';
import { BrowserDashboardClient } from '@sgedda/mockifyer-core/dist/utils/dashboard-client.browser';
import { isMockifyerDashboardPlumbingApiUrl } from '@sgedda/mockifyer-core';

// Re-export dashboard client
export { BrowserDashboardSync } from './browser-dashboard-sync';
export { BrowserDashboardClient } from '@sgedda/mockifyer-core/dist/utils/dashboard-client.browser';

// MockifyerInstance interface
export interface BrowserDashboardConfig {
  /** Dashboard base URL (e.g. 'http://localhost:3002') */
  dashboardBaseUrl: string;
  /** Optional HTTP Basic Auth credentials */
  auth?: { user: string; password: string };
  /** Client ID for lane-based scenario isolation */
  clientId?: string;
  /** Poll interval for scenario changes (ms, default 2000) */
  pollIntervalMs?: number;
  /** Enable automatic scenario sync from dashboard (default true) */
  enableScenarioSync?: boolean;
  /** Enable network event reporting to dashboard (default true) */
  enableNetworkEvents?: boolean;
}

export interface BrowserMockifyerConfig extends MockifyerConfig {
  /** Dashboard connection config (optional) */
  dashboard?: BrowserDashboardConfig;
}

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
  getScenario: () => string;
  setScenario: (scenario: string) => Promise<void>;
  getDashboardSync: () => BrowserDashboardSync | null;
}

/**
 * Setup Mockifyer for browser/web with in-memory provider.
 * 
 * **Browser-specific constraints:**
 * - Only `memory` provider is supported (filesystem/redis/sqlite need Node.js)
 * - Preload fixtures via `databaseProvider.options.fixtures: MockData[]`
 * - Dashboard connection is optional for scenario sync and network event reporting
 * 
 * @example Basic (in-memory only):
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
 * 
 * @example With dashboard connection:
 * ```ts
 * const mockifyer = setupMockifyer({
 *   mockDataPath: './mock-data',
 *   databaseProvider: { type: 'memory', options: { fixtures: [...] } },
 *   dashboard: {
 *     dashboardBaseUrl: 'http://localhost:3002',
 *     clientId: 'web-client',
 *     enableScenarioSync: true,
 *     enableNetworkEvents: true
 *   }
 * });
 * ```
 */
export function setupMockifyer(config: BrowserMockifyerConfig): MockifyerInstance {
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
  
  // Get HTTP client
  const httpClient = mockifyer.getHTTPClient();
  
  // Store original fetch before patching (needed for dashboard client)
  let originalFetch: typeof fetch;
  if ((globalThis as any).__mockifyer_original_fetch) {
    originalFetch = (globalThis as any).__mockifyer_original_fetch;
  } else {
    originalFetch = globalThis.fetch;
    (globalThis as any).__mockifyer_original_fetch = originalFetch;
  }
  
  // Set original fetch on HTTP client so dashboard calls don't recurse
  const fetchClient = httpClient as any;
  if (fetchClient && typeof fetchClient.performRequest === 'function') {
    fetchClient._originalFetch = originalFetch;
  }
  
  // Initialize dashboard sync if configured
  let dashboardSync: BrowserDashboardSync | null = null;
  const enableNetworkEvents = config.dashboard?.enableNetworkEvents !== false;
  
  if (config.dashboard) {
    const dashboardClient = new BrowserDashboardClient({
      dashboardBaseUrl: config.dashboard.dashboardBaseUrl,
      auth: config.dashboard.auth,
      clientId: config.dashboard.clientId ?? mockifyer.getClientId(),
    });

    const enableScenarioSync = config.dashboard.enableScenarioSync !== false;

    dashboardSync = new BrowserDashboardSync({
      dashboardClient,
      onScenarioChange: enableScenarioSync
        ? (scenario) => {
            console.log(`[Mockifyer] Dashboard scenario changed: ${scenario}`);
            (config as any).scenarios = scenario;
            browserCapabilities.getCurrentScenario = () => scenario;
          }
        : undefined,
      pollIntervalMs: config.dashboard.pollIntervalMs,
    });

    if (enableScenarioSync) {
      dashboardSync.start();
      console.log(
        `[Mockifyer] Dashboard sync started (${config.dashboard.dashboardBaseUrl}${
          config.dashboard.clientId ? `, lane: ${config.dashboard.clientId}` : ''
        })`
      );
    }
  }
  
  // Patch global fetch if useGlobalFetch is true
  if (config.useGlobalFetch) {
    const originalFetchForPatched = (globalThis as any).__mockifyer_original_fetch || originalFetch;
    const mockifyerInstance = mockifyer;
    
    globalThis.fetch = async function(input: string | Request | URL, init?: RequestInit): Promise<Response> {
      if (!mockifyerInstance.isMockifyerEnabled()) {
        return await originalFetchForPatched(input, init);
      }
      
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      
      // Skip dashboard plumbing URLs to avoid recursion
      if (isMockifyerDashboardPlumbingApiUrl(url)) {
        return await originalFetchForPatched(input, init);
      }
      
      const method = (init?.method || 'GET').toUpperCase();
      
      // Perform the request through mockifyer
      const response = await httpClient.request({
        method,
        url,
        headers: init?.headers as Record<string, string> || {},
        data: init?.body,
      });
      
      // Report network event if enabled
      if (enableNetworkEvents && dashboardSync) {
        const networkEvent = {
          transport: 'fetch' as const,
          method,
          url,
          status: response.status,
          source: (response as any).mockifyerTrace?.source || 'mock-hit' as const,
          requestHeaders: init?.headers as Record<string, string>,
          responseHeaders: response.headers,
        };
        dashboardSync.postNetworkEvent(networkEvent);
      }
      
      // Convert mockifyer response to fetch Response
      return new Response(
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        {
          status: response.status,
          headers: new Headers(response.headers || {})
        }
      );
    };
  }
  
  // Return httpClient extended with mockifyer methods
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
  extendedClient.getScenario = () => {
    if (typeof config.scenarios === 'string') {
      return config.scenarios;
    }
    return 'default';
  };
  extendedClient.setScenario = async (scenario: string) => {
    (config as any).scenarios = scenario;
    if (dashboardSync) {
      const client = (dashboardSync as any).client as BrowserDashboardClient;
      if (client.clientId) {
        await client.setClientLaneScenario(client.clientId, scenario);
      } else {
        await client.setScenario(scenario);
      }
    }
  };
  extendedClient.getDashboardSync = () => dashboardSync;
  
  return extendedClient;
}
