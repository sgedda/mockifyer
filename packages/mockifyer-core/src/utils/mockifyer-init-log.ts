import type { MockifyerConfig, MockifyerRuntimeMode } from '../types';
import { newRecordingUsesAlwaysUseRealApi } from './recording-default-always-live';
import { resolveActivationMode } from './activation-mode';
import { logger } from './logger';
import { resolveRecordingExclusions } from './recording-exclusion';
import { resolveProxyStrictLaneScenario } from './proxy-strict-lane-scenario';
import {
  resolveRecordNewMocksAsPassthrough,
  resolveRefreshPassthroughRecordings,
} from './record-passthrough-config';
import {
  isExplicitProxyScenarioContext,
  resolveStrictScenarioResolution,
} from './strict-proxy-scenario';

export interface MockifyerInitLogOptions {
  /** Short context label, e.g. "React Native dev" */
  headline?: string;
  runtimeMode?: MockifyerRuntimeMode;
}

function describeRuntimeMode(mode: MockifyerRuntimeMode | undefined): { label: string; meaning: string } {
  switch (mode) {
    case 'off':
      return {
        label: 'off',
        meaning: 'Mockifyer does not patch fetch (launch args ignored).',
      };
    case 'launch_client':
      return {
        label: 'launch_client',
        meaning:
          'Mockifyer runs only when a launch argument client id is present (Maestro/E2E). Use runtimeMode "on" for everyday dev.',
      };
    case 'on':
    default:
      return {
        label: mode ?? 'on',
        meaning: 'Mockifyer patches fetch when setup runs.',
      };
  }
}

function describeProvider(config: MockifyerConfig): string {
  const providerType = config.databaseProvider?.type;
  const proxyUrl = config.proxy?.baseUrl?.trim();

  if (proxyUrl && providerType === 'memory') {
    return `Dashboard Redis proxy (${proxyUrl}) — requests go to /api/proxy; local device mocks are not used for lookup.`;
  }
  if (providerType === 'hybrid') {
    return 'Hybrid — mocks on device and in the Metro project mock-data folder.';
  }
  if (providerType === 'expo-filesystem') {
    return 'Expo FileSystem — mocks read from the app sandbox (Metro can sync scenario).';
  }
  if (providerType === 'redis') {
    return 'Redis — shared mock store.';
  }
  if (providerType === 'memory') {
    return 'Memory — preloaded/bundled mocks only.';
  }
  if (providerType === 'filesystem') {
    return 'Filesystem — mocks under mockDataPath on disk.';
  }
  return providerType ? `Provider: ${providerType}` : 'Filesystem (default) — mocks under mockDataPath.';
}

function describeStrictScenario(config: MockifyerConfig): { enabled: boolean; meaning: string } {
  const enabled = resolveStrictScenarioResolution(config);
  const hasProxy = Boolean(config.proxy?.baseUrl?.trim());
  if (!hasProxy) {
    return {
      enabled,
      meaning: enabled
        ? 'strictScenarioResolution is on but has no effect without proxy.baseUrl.'
        : 'All outbound requests can use Mockifyer (subject to activationMode).',
    };
  }
  if (!enabled) {
    return {
      enabled,
      meaning:
        'Proxy may run even without clientId; dashboard resolves scenario (lane → global → default).',
    };
  }
  const ready = isExplicitProxyScenarioContext(config);
  return {
    enabled,
    meaning: ready
      ? 'Proxy mocking is allowed because clientId or proxy.scenario is set.'
      : 'No clientId/proxy.scenario — requests bypass Mockifyer (plain HTTP) until you set a lane.',
  };
}

function describeStrictLane(config: MockifyerConfig): { enabled: boolean; meaning: string } {
  const enabled = resolveProxyStrictLaneScenario(config);
  const hasProxy = Boolean(config.proxy?.baseUrl?.trim());
  if (!hasProxy) {
    return {
      enabled,
      meaning: 'Not using dashboard proxy — scenario comes from local files / env.',
    };
  }
  if (enabled) {
    return {
      enabled,
      meaning:
        'Dashboard uses client_scenario:{clientId} only. Cleared/missing lane → real API (no global active_scenario fallback). Activate mocks via PUT /api/client-lanes/{clientId}/scenario.',
    };
  }
  return {
    enabled,
    meaning:
      'Dashboard may fall back to global active_scenario, then filesystem default, when the lane mapping is missing.',
  };
}

/**
 * Logs a single startup block explaining runtime mode, store, lane, and strict flags.
 */
export function logMockifyerInitSummary(
  config: MockifyerConfig & { clientId?: string },
  options?: MockifyerInitLogOptions
): void {
  const headline = options?.headline ?? 'Mockifyer active';
  const runtime = describeRuntimeMode(options?.runtimeMode ?? config.runtimeMode);
  const strictScenario = describeStrictScenario(config);
  const strictLane = describeStrictLane(config);
  const activation = resolveActivationMode(config);
  const lane = typeof config.clientId === 'string' && config.clientId.trim() ? config.clientId.trim() : '—';
  const proxyScenario =
    typeof config.proxy?.scenario === 'string' && config.proxy.scenario.trim()
      ? config.proxy.scenario.trim()
      : null;

  logger.info(`[Mockifyer] ── ${headline} ──`);
  logger.info(`[Mockifyer] Runtime mode: ${runtime.label} — ${runtime.meaning}`);
  logger.info(`[Mockifyer] Mock store: ${describeProvider(config)}`);
  logger.info(`[Mockifyer] clientId (lane): ${lane}`);
  if (proxyScenario) {
    logger.info(
      `[Mockifyer] proxy.scenario: "${proxyScenario}" — fixed scenario on every proxy request (overrides dashboard lane).`
    );
  }
  logger.info(
    `[Mockifyer] strictScenarioResolution: ${strictScenario.enabled} — ${strictScenario.meaning}`
  );
  logger.info(`[Mockifyer] strictLaneScenario (proxy): ${strictLane.enabled} — ${strictLane.meaning}`);
  logger.info(`[Mockifyer] activationMode: ${activation} — controls when interceptors apply per request.`);
  const recordingExclusions = resolveRecordingExclusions(config);
  if (recordingExclusions.length > 0) {
    logger.info(
      `[Mockifyer] recordingExclusions: ${recordingExclusions.length} rule(s) — matching hosts (and optional path prefixes) skip persisting recordings.`
    );
  }
  if (config.recordMode) {
    logger.info('[Mockifyer] recordMode: true — cache misses can be recorded (proxy or provider permitting).');
    if (newRecordingUsesAlwaysUseRealApi()) {
      logger.info(
        '[Mockifyer] New local recordings default to alwaysUseRealApi (live API until you uncheck in the dashboard). Set MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false to replay mocks immediately after capture.'
      );
    }
    if (resolveRecordNewMocksAsPassthrough(config)) {
      logger.info(
        '[Mockifyer] recordNewMocksAsPassthrough: true — new recordings use alwaysUseRealApi until activated in the dashboard.'
      );
    }
    if (resolveRefreshPassthroughRecordings(config)) {
      logger.info(
        '[Mockifyer] refreshPassthroughRecordings: true — passthrough recordings are updated on each live API response.'
      );
    }
  }
  const proxyBase = config.proxy?.baseUrl?.trim();
  if (proxyBase) {
    const rom = config.proxy?.recordOnMiss;
    if (typeof rom === 'boolean') {
      logger.info(
        `[Mockifyer] proxy.recordOnMiss: ${rom} — sends "record" on each /api/proxy request (dashboard cannot override per request).`
      );
    } else {
      logger.info(
        '[Mockifyer] proxy.recordOnMiss: (unset) — omits "record" on /api/proxy; dashboard uses per-scenario recordOnMiss (see Settings). Env MOCKIFYER_PROXY_RECORD_ON_MISS can set the client flag when unset.'
      );
    }
  }
}

/**
 * Logs why React Native setup returned not_activated.
 */
export function logMockifyerNotActivated(
  runtimeMode: MockifyerRuntimeMode,
  extra?: { launchClientIdKey?: string; hadLaunchClientId?: boolean }
): void {
  const runtime = describeRuntimeMode(runtimeMode);
  logger.info(`[Mockifyer] ── Not activated ──`);
  logger.info(`[Mockifyer] Runtime mode: ${runtime.label} — ${runtime.meaning}`);
  if (runtimeMode === 'launch_client') {
    const key = extra?.launchClientIdKey ?? 'mockifyerClientId';
    logger.info(
      `[Mockifyer] No launch client id (key "${key}")${extra?.hadLaunchClientId === false ? ' was found' : ''}. Pass it from Maestro launchApp or use runtimeMode: "on".`
    );
  }
  logger.info('[Mockifyer] fetch is not patched; all HTTP goes to the real network.');
}
