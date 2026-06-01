import type { MockifyerConfig } from '../types';
import { canUseDashboardCentralProxy } from './dashboard-central-proxy-health';
import { parseProxyRecordOnMissEnv } from './proxy-record-on-miss-env';
import { resolveRecordResponses } from './request-only-mock';
import { resolveStrictScenarioResolution } from './strict-proxy-scenario';
import { logger } from './logger';

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
  useGlobalFetch?: boolean;
  useGlobalAxios?: boolean;
  databaseProvider?: MockifyerConfig['databaseProvider'];
  config?: Partial<MockifyerConfig>;
  skipDashboardRedisHealthCheck?: boolean;
  mirrorRecordedMocksToClient?: boolean;
}

export interface InitMockifyerForLocalFilesystemOptions {
  mockDataPath?: string;
  useGlobalFetch?: boolean;
  useGlobalAxios?: boolean;
  recordMode?: boolean;
  config?: Partial<MockifyerConfig>;
}

export type SetupMockifyerFn<T> = (config: MockifyerConfig) => T;

/**
 * Preset: dashboard Redis/SQLite proxy when health check passes; otherwise filesystem mocks without proxy.
 */
export async function initMockifyerForDashboardProxy<T>(
  options: InitMockifyerForDashboardProxyOptions,
  setupMockifyer: SetupMockifyerFn<T>
): Promise<T> {
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

  const globalOpts = {
    ...(options.useGlobalFetch !== undefined || extra.useGlobalFetch !== undefined
      ? { useGlobalFetch: options.useGlobalFetch ?? extra.useGlobalFetch ?? true }
      : {}),
    ...(options.useGlobalAxios !== undefined || extra.useGlobalAxios !== undefined
      ? { useGlobalAxios: options.useGlobalAxios ?? extra.useGlobalAxios ?? true }
      : {}),
  };

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
    return setupMockifyer({
      ...stripped,
      mockDataPath,
      ...(fallbackDb !== undefined ? { databaseProvider: fallbackDb } : {}),
      ...(strictProxyOnly ? { intendedProxyBaseUrl: dashboardBaseUrl.trim() } : {}),
      ...globalOpts,
      clientId: options.clientId ?? extra.clientId,
      deviceId: options.deviceId ?? extra.deviceId,
      initLog: mergedInitLogFs,
    });
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

  return setupMockifyer({
    ...extra,
    mockDataPath,
    strictScenarioResolution,
    databaseProvider: options.databaseProvider ?? extra.databaseProvider ?? { type: 'memory' },
    ...globalOpts,
    clientId: options.clientId ?? extra.clientId,
    deviceId: options.deviceId ?? extra.deviceId,
    proxy: mergedProxy,
    initLog: mergedInitLogProxy,
  });
}

/**
 * Preset: local filesystem mocks. No dashboard proxy.
 */
export function initMockifyerForLocalFilesystem<T>(
  options: InitMockifyerForLocalFilesystemOptions,
  setupMockifyer: SetupMockifyerFn<T>
): T {
  const extra = options.config ?? {};
  const mockDataPath =
    options.mockDataPath ??
    extra.mockDataPath ??
    (typeof process !== 'undefined' && process.env?.MOCKIFYER_PATH
      ? process.env.MOCKIFYER_PATH
      : './mock-data');

  const globalOpts = {
    ...(options.useGlobalFetch !== undefined || extra.useGlobalFetch !== undefined
      ? { useGlobalFetch: options.useGlobalFetch ?? extra.useGlobalFetch ?? true }
      : {}),
    ...(options.useGlobalAxios !== undefined || extra.useGlobalAxios !== undefined
      ? { useGlobalAxios: options.useGlobalAxios ?? extra.useGlobalAxios ?? true }
      : {}),
  };

  return setupMockifyer({
    ...extra,
    mockDataPath,
    ...globalOpts,
    recordMode: options.recordMode ?? extra.recordMode ?? false,
  });
}
