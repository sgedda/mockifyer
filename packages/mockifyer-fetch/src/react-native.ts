/**
 * React Native/Expo Helper Functions
 * 
 * Simplified setup for React Native applications with automatic
 * conditional provider selection (FileSystem in dev, Memory in prod)
 */

import { setupMockifyer } from './index';
import { MemoryProvider, ExpoFileSystemProvider, MockData, HTTPClient } from '@sgedda/mockifyer-core';
import type { MockifyerConfig } from '@sgedda/mockifyer-core';
import { logger } from '@sgedda/mockifyer-core';

// Re-export MockifyerInstance type to avoid circular dependency
export interface MockifyerInstance extends HTTPClient {
  reloadMockData: (syncFromProject?: boolean) => Promise<void>;
  clearStaleCacheEntries: () => number;
  clearAllMocks: () => Promise<void>;
}

export interface ReactNativeMockifyerConfig {
  /** Whether we're in development mode (determines which provider to use) */
  isDev: boolean;
  /** Path to mock data directory (used in development) */
  mockDataPath?: string;
  /** Path to bundled mock data file (used in production) */
  bundledDataPath?: string;
  /** Enable recording mode (development only) */
  recordMode?: boolean;
  /** Additional Mockifyer config options */
  config?: Partial<Parameters<typeof setupMockifyer>[0]>;
}

// Lazy load bundled data (only used in production builds)
let bundledMockData: MockData[] | null = null;

/**
 * Load bundled mock data from a TypeScript/JavaScript module
 * 
 * Note: For React Native/Metro, we need to handle dynamic imports differently
 * Metro doesn't support dynamic require() with variables, so we use a workaround
 */
async function loadBundledMockData(bundledDataPath: string): Promise<MockData[]> {
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
  } catch (error) {
    logger.warn('[Mockifyer] Could not load bundled mock data:', error);
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
export async function setupMockifyerForReactNative(
  options: ReactNativeMockifyerConfig
): Promise<MockifyerInstance | null> {
  const {
    isDev,
    mockDataPath = 'mock-data',
    bundledDataPath = './assets/mock-data',
    recordMode = false,
    config = {},
  } = options;

  // Check if Mockifyer is enabled
  const isEnabled = process.env.MOCKIFYER_ENABLED === 'true' || isDev;
  if (!isEnabled) {
    logger.info('[Mockifyer] Disabled');
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
      type: 'hybrid' as const,
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

    const instance = setupMockifyer({
      mockDataPath,
      databaseProvider: databaseProviderConfig,
      recordMode,
      useGlobalFetch: true,
      ...config,
    });

    logger.info('[Mockifyer] Development mode: Using Hybrid provider (device + project folder)');
    logger.info(`[Mockifyer] Metro endpoint: http://localhost:${metroPort}/mockifyer-save`);
    logger.info(
      `[Mockifyer] Project→device sync: /mockifyer-sync-to-device-manifest + per-file fetch (on reloadMockData); Metro port ${metroPort}`
    );
    if (recordMode) {
      logger.info('[Mockifyer] Recording mode enabled - new API responses will be saved');
    }

    // Pull repo mock-data onto device once Metro + provider are ready (HybridProvider.reload)
    try {
      await instance.reloadMockData(true);
    } catch (error) {
      logger.warn('[Mockifyer] Initial project→device sync failed (Metro running with built mockifyer-fetch?):', error);
    }

    return instance;
  } else {
    // PRODUCTION BUILD MODE
    // Use Memory provider with bundled TypeScript file
    const provider = new MemoryProvider({});
    provider.initialize();

    // Load bundled mock data
    const mockDataArray = await loadBundledMockData(bundledDataPath);

    if (mockDataArray.length === 0) {
      logger.warn('[Mockifyer] No bundled mock data found. Make sure to run the build script first.');
      return null;
    }

    // Pre-load all mocks into memory
    for (const mockData of mockDataArray) {
      provider.save(mockData);
    }

    const instance = setupMockifyer({
      mockDataPath: './mock-data', // Not used with memory provider
      databaseProvider: {
        type: 'memory',
      },
      recordMode: false, // Can't record in production builds
      useGlobalFetch: true,
      ...config,
    });

    logger.info(`[Mockifyer] Production mode: Loaded ${mockDataArray.length} mocks from bundle`);
    return instance;
  }
}

