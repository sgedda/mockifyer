"use strict";
/**
 * Browser entry for mockifyer-fetch.
 * Avoids statically loading Node built-ins by not re-exporting the full main index barrel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUseDashboardCentralProxy = exports.canUseDashboardRedisProxy = exports.resolvePatchedFetchRequest = exports.bodyInitForFetchResponse = exports.FetchHTTPClient = exports.createProvider = exports.MemoryProvider = void 0;
exports.setupMockifyer = setupMockifyer;
var mockifyer_core_1 = require("@sgedda/mockifyer-core");
Object.defineProperty(exports, "MemoryProvider", { enumerable: true, get: function () { return mockifyer_core_1.MemoryProvider; } });
Object.defineProperty(exports, "createProvider", { enumerable: true, get: function () { return mockifyer_core_1.createProvider; } });
// Re-export browser-safe fetch utilities
var fetch_client_1 = require("./clients/fetch-client");
Object.defineProperty(exports, "FetchHTTPClient", { enumerable: true, get: function () { return fetch_client_1.FetchHTTPClient; } });
var fetch_response_body_1 = require("./utils/fetch-response-body");
Object.defineProperty(exports, "bodyInitForFetchResponse", { enumerable: true, get: function () { return fetch_response_body_1.bodyInitForFetchResponse; } });
var resolve_patched_fetch_request_1 = require("./utils/resolve-patched-fetch-request");
Object.defineProperty(exports, "resolvePatchedFetchRequest", { enumerable: true, get: function () { return resolve_patched_fetch_request_1.resolvePatchedFetchRequest; } });
var dashboard_redis_health_1 = require("./utils/dashboard-redis-health");
Object.defineProperty(exports, "canUseDashboardRedisProxy", { enumerable: true, get: function () { return dashboard_redis_health_1.canUseDashboardRedisProxy; } });
Object.defineProperty(exports, "canUseDashboardCentralProxy", { enumerable: true, get: function () { return dashboard_redis_health_1.canUseDashboardCentralProxy; } });
// Import MockifyerClass and browser capabilities
const mockifyer_class_1 = require("./mockifyer-class");
const node_capabilities_browser_1 = require("./node-capabilities.browser");
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
function setupMockifyer(config) {
    // Validate browser-safe config
    if (config.databaseProvider && config.databaseProvider.type && config.databaseProvider.type !== 'memory') {
        throw new Error(`[Mockifyer Browser] Provider '${config.databaseProvider.type}' requires Node.js (fs/path/crypto). ` +
            `Use databaseProvider: { type: 'memory', options: { fixtures: [...] } } in browser builds.`);
    }
    if (!config.databaseProvider) {
        console.warn('[Mockifyer Browser] No databaseProvider configured. Falling back to memory provider. ' +
            'Preload fixtures via databaseProvider: { type: "memory", options: { fixtures: [...] } }');
        config.databaseProvider = { type: 'memory', options: {} };
    }
    // Create with browser capabilities (no Node fs/path/crypto)
    const mockifyer = new mockifyer_class_1.MockifyerClass(config, node_capabilities_browser_1.browserCapabilities);
    // Return httpClient extended with mockifyer methods (same pattern as Node entry)
    const httpClient = mockifyer.getHTTPClient();
    const extendedClient = httpClient;
    extendedClient.reloadMockData = (syncFromProject) => mockifyer.reloadMockData(syncFromProject);
    extendedClient.clearStaleCacheEntries = () => mockifyer.clearStaleCacheEntries();
    extendedClient.clearAllMocks = () => mockifyer.clearAllMocks();
    extendedClient.setClientId = (lane) => mockifyer.setClientId(lane);
    extendedClient.getClientId = () => mockifyer.getClientId();
    extendedClient.setRecordMode = (enabled) => mockifyer.setRecordMode(enabled);
    extendedClient.isRecordMode = () => mockifyer.isRecordMode();
    extendedClient.setRecordResponses = (enabled) => mockifyer.setRecordResponses(enabled);
    extendedClient.isRecordResponses = () => mockifyer.isRecordResponses();
    extendedClient.enableMockifyer = () => mockifyer.enableMockifyer();
    extendedClient.disableMockifyer = () => mockifyer.disableMockifyer();
    extendedClient.isMockifyerEnabled = () => mockifyer.isMockifyerEnabled();
    return extendedClient;
}
