import type { MockifyerConfig } from '../types';
import { MOCKIFYER_CLIENT_ID_HEADER } from './activation-mode';
import { joinProxyDashboardApiUrl } from './join-proxy-dashboard-api-url';

const MOCKIFYER_ORIGINAL_FETCH_KEY = '__mockifyer_original_fetch';
const RUNTIME_DATE_SYNC_INTERVAL_MS = 2500;
const RUNTIME_DATE_SYNC_TIMEOUT_MS = 800;

export interface RuntimeDateSyncOptions {
  dashboardBaseUrl: string;
  scenario?: string;
  clientId?: string;
}

/**
 * Dashboard/Redis date payload cached for synchronous {@link import('./date').getCurrentDate}.
 * `undefined` = not synced; `null` = explicit "no manipulation"; object = scenario/lane payload.
 */
let runtimeDateManipulation: Record<string, unknown> | null | undefined;
let syncOptions: RuntimeDateSyncOptions | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;

function resolveUnpatchedFetch(): typeof fetch {
  try {
    const g = globalThis as typeof globalThis & { [MOCKIFYER_ORIGINAL_FETCH_KEY]?: typeof fetch };
    if (typeof g[MOCKIFYER_ORIGINAL_FETCH_KEY] === 'function') {
      return g[MOCKIFYER_ORIGINAL_FETCH_KEY]!;
    }
  } catch {
    // ignore
  }
  return fetch;
}

/**
 * Process-level date payload from the dashboard (Redis scenario / lane).
 * Used by `getCurrentDate()` when no per-call `explicitManipulation` is passed.
 */
export function getRuntimeDateManipulation(): Record<string, unknown> | null | undefined {
  return runtimeDateManipulation;
}

/**
 * Store a dashboard/Redis date payload for subsequent `getCurrentDate()` calls.
 */
export function setRuntimeDateManipulation(
  payload: Record<string, unknown> | null | undefined
): void {
  runtimeDateManipulation = payload;
}

function clearRuntimeDateSyncTimer(): void {
  if (syncTimer !== null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

/**
 * Stop background dashboard date polling and clear the cached payload.
 */
export function stopRuntimeDateSync(): void {
  clearRuntimeDateSyncTimer();
  syncOptions = null;
  runtimeDateManipulation = undefined;
}

function startRuntimeDateSyncTimer(): void {
  if (syncTimer !== null) {
    return;
  }
  syncTimer = setInterval(() => {
    if (!syncOptions) {
      return;
    }
    void syncRuntimeDateManipulationFromDashboard(syncOptions);
  }, RUNTIME_DATE_SYNC_INTERVAL_MS);
  if (typeof syncTimer === 'object' && syncTimer !== null && 'unref' in syncTimer) {
    (syncTimer as NodeJS.Timeout).unref();
  }
}

/**
 * Apply `dateManipulation` from a dashboard `/api/proxy` JSON envelope.
 * Also keeps the poller pointed at the resolved scenario and lane.
 */
export function applyRuntimeDateManipulationFromProxyPayload(
  payload: Record<string, unknown> | null | undefined
): void {
  if (!payload || typeof payload !== 'object') {
    return;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'dateManipulation')) {
    const dm = payload.dateManipulation;
    if (dm === null) {
      setRuntimeDateManipulation(null);
    } else if (typeof dm === 'object') {
      setRuntimeDateManipulation(dm as Record<string, unknown>);
    }
  }
  if (!syncOptions) {
    return;
  }
  const clientId = payload.clientId;
  if (typeof clientId === 'string' && clientId.trim()) {
    syncOptions = { ...syncOptions, clientId: clientId.trim() };
  }
  const resolution = payload.scenarioResolution as { scenario?: string | null } | undefined;
  const scenario = resolution?.scenario;
  if (typeof scenario === 'string' && scenario.trim()) {
    syncOptions = { ...syncOptions, scenario: scenario.trim() };
  }
}

/**
 * Load Date Config from the dashboard (`GET /api/date-config`) into the runtime cache.
 * Failures are ignored so `getCurrentDate()` keeps the last known payload (or real time).
 */
export async function syncRuntimeDateManipulationFromDashboard(
  options: RuntimeDateSyncOptions
): Promise<boolean> {
  const dashboardBaseUrl = options.dashboardBaseUrl.trim();
  if (!dashboardBaseUrl) {
    return false;
  }
  const fetchFn = resolveUnpatchedFetch();
  if (typeof fetchFn !== 'function') {
    return false;
  }
  const url = new URL(joinProxyDashboardApiUrl(dashboardBaseUrl, 'api/date-config'));
  const scenario = options.scenario?.trim();
  if (scenario) {
    url.searchParams.set('scenario', scenario);
  }
  const clientId = options.clientId?.trim();
  if (clientId) {
    url.searchParams.set('clientId', clientId);
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeout = setTimeout(() => controller?.abort(), RUNTIME_DATE_SYNC_TIMEOUT_MS);
  try {
    const res = await fetchFn(url.toString(), {
      method: 'GET',
      headers: {
        ...(clientId ? { [MOCKIFYER_CLIENT_ID_HEADER]: clientId } : {}),
      },
      signal: controller?.signal,
    });
    if (!res.ok) {
      return false;
    }
    const body = (await res.json()) as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(body, 'dateManipulation')) {
      return false;
    }
    const dm = body.dateManipulation;
    if (dm === null) {
      setRuntimeDateManipulation(null);
      return true;
    }
    if (typeof dm === 'object') {
      setRuntimeDateManipulation(dm as Record<string, unknown>);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * When `proxy.baseUrl` is set, start polling Date Config so `getCurrentDate()` follows
 * the Redis scenario (and lane date) without a Redis client in the app process.
 * Returns the sync options, or `null` when proxy is not configured.
 */
export function scheduleRuntimeDateSyncFromConfig(
  config: MockifyerConfig
): RuntimeDateSyncOptions | null {
  const baseUrl = config.proxy?.baseUrl?.trim();
  if (!baseUrl) {
    stopRuntimeDateSync();
    return null;
  }
  const clientId =
    typeof config.clientId === 'string' && config.clientId.trim()
      ? config.clientId.trim()
      : undefined;
  const scenario =
    typeof config.proxy?.scenario === 'string' && config.proxy.scenario.trim()
      ? config.proxy.scenario.trim()
      : undefined;
  syncOptions = { dashboardBaseUrl: baseUrl, scenario, clientId };
  const runningUnderJest =
    typeof process !== 'undefined' && process.env.JEST_WORKER_ID != null;
  if (!runningUnderJest) {
    void syncRuntimeDateManipulationFromDashboard(syncOptions);
    startRuntimeDateSyncTimer();
  }
  return syncOptions;
}
