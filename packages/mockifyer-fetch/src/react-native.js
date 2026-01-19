"use strict";
/**
 * React Native/Expo Helper Functions
 *
 * Simplified setup for React Native applications with automatic
 * conditional provider selection (FileSystem in dev, Memory in prod)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMockifyerForReactNative = setupMockifyerForReactNative;
const index_1 = require("./index");
const mockifyer_core_1 = require("@sgedda/mockifyer-core");
// Lazy load bundled data (only used in production builds)
let bundledMockData = null;
/**
 * Load bundled mock data from a TypeScript/JavaScript module
 *
 * Note: For React Native/Metro, we need to handle dynamic imports differently
 * Metro doesn't support dynamic require() with variables, so we use a workaround
 */
async function loadBundledMockData(bundledDataPath) {
    if (bundledMockData) {
        return bundledMockData;
    }
    try {
        // Metro bundler doesn't support dynamic require() with variables
        // We use eval with a fully constructed string to avoid Metro's static analysis
        // This bypasses Metro's static analysis completely
        const r = 'r';
        const e = 'e';
        const q = 'q';
        const u = 'u';
        const i = 'i';
        const req = r + e + q + u + i + r + e;
        // eslint-disable-next-line no-eval
        const module = eval(`${req}(${JSON.stringify(bundledDataPath)})`);
        const data = Array.isArray(module.mockData)
            ? module.mockData
            : [module.mockData];
        bundledMockData = data;
        return data;
    }
    catch (error) {
        console.warn('[Mockifyer] Could not load bundled mock data:', error);
        return [];
    }
}
/**
 * Setup Mockifyer for React Native/Expo with automatic conditional provider selection
 *
 * - Development (isDev === true): Uses Expo FileSystem provider - can record mocks
 * - Production (isDev === false): Uses Memory provider with bundled TypeScript file
 *
 * @example
 * ```typescript
 * import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';
 *
 * await setupMockifyerForReactNative({
 *   isDev: __DEV__, // Pass React Native's __DEV__ variable
 *   mockDataPath: 'mock-data',
 *   bundledDataPath: './assets/mock-data',
 *   recordMode: process.env.MOCKIFYER_RECORD === 'true',
 * });
 * ```
 */
async function setupMockifyerForReactNative(options) {
    const { isDev, mockDataPath = 'mock-data', bundledDataPath = './assets/mock-data', recordMode = false, config = {}, } = options;
    // Check if Mockifyer is enabled
    const isEnabled = process.env.MOCKIFYER_ENABLED === 'true' || isDev;
    if (!isEnabled) {
        console.log('[Mockifyer] Disabled');
        return null;
    }
    if (isDev === true) {
        // DEVELOPMENT MODE (React Native app running in dev)
        // Use Hybrid provider - saves to both device AND project folder simultaneously
        // Files are immediately available in project folder (no polling needed)
        // Note: The provider's initialize() is async and will be handled by the provider methods
        const metroPort = process.env.METRO_PORT ? parseInt(process.env.METRO_PORT, 10) : 8081;
        // Merge database provider config from options if provided
        const baseDatabaseProvider = {
            type: 'hybrid',
            path: mockDataPath,
            options: {
                metroPort,
            },
        };
        // Merge with config.databaseProvider if provided
        const databaseProviderConfig = config.databaseProvider
            ? {
                ...baseDatabaseProvider,
                ...config.databaseProvider,
                options: {
                    ...baseDatabaseProvider.options,
                    ...(config.databaseProvider.options || {}),
                    metroPort, // Always ensure metroPort is set
                },
            }
            : baseDatabaseProvider;
        const instance = (0, index_1.setupMockifyer)({
            mockDataPath,
            databaseProvider: databaseProviderConfig,
            recordMode,
            useGlobalFetch: true,
            ...config,
        });
        console.log('[Mockifyer] Development mode: Using Hybrid provider (device + project folder)');
        console.log(`[Mockifyer] Metro endpoint: http://localhost:${metroPort}/mockifyer-save`);
        if (recordMode) {
            console.log('[Mockifyer] Recording mode enabled - new API responses will be saved');
        }
        return instance;
    }
    else {
        // PRODUCTION BUILD MODE
        // Use Memory provider with bundled TypeScript file
        const provider = new mockifyer_core_1.MemoryProvider({});
        provider.initialize();
        // Load bundled mock data
        const mockDataArray = await loadBundledMockData(bundledDataPath);
        if (mockDataArray.length === 0) {
            console.warn('[Mockifyer] No bundled mock data found. Make sure to run the build script first.');
            return null;
        }
        // Pre-load all mocks into memory
        for (const mockData of mockDataArray) {
            provider.save(mockData);
        }
        const instance = (0, index_1.setupMockifyer)({
            mockDataPath: './mock-data', // Not used with memory provider
            databaseProvider: {
                type: 'memory',
            },
            recordMode: false, // Can't record in production builds
            useGlobalFetch: true,
            ...config,
        });
        console.log(`[Mockifyer] Production mode: Loaded ${mockDataArray.length} mocks from bundle`);
        return instance;
    }
}
