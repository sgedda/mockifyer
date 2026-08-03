import type { MockifyerConfig } from '../types';
import { canUseDashboardCentralProxy } from './dashboard-central-proxy-health';
import { parseProxyRecordOnMissEnv } from './proxy-record-on-miss-env';
import { resolveRecordResponses } from './request-only-mock';
import { resolveStrictScenarioResolution } from './strict-proxy-scenario';
import { logger } from './logger';
import { registerMockifyerInstance, type MockifyerClientIdRuntime } from './runtime-client-id';

export { loadAxiosSetupMockifyer, loadFetchSetupMockifyer } from './load-sibling-setup';

/** Drops `proxy` when merging partial config so filesystem fallback cannot accidentally keep proxy. */
export function omitProxyFromPartialConfig(config: Partial<MockifyerConfig>): Partial<MockifyerConfig> {
  const { proxy: _drop, ...rest } = config;
  void _drop;
  return rest;
}

/** Options for {@link initMockifyerForDashboardProxy} — dashboard + `/api/proxy`. */
export interface InitMockifyerForDashboardProxyOptions {
  /** mockifyer-dashboard origin (e.g. `http://localhost:3002`). Not the Redis URL. */
  dashboardBaseUrl: string;
  mockDataPath?: string;
  clientId?: string;
  deviceId?: string;
  scenario?: string;
  recordOnMiss?: boolean;
  recordResponses?: boolean;
  strictLaneScenario?: boolean;
  upstreamTlsInsecure?: boolean;
  useGlobalFetch?: boolean;
  useGlobalAxios?: boolean;
  /** Axios instance to patch when `useGlobalAxios` is true (passed through to axios setup). */
  axiosInstance?: MockifyerConfig['axiosInstance'];
  databaseProvider?: MockifyerConfig['databaseProvider'];
  config?: Partial<MockifyerConfig>;
  skipDashboardRedisHealthCheck?: boolean;
  mirrorRecordedMocksToClient?: boolean;
}

export interface InitMockifyerForLocalFilesystemOptions {
  mockDataPath?: string;
  useGlobalFetch?: boolean;
  useGlobalAxios?: boolean;
  /** Axios instance to patch when `useGlobalAxios` is true (passed through to axios setup). */
  axiosInstance?: MockifyerConfig['axiosInstance'];
  recordMode?: boolean;
  config?: Partial<MockifyerConfig>;
}

export type SetupMockifyerFn<T> = (config: MockifyerConfig) => T;

export interface DualClientSetups<TFetch = unknown, TAxios = unknown> {
  fetch?: SetupMockifyerFn<TFetch>;
  axios?: SetupMockifyerFn<TAxios>;
}

export interface DualClientInitResult<TFetch = unknown, TAxios = unknown> {
  fetch?: TFetch;
  axios?: TAxios;
}

/** Minimal surface synced across dual fetch+axios instances. */
export interface DualMockifyerControlSurface {
  setClientId: (lane: string) => void;
  getClientId: () => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reloadMockData: (...args: any[]) => any;
  clearStaleCacheEntries: () => number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clearAllMocks?: (...args: any[]) => any;
}

export interface ResolveClientInitFlagsDefaults {
  useGlobalFetch: boolean;
  useGlobalAxios: boolean;
}

/**
 * Resolves which HTTP clients to patch from preset options + package defaults.
 */
export function resolveClientInitFlags(
  options: {
    useGlobalFetch?: boolean;
    useGlobalAxios?: boolean;
    config?: Partial<MockifyerConfig>;
  },
  defaults: ResolveClientInitFlagsDefaults
): { useFetch: boolean; useAxios: boolean } {
  const extra = options.config ?? {};
  const useFetch =
    options.useGlobalFetch ?? extra.useGlobalFetch ?? defaults.useGlobalFetch;
  const useAxios =
    options.useGlobalAxios ?? extra.useGlobalAxios ?? defaults.useGlobalAxios;
  return { useFetch: Boolean(useFetch), useAxios: Boolean(useAxios) };
}

/**
 * Whether the host package must run dual-client init (sibling stack requested).
 * When false, use one-shot {@link initMockifyerForDashboardProxy} /
 * {@link initMockifyerForLocalFilesystem} — including when both flags are false
 * (local client only, no global patch).
 */
export function needsSiblingClientSetup(
  host: 'fetch' | 'axios',
  flags: { useFetch: boolean; useAxios: boolean }
): boolean {
  return host === 'fetch' ? flags.useAxios : flags.useFetch;
}

/**
 * Builds per-client configs so each package only patches its own stack.
 */
export function splitDualClientConfigs(
  shared: MockifyerConfig,
  flags: { useFetch: boolean; useAxios: boolean }
): { fetchConfig?: MockifyerConfig; axiosConfig?: MockifyerConfig } {
  const axiosInstance = shared.axiosInstance;
  return {
    ...(flags.useFetch
      ? {
          fetchConfig: {
            ...shared,
            useGlobalFetch: true,
            useGlobalAxios: false,
          },
        }
      : {}),
    ...(flags.useAxios
      ? {
          axiosConfig: {
            ...shared,
            useGlobalFetch: false,
            useGlobalAxios: true,
            ...(axiosInstance !== undefined ? { axiosInstance } : {}),
          },
        }
      : {}),
  };
}

/**
 * Forwards lane / reload controls from `primary` to `secondary` so dual init stays in sync.
 */
export function syncDualMockifyerControls(
  primary: DualMockifyerControlSurface,
  secondary: DualMockifyerControlSurface
): void {
  const primarySetClientId = primary.setClientId.bind(primary);
  const primaryReload = primary.reloadMockData.bind(primary);
  const primaryClearStale = primary.clearStaleCacheEntries.bind(primary);
  const primaryClearAll = primary.clearAllMocks?.bind(primary);
  const secondaryClearAll = secondary.clearAllMocks?.bind(secondary);

  primary.setClientId = (lane: string) => {
    primarySetClientId(lane);
    secondary.setClientId(lane);
  };

  primary.reloadMockData = (...args: any[]) => {
    const primaryResult = primaryReload(...args);
    const secondaryResult = secondary.reloadMockData(...args);
    const primaryThenable =
      primaryResult != null &&
      typeof (primaryResult as Promise<unknown>).then === 'function';
    const secondaryThenable =
      secondaryResult != null &&
      typeof (secondaryResult as Promise<unknown>).then === 'function';
    // Axios reload is often sync; fetch (hybrid/expo) may still be async — always wait for both.
    if (primaryThenable || secondaryThenable) {
      return Promise.all([
        Promise.resolve(primaryResult),
        Promise.resolve(secondaryResult),
      ]).then(([first]) => first);
    }
    return primaryResult;
  };

  primary.clearStaleCacheEntries = () =>
    primaryClearStale() + secondary.clearStaleCacheEntries();

  if (primaryClearAll) {
    primary.clearAllMocks = (...args: any[]) => {
      const primaryResult = primaryClearAll(...args);
      const secondaryResult = secondaryClearAll?.(...args);
      const primaryThenable =
        primaryResult != null &&
        typeof (primaryResult as Promise<unknown>).then === 'function';
      const secondaryThenable =
        secondaryResult != null &&
        typeof (secondaryResult as Promise<unknown>).then === 'function';
      if (primaryThenable || secondaryThenable) {
        return Promise.all([
          Promise.resolve(primaryResult),
          Promise.resolve(secondaryResult),
        ]).then(([first]) => first);
      }
      return primaryResult;
    };
  }
}

/**
 * Picks the host package instance and syncs lane controls when both clients were initialized.
 * Re-registers the primary on the module-level client-id runtime so {@link setClientId} /
 * {@link getClientId} target the synced primary (dual setup overwrites the registry with
 * whichever `setupMockifyer` ran last).
 */
export function pickPrimaryDualMockifyerInstance<T>(
  host: 'fetch' | 'axios',
  flags: { useFetch: boolean; useAxios: boolean },
  result: DualClientInitResult<T, T>
): T {
  const preferFetch = host === 'fetch';
  const primary = preferFetch
    ? (result.fetch ?? result.axios)
    : (result.axios ?? result.fetch);
  if (!primary) {
    throw new Error('initMockifyer: no client instance was created');
  }

  const secondary =
    flags.useFetch && flags.useAxios
      ? preferFetch
        ? result.axios
        : result.fetch
      : undefined;

  if (secondary && secondary !== primary) {
    syncDualMockifyerControls(
      primary as unknown as DualMockifyerControlSurface,
      secondary as unknown as DualMockifyerControlSurface
    );
  }

  registerMockifyerInstance(primary as unknown as MockifyerClientIdRuntime);

  return primary;
}

function resolveAxiosInstance(
  options: { axiosInstance?: MockifyerConfig['axiosInstance']; config?: Partial<MockifyerConfig> }
): MockifyerConfig['axiosInstance'] | undefined {
  return options.axiosInstance ?? options.config?.axiosInstance;
}

function buildGlobalOptsFromFlags(flags: { useFetch: boolean; useAxios: boolean }): {
  useGlobalFetch?: boolean;
  useGlobalAxios?: boolean;
} {
  return {
    ...(flags.useFetch ? { useGlobalFetch: true } : { useGlobalFetch: false }),
    ...(flags.useAxios ? { useGlobalAxios: true } : { useGlobalAxios: false }),
  };
}

/**
 * Resolves the shared {@link MockifyerConfig} for the dashboard-proxy preset (health check + merge).
 */
export async function buildDashboardProxyConfig(
  options: InitMockifyerForDashboardProxyOptions,
  clientFlags?: { useFetch: boolean; useAxios: boolean }
): Promise<MockifyerConfig> {
  const extra = options.config ?? {};
  const dashboardBaseUrl = String(options.dashboardBaseUrl).trim();
  if (!dashboardBaseUrl) {
    throw new Error('initMockifyerForDashboardProxy: dashboardBaseUrl is required');
  }

  const mockDataPath =
    options.mockDataPath ??
    extra.mockDataPath ??
    (typeof process !== 'undefined' && process.env?.MOCKIFYER_PATH
      ? process.env.MOCKIFYER_PATH
      : './mock-data');

  const envRecord =
    typeof process !== 'undefined' && process.env?.MOCKIFYER_RECORD === 'true';

  const recordOnMiss =
    options.recordOnMiss ??
    extra.proxy?.recordOnMiss ??
    parseProxyRecordOnMissEnv() ??
    (envRecord ? true : undefined);

  const recordResponses = resolveRecordResponses(
    options.recordResponses ?? extra.proxy?.recordResponses
  );

  const useCentralProxy =
    options.skipDashboardRedisHealthCheck === true ||
    (await canUseDashboardCentralProxy(dashboardBaseUrl));

  const flags =
    clientFlags ??
    resolveClientInitFlags(options, { useGlobalFetch: false, useGlobalAxios: false });
  const globalOpts = buildGlobalOptsFromFlags(flags);
  const axiosInstance = resolveAxiosInstance(options);

  if (!useCentralProxy) {
    const strictProxyOnly = resolveStrictScenarioResolution({
      strictScenarioResolution:
        options.config?.strictScenarioResolution ?? extra.strictScenarioResolution,
    });
    logger.warn(
      `[Mockifyer] initMockifyerForDashboardProxy: "${dashboardBaseUrl}" did not report healthy central store ` +
        (strictProxyOnly
          ? '(strict proxy-only — local recording disabled). '
          : '(unreachable or store not ready). Falling back to filesystem mocks without proxy. ') +
        'Set skipDashboardRedisHealthCheck: true to force proxy anyway.'
    );
    const stripped = omitProxyFromPartialConfig(extra);
    const fallbackDb = options.databaseProvider ?? extra.databaseProvider;
    const mergedInitLogFs: MockifyerConfig['initLog'] = {
      ...stripped.initLog,
      headline:
        stripped.initLog?.headline ??
        (strictProxyOnly
          ? '[Mockifyer preset] Node · strict proxy-only (dashboard health check failed)'
          : '[Mockifyer preset] Node · filesystem (dashboard health check failed)'),
    };
    return {
      ...stripped,
      mockDataPath,
      ...(fallbackDb !== undefined ? { databaseProvider: fallbackDb } : {}),
      ...(strictProxyOnly ? { intendedProxyBaseUrl: dashboardBaseUrl.trim() } : {}),
      ...globalOpts,
      ...(axiosInstance !== undefined ? { axiosInstance } : {}),
      clientId: options.clientId ?? extra.clientId,
      deviceId: options.deviceId ?? extra.deviceId,
      initLog: mergedInitLogFs,
    };
  }

  const upstreamProxy = extra.proxy as MockifyerConfig['proxy'] | undefined;
  const mergedProxy = {
    ...upstreamProxy,
    baseUrl: upstreamProxy?.baseUrl ?? dashboardBaseUrl,
    scenario:
      options.scenario ??
      upstreamProxy?.scenario ??
      (typeof process !== 'undefined' && process.env?.MOCKIFYER_SCENARIO?.trim()
        ? process.env.MOCKIFYER_SCENARIO.trim()
        : undefined),
    ...(typeof recordOnMiss === 'boolean' ? { recordOnMiss } : {}),
    recordResponses,
  } as NonNullable<MockifyerConfig['proxy']>;
  if (
    options.strictLaneScenario !== undefined ||
    upstreamProxy?.strictLaneScenario !== undefined
  ) {
    mergedProxy.strictLaneScenario =
      options.strictLaneScenario ?? upstreamProxy?.strictLaneScenario;
  }
  if (
    options.upstreamTlsInsecure !== undefined ||
    upstreamProxy?.upstreamTlsInsecure !== undefined
  ) {
    mergedProxy.upstreamTlsInsecure =
      options.upstreamTlsInsecure ?? upstreamProxy?.upstreamTlsInsecure;
  }

  const envMirrorRaw =
    typeof process !== 'undefined'
      ? String(process.env?.MOCKIFYER_PROXY_MIRROR_TO_CLIENT || '').trim().toLowerCase()
      : '';
  const envMirror =
    envMirrorRaw === '1' || envMirrorRaw === 'true' || envMirrorRaw === 'yes' || envMirrorRaw === 'on';
  const mirrorRecordedMocksToClient =
    options.mirrorRecordedMocksToClient ??
    extra.proxy?.mirrorRecordedMocksToClient ??
    (envMirror ? true : undefined);
  if (mirrorRecordedMocksToClient !== undefined) {
    mergedProxy.mirrorRecordedMocksToClient = mirrorRecordedMocksToClient;
  }

  const mergedInitLogProxy: MockifyerConfig['initLog'] = {
    ...extra.initLog,
    headline: extra.initLog?.headline ?? '[Mockifyer preset] Node · dashboard central proxy',
  };

  const strictScenarioResolution =
    extra.strictScenarioResolution ?? options.config?.strictScenarioResolution ?? true;

  return {
    ...extra,
    mockDataPath,
    strictScenarioResolution,
    databaseProvider: options.databaseProvider ?? extra.databaseProvider ?? { type: 'memory' },
    ...globalOpts,
    ...(axiosInstance !== undefined ? { axiosInstance } : {}),
    clientId: options.clientId ?? extra.clientId,
    deviceId: options.deviceId ?? extra.deviceId,
    proxy: mergedProxy,
    initLog: mergedInitLogProxy,
  };
}

/**
 * Resolves the shared {@link MockifyerConfig} for the local-filesystem preset.
 */
export function buildLocalFilesystemConfig(
  options: InitMockifyerForLocalFilesystemOptions,
  clientFlags?: { useFetch: boolean; useAxios: boolean }
): MockifyerConfig {
  const extra = options.config ?? {};
  const mockDataPath =
    options.mockDataPath ??
    extra.mockDataPath ??
    (typeof process !== 'undefined' && process.env?.MOCKIFYER_PATH
      ? process.env.MOCKIFYER_PATH
      : './mock-data');

  const flags =
    clientFlags ??
    resolveClientInitFlags(options, { useGlobalFetch: false, useGlobalAxios: false });
  const globalOpts = buildGlobalOptsFromFlags(flags);
  const axiosInstance = resolveAxiosInstance(options);

  return {
    ...extra,
    mockDataPath,
    ...globalOpts,
    ...(axiosInstance !== undefined ? { axiosInstance } : {}),
    recordMode: options.recordMode ?? extra.recordMode ?? false,
  };
}

/**
 * Preset: dashboard Redis/SQLite proxy when health check passes; otherwise filesystem mocks without proxy.
 */
export async function initMockifyerForDashboardProxy<T>(
  options: InitMockifyerForDashboardProxyOptions,
  setupMockifyer: SetupMockifyerFn<T>
): Promise<T> {
  const config = await buildDashboardProxyConfig(options);
  return setupMockifyer(config);
}

/**
 * Dual-client dashboard-proxy init: patches fetch and/or axios from one shared config resolve.
 */
export async function initMockifyerForDashboardProxyClients<TFetch, TAxios>(
  options: InitMockifyerForDashboardProxyOptions,
  setups: DualClientSetups<TFetch, TAxios>,
  flags: { useFetch: boolean; useAxios: boolean }
): Promise<DualClientInitResult<TFetch, TAxios>> {
  if (!flags.useFetch && !flags.useAxios) {
    throw new Error(
      'initMockifyerForDashboardProxy: enable at least one of useGlobalFetch or useGlobalAxios'
    );
  }
  if (flags.useFetch && !setups.fetch) {
    throw new Error(
      'initMockifyerForDashboardProxy: useGlobalFetch is true but no fetch setupMockifyer was provided'
    );
  }
  if (flags.useAxios && !setups.axios) {
    throw new Error(
      'initMockifyerForDashboardProxy: useGlobalAxios is true but no axios setupMockifyer was provided'
    );
  }

  const shared = await buildDashboardProxyConfig(options, flags);
  const { fetchConfig, axiosConfig } = splitDualClientConfigs(shared, flags);

  const result: DualClientInitResult<TFetch, TAxios> = {};
  if (fetchConfig && setups.fetch) {
    result.fetch = setups.fetch(fetchConfig);
  }
  if (axiosConfig && setups.axios) {
    result.axios = setups.axios(axiosConfig);
  }
  return result;
}

/**
 * Preset: local filesystem mocks. No dashboard proxy.
 */
export function initMockifyerForLocalFilesystem<T>(
  options: InitMockifyerForLocalFilesystemOptions,
  setupMockifyer: SetupMockifyerFn<T>
): T {
  const config = buildLocalFilesystemConfig(options);
  return setupMockifyer(config);
}

/**
 * Dual-client local-filesystem init: patches fetch and/or axios from one shared config.
 */
export function initMockifyerForLocalFilesystemClients<TFetch, TAxios>(
  options: InitMockifyerForLocalFilesystemOptions,
  setups: DualClientSetups<TFetch, TAxios>,
  flags: { useFetch: boolean; useAxios: boolean }
): DualClientInitResult<TFetch, TAxios> {
  if (!flags.useFetch && !flags.useAxios) {
    throw new Error(
      'initMockifyerForLocalFilesystem: enable at least one of useGlobalFetch or useGlobalAxios'
    );
  }
  if (flags.useFetch && !setups.fetch) {
    throw new Error(
      'initMockifyerForLocalFilesystem: useGlobalFetch is true but no fetch setupMockifyer was provided'
    );
  }
  if (flags.useAxios && !setups.axios) {
    throw new Error(
      'initMockifyerForLocalFilesystem: useGlobalAxios is true but no axios setupMockifyer was provided'
    );
  }

  const shared = buildLocalFilesystemConfig(options, flags);
  const { fetchConfig, axiosConfig } = splitDualClientConfigs(shared, flags);

  const result: DualClientInitResult<TFetch, TAxios> = {};
  if (fetchConfig && setups.fetch) {
    result.fetch = setups.fetch(fetchConfig);
  }
  if (axiosConfig && setups.axios) {
    result.axios = setups.axios(axiosConfig);
  }
  return result;
}
