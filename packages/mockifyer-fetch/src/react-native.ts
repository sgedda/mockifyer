/**
 * React Native/Expo Helper Functions
 * 
 * Simplified setup for React Native applications with automatic
 * conditional provider selection (FileSystem in dev, Memory in prod)
 */

import { canUseDashboardRedisProxy } from './utils/dashboard-redis-health';
import { setupMockifyer } from './index';
import { MockData, HTTPClient } from '@sgedda/mockifyer-core';
import {
  logger,
  MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY,
  tryGetClientIdFromLaunchArguments,
  resolveMockifyerRuntimeMode,
  logMockifyerNotActivated,
  resolveRecordResponses,
  resolveStrictScenarioResolution,
  type MockifyerRuntimeMode,
} from '@sgedda/mockifyer-core';

// Re-export MockifyerInstance type to avoid circular dependency
export interface MockifyerInstance extends HTTPClient {
  reloadMockData: (syncFromProject?: boolean) => Promise<void>;
  clearStaleCacheEntries: () => number;
  clearAllMocks: () => Promise<void>;
  setClientId: (lane: string) => void;
  getClientId: () => string | undefined;
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
   * When false, dashboard proxy stores request-only stubs on cache miss (Responses: Off).
   * Defaults to `false`. Env **`MOCKIFYER_RECORD_RESPONSES`** overrides when set.
   */
  proxyRecordResponses?: boolean;
  /**
   * When true, skip `GET /api/health` and always wire dashboard proxy (same as Node preset).
   */
  skipDashboardRedisHealthCheck?: boolean;
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
    proxyRecordResponses,
    skipDashboardRedisHealthCheck,
    useLaunchArgumentsClientId = false,
    launchArgumentClientIdKey = MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY,
    runtimeMode: runtimeModeOption,
  } = options;

  const proxyShouldRecordOnMiss = proxyRecordOnMiss ?? recordMode;
  const proxyShouldRecordResponses = resolveRecordResponses(
    proxyRecordResponses ?? userConfig.proxy?.recordResponses
  );

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

  const devInitHeadline = (strictProxy: boolean, strictProxyOnlyFallback: boolean) => {
    if (strictProxy) return 'React Native dev · dashboard Redis proxy';
    if (strictProxyOnlyFallback) {
      return 'React Native dev · strict proxy-only (dashboard unhealthy — local recording disabled)';
    }
    return 'React Native dev · hybrid (device + Metro)';
  };

  const isEnabled =
    resolvedRuntimeMode === 'on' ||
    (resolvedRuntimeMode === 'launch_client' && Boolean(clientIdFromLaunchArgs));
  if (!isEnabled) {
    logMockifyerNotActivated(resolvedRuntimeMode, {
      launchClientIdKey,
      hadLaunchClientId: Boolean(clientIdFromLaunchArgs),
    });
    return { status: 'not_activated', instance: null } as const;
  }

  if (isDev === true) {
    const strictProxyEnabled = proxyBaseUrl
      ? skipDashboardRedisHealthCheck === true ||
        (await canUseDashboardRedisProxy(proxyBaseUrl))
      : false;

    const strictProxyOnlyFallback =
      Boolean(proxyBaseUrl?.trim()) &&
      !strictProxyEnabled &&
      resolveStrictScenarioResolution(mergedConfig);

    if (strictProxyOnlyFallback) {
      logger.warn(
        `[Mockifyer] Strict proxy-only: "${proxyBaseUrl}" did not report healthy Redis. ` +
          'Using memory provider without local recording. Start mockifyer-dashboard --provider redis ' +
          'or set skipDashboardRedisHealthCheck: true to force proxy.'
      );
    }

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
      ...mergedConfig,
      mockDataPath,
      databaseProvider:
        strictProxyEnabled || strictProxyOnlyFallback
          ? {
              // Strict proxy source of truth: disable local mock lookup so all requests go through the dashboard proxy.
              type: 'memory',
            }
          : databaseProviderConfig,
      recordMode,
      useGlobalFetch: true,
      ...(strictProxyEnabled && proxyBaseUrl
        ? {
            proxy: {
              baseUrl: proxyBaseUrl,
              scenario: proxyScenario,
              recordOnMiss: proxyShouldRecordOnMiss,
              recordResponses: proxyShouldRecordResponses,
            },
          }
        : {}),
      ...(strictProxyEnabled
        ? {
            strictScenarioResolution: mergedConfig.strictScenarioResolution ?? true,
          }
        : {}),
      ...(strictProxyOnlyFallback
        ? {
            proxy: undefined,
            databaseProvider: { type: 'memory' as const },
            intendedProxyBaseUrl: proxyBaseUrl!.trim(),
          }
        : {}),
      initLog: {
        headline:
          mergedConfig.initLog?.headline ??
          devInitHeadline(strictProxyEnabled, strictProxyOnlyFallback),
      },
    });

    if (!strictProxyEnabled && !strictProxyOnlyFallback) {
      logger.info(`[Mockifyer] Metro: http://localhost:${metroPort}/mockifyer-save · scenario: /mockifyer-scenario-config`);
    }

    if (!strictProxyEnabled && !strictProxyOnlyFallback) {
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
    // Load bundled mock data
    const mockDataArray = await loadBundledMockData(bundledDataPath);

    if (mockDataArray.length === 0) {
      logger.warn(
        '[Mockifyer] Activation requested but no bundled mock data found (status: failed_no_bundled_mocks). Run the bundle/generate step for your mocks.'
      );
      return { status: 'failed_no_bundled_mocks', instance: null } as const;
    }

    const instance = setupMockifyer({
      ...mergedConfig,
      mockDataPath: './mock-data', // Not used with memory provider
      databaseProvider: {
        type: 'memory',
        options: {
          ...mergedConfig.databaseProvider?.options,
          initialMocks: mockDataArray,
        },
      },
      recordMode: false, // Can't record in production builds
      useGlobalFetch: true,
      ...(proxyBaseUrl
        ? {
            proxy: {
            baseUrl: proxyBaseUrl,
            scenario: proxyScenario,
            recordOnMiss: proxyShouldRecordOnMiss,
            recordResponses: proxyShouldRecordResponses,
            },
          }
        : {}),
      ...(proxyBaseUrl
        ? {
            strictScenarioResolution: mergedConfig.strictScenarioResolution ?? true,
          }
        : {}),
      initLog: {
        headline:
          mergedConfig.initLog?.headline ??
          `React Native production · ${mockDataArray.length} bundled mock(s)`,
      },
    });

    return { status: 'active', instance } as const;
  }
}

/** React Native options with an explicit dashboard alias (see {@link initMockifyerForReactNativeDashboard}). */
export interface InitMockifyerForReactNativeDashboardOptions extends ReactNativeMockifyerConfig {
  /**
   * mockifyer-dashboard origin — same role as {@link ReactNativeMockifyerConfig.proxyBaseUrl}.
   * Useful when you prefer naming that matches the Node preset {@link initMockifyerForDashboardProxy}.
   */
  dashboardBaseUrl?: string;
}

/**
 * Preset: point the app at **mockifyer-dashboard** for `/api/proxy` (typically **`--provider redis`**).
 *
 * Resolves URL in order: **`proxyBaseUrl`** → **`dashboardBaseUrl`** → **`MOCKIFYER_PROXY_URL`** env.
 * Then delegates to {@link setupMockifyerForReactNative}. For bespoke wiring, call that helper directly.
 */
export async function initMockifyerForReactNativeDashboard(
  options: InitMockifyerForReactNativeDashboardOptions
): Promise<SetupMockifyerForReactNativeResult> {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.MOCKIFYER_PROXY_URL
      ? process.env.MOCKIFYER_PROXY_URL.trim()
      : '';

  const resolved =
    String(options.proxyBaseUrl ?? '').trim() ||
    String(options.dashboardBaseUrl ?? '').trim() ||
    fromEnv;

  if (!resolved) {
    throw new Error(
      'initMockifyerForReactNativeDashboard: set proxyBaseUrl, dashboardBaseUrl, or MOCKIFYER_PROXY_URL'
    );
  }

  return setupMockifyerForReactNative({
    ...options,
    proxyBaseUrl: resolved,
  });
}

export {
  tryGetClientIdFromLaunchArguments,
  MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY,
  getClientId,
  setClientId,
  registerMockifyerInstance,
  clearMockifyerClientIdRuntime,
} from '@sgedda/mockifyer-core';

