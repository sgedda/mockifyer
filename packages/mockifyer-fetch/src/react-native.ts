/**
 * React Native/Expo Helper Functions
 * 
 * Simplified setup for React Native applications with automatic
 * conditional provider selection (FileSystem in dev, Memory in prod)
 */

import { joinProxyDashboardApiUrl } from './utils/join-proxy-dashboard-api-url';
import { setupMockifyer } from './index';
import { MemoryProvider, ExpoFileSystemProvider, MockData, HTTPClient } from '@sgedda/mockifyer-core';
import {
  logger,
  MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY,
  tryGetClientIdFromLaunchArguments,
  resolveMockifyerRuntimeMode,
  type MockifyerRuntimeMode,
} from '@sgedda/mockifyer-core';

// Re-export MockifyerInstance type to avoid circular dependency
export interface MockifyerInstance extends HTTPClient {
  reloadMockData: (syncFromProject?: boolean) => Promise<void>;
  clearStaleCacheEntries: () => number;
  clearAllMocks: () => Promise<void>;
}

/**
 * Outcome of {@link setupMockifyerForReactNative}.
 *
 * - **`not_activated`** — `fetch` was not patched this run (see **`MOCKIFYER_MODE`** / `runtimeMode`: `off`, or `launch_client` without a launch-arg lane).
 *   Not the same as “permanently off” unless mode is **`off`** (then launch args do not activate).
 * - **`active`** — Mockifyer initialized and patched `global.fetch`.
 * - **`failed_no_bundled_mocks`** — Activation criteria were met and `isDev` was false, but bundled mock data was missing or empty.
 */
export type MockifyerReactNativeInitStatus =
  | 'not_activated'
  | 'active'
  | 'failed_no_bundled_mocks';

export type SetupMockifyerForReactNativeResult =
  | { readonly status: 'not_activated'; readonly instance: null }
  | { readonly status: 'failed_no_bundled_mocks'; readonly instance: null }
  | { readonly status: 'active'; readonly instance: MockifyerInstance };

/**
 * Type guard: `true` when {@link setupMockifyerForReactNative} patched `fetch` and returned an instance.
 */
export function isMockifyerReactNativeActive(
  result: SetupMockifyerForReactNativeResult
): result is { readonly status: 'active'; readonly instance: MockifyerInstance } {
  return result.status === 'active';
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
  /** Optional: route real network calls through a proxy service (e.g. mockifyer-dashboard in Redis mode) */
  proxyBaseUrl?: string;
  /** Optional: force proxy scenario */
  proxyScenario?: string;
  /**
   * Optional: record responses on proxy cache miss (proxy must support recording).
   * Deprecated: prefer using `recordMode` when `proxyBaseUrl` is provided.
   */
  proxyRecordOnMiss?: boolean;
  /**
   * When true, read `clientId` from Maestro/native launch arguments (optional peer `react-native-launch-arguments`).
   * Prefer this over passing scenario from E2E if the dashboard/Redis should control scenario on the fly for that lane.
   * Forwards to {@link MockifyerConfig.useLaunchArgumentsClientId} on the merged config passed to `setupMockifyer`.
   *
   * If the launch argument is **set** (non-empty) for {@link launchArgumentClientIdKey}, the lane id is applied when Mockifyer activates (see **`runtimeMode`** / **`MOCKIFYER_MODE`**; with **`launch_client`**, a set arg is required to activate).
   */
  useLaunchArgumentsClientId?: boolean;
  /** Launch-argument key for the client lane id (default: `mockifyerClientId`). */
  launchArgumentClientIdKey?: string;
  /**
   * When Mockifyer may patch `fetch` at startup. Overrides **`MOCKIFYER_MODE`** env and `config.runtimeMode`.
   * Prefer env **`MOCKIFYER_MODE`**: `off` | `on` | `launch_client` (aliases e.g. `e2e`, `maestro` → `launch_client`).
   */
  runtimeMode?: MockifyerRuntimeMode;
}

type DashboardHealth = {
  status?: string;
  provider?: string;
  redisOk?: boolean | null;
};

// Lazy load bundled data (only used in production builds)
let bundledMockData: MockData[] | null = null;

async function canUseStrictRedisProxy(proxyBaseUrl?: string): Promise<boolean> {
  if (!proxyBaseUrl) return false;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeout = setTimeout(() => controller?.abort(), 800);
    const url = joinProxyDashboardApiUrl(proxyBaseUrl, 'api/health');
    const res = await fetch(url, { signal: controller?.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = (await res.json()) as DashboardHealth;
    return data?.provider === 'redis' && data?.redisOk === true;
  } catch {
    return false;
  }
}

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
 * // MOCKIFYER_MODE=on | launch_client | off — default when unset is on; use launch_client for Maestro-only activation.
 * const result = await setupMockifyerForReactNative({
 *   isDev: __DEV__, // Selects Hybrid vs Memory provider once enabled
 *   mockDataPath: 'mock-data',
 *   bundledDataPath: './assets/mock-data',
 *   recordMode: process.env.MOCKIFYER_RECORD === 'true',
 * });
 * // result.status: 'not_activated' | 'active' | 'failed_no_bundled_mocks'
 * ```
 */
export async function setupMockifyerForReactNative(
  options: ReactNativeMockifyerConfig
): Promise<SetupMockifyerForReactNativeResult> {
  const {
    isDev,
    mockDataPath = 'mock-data',
    bundledDataPath = './assets/mock-data',
    recordMode = false,
    config: userConfig = {},
    proxyBaseUrl,
    proxyScenario,
    proxyRecordOnMiss,
    useLaunchArgumentsClientId = false,
    launchArgumentClientIdKey = MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY,
    runtimeMode: runtimeModeOption,
  } = options;

  const proxyShouldRecordOnMiss = proxyRecordOnMiss ?? recordMode;

  const launchClientIdKey =
    launchArgumentClientIdKey ?? MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY;
  const clientIdFromLaunchArgs = tryGetClientIdFromLaunchArguments(launchClientIdKey);
  const shouldApplyLaunchClientId =
    useLaunchArgumentsClientId || Boolean(clientIdFromLaunchArgs);

  const resolvedRuntimeMode = resolveMockifyerRuntimeMode({
    configMode: runtimeModeOption ?? userConfig.runtimeMode,
  });

  const mergedConfig: typeof userConfig = {
    ...userConfig,
    runtimeMode: resolvedRuntimeMode,
    ...(shouldApplyLaunchClientId
      ? {
          useLaunchArgumentsClientId: true as const,
          launchArgumentClientIdKey: launchClientIdKey,
        }
      : {}),
  };

  const isEnabled =
    resolvedRuntimeMode === 'on' ||
    (resolvedRuntimeMode === 'launch_client' && Boolean(clientIdFromLaunchArgs));
  if (!isEnabled) {
    const hint =
      resolvedRuntimeMode === 'off'
        ? 'MOCKIFYER_MODE=off (or runtimeMode off) — launch args are ignored.'
        : resolvedRuntimeMode === 'launch_client'
          ? 'MOCKIFYER_MODE=launch_client — pass mockifyerClientId via launch args, or set MOCKIFYER_MODE=on for always-on dev.'
          : 'Adjust MOCKIFYER_MODE / runtimeMode.';
    logger.info(`[Mockifyer] Not activated (${hint})`);
    return { status: 'not_activated', instance: null } as const;
  }

  if (clientIdFromLaunchArgs && !useLaunchArgumentsClientId) {
    logger.info(
      `[Mockifyer] Enabled via launch argument "${launchClientIdKey}" (E2E lane "${clientIdFromLaunchArgs}")`
    );
  }

  if (isDev === true) {
    const strictProxyEnabled = await canUseStrictRedisProxy(proxyBaseUrl);

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
    const databaseProviderConfig = mergedConfig.databaseProvider 
      ? {
          ...baseDatabaseProvider,
          ...mergedConfig.databaseProvider,
          options: {
            ...baseDatabaseProvider.options,
            ...(mergedConfig.databaseProvider.options || {}),
            metroPort, // Always ensure metroPort is set
          },
        }
      : baseDatabaseProvider;

    const instance = setupMockifyer({
      mockDataPath,
      databaseProvider: strictProxyEnabled
        ? {
            // Strict proxy source of truth: disable local mock lookup so all requests go through the dashboard proxy.
            type: 'memory',
          }
        : databaseProviderConfig,
      recordMode,
      useGlobalFetch: true,
      proxy: strictProxyEnabled && proxyBaseUrl
        ? { baseUrl: proxyBaseUrl, scenario: proxyScenario, recordOnMiss: proxyShouldRecordOnMiss }
        : undefined,
      ...mergedConfig,
    });

    if (strictProxyEnabled) {
      logger.info('[Mockifyer] Development mode: Strict proxy enabled (dashboard Redis is healthy) — local mocks disabled');
    } else {
      logger.info('[Mockifyer] Development mode: Using Hybrid provider (device + project folder)');
      logger.info(`[Mockifyer] Metro endpoint: http://localhost:${metroPort}/mockifyer-save`);
      logger.info(
        `[Mockifyer] Project→device sync: /mockifyer-sync-to-device-manifest + per-file fetch (on reloadMockData); Metro port ${metroPort}`
      );
    }
    if (recordMode) {
      logger.info('[Mockifyer] Recording mode enabled - new API responses will be saved');
    }

    if (!strictProxyEnabled) {
      // Pull repo mock-data onto device once Metro + provider are ready (HybridProvider.reload)
      try {
        await instance.reloadMockData(true);
      } catch (error) {
        logger.warn('[Mockifyer] Initial project→device sync failed (Metro running with built mockifyer-fetch?):', error);
      }
    }

    return { status: 'active', instance } as const;
  } else {
    // PRODUCTION BUILD MODE
    // Use Memory provider with bundled TypeScript file
    const provider = new MemoryProvider({});
    provider.initialize();

    // Load bundled mock data
    const mockDataArray = await loadBundledMockData(bundledDataPath);

    if (mockDataArray.length === 0) {
      logger.warn(
        '[Mockifyer] Activation requested but no bundled mock data found (status: failed_no_bundled_mocks). Run the bundle/generate step for your mocks.'
      );
      return { status: 'failed_no_bundled_mocks', instance: null } as const;
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
      proxy: proxyBaseUrl
        ? { baseUrl: proxyBaseUrl, scenario: proxyScenario, recordOnMiss: proxyShouldRecordOnMiss }
        : undefined,
      ...mergedConfig,
    });

    logger.info(`[Mockifyer] Production mode: Loaded ${mockDataArray.length} mocks from bundle`);
    return { status: 'active', instance } as const;
  }
}

export { tryGetClientIdFromLaunchArguments, MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY } from '@sgedda/mockifyer-core';

