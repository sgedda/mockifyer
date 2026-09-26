/**
 * When Metro Atlas capture is active (press `t` / stream connect), enable the
 * registered Mockifyer runtime toggle so hops are recorded even with
 * `runtimeMode: 'manual'` (starts disabled).
 */
import { logger } from './logger';
import {
  joinMetroAtlasSessionUrl,
  resolveMetroNetworkStreamBaseUrl,
} from './metro-network-stream';
import { resolveUnpatchedFetch } from './unpatched-global-fetch';
import type { MockifyerClientIdRuntime } from './runtime-client-id';

/** How often the app polls Metro for Atlas capture → runtime enable. */
export const METRO_ATLAS_RUNTIME_SYNC_INTERVAL_MS = 1_000;
const FETCH_TIMEOUT_MS = 800;

export type MetroAtlasSessionPhase = 'idle' | 'capturing' | 'rendering';

export interface MetroAtlasSessionStatus {
  phase: MetroAtlasSessionPhase;
  /** True while capturing — app should enable Mockifyer for tracing. */
  activateMockifyer: boolean;
  capturing: boolean;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;
/** Avoid re-logging / re-calling enable on every poll while capture stays active. */
let lastActivatedForCapture = false;

let registeredToggle: Pick<
  MockifyerClientIdRuntime,
  'enableMockifyer' | 'isMockifyerEnabled'
> | null = null;

/** Called from {@link registerMockifyerInstance} when enable APIs are present. */
export function setRegisteredMockifyerRuntimeToggle(
  instance: Pick<MockifyerClientIdRuntime, 'enableMockifyer' | 'isMockifyerEnabled'> | null
): void {
  registeredToggle = instance;
}

export function getRegisteredMockifyerRuntimeToggle(): Pick<
  MockifyerClientIdRuntime,
  'enableMockifyer' | 'isMockifyerEnabled'
> | null {
  return registeredToggle;
}

export function clearMetroAtlasRuntimeSyncState(): void {
  lastActivatedForCapture = false;
}

function clearSyncTimer(): void {
  if (syncTimer !== null) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

/**
 * Stop polling Metro for Atlas → runtime enable.
 */
export function stopMetroAtlasRuntimeSync(): void {
  clearSyncTimer();
  clearMetroAtlasRuntimeSyncState();
  registeredToggle = null;
}

/**
 * Parse Metro `/mockifyer-atlas-session` JSON.
 */
export function parseMetroAtlasSessionStatus(body: unknown): MetroAtlasSessionStatus | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  const phaseRaw = typeof raw.phase === 'string' ? raw.phase.trim() : '';
  const phase: MetroAtlasSessionPhase =
    phaseRaw === 'capturing' || phaseRaw === 'rendering' || phaseRaw === 'idle'
      ? phaseRaw
      : 'idle';
  const activateMockifyer =
    raw.activateMockifyer === true ||
    raw.capturing === true ||
    phase === 'capturing';
  return {
    phase,
    activateMockifyer,
    capturing: phase === 'capturing' || raw.capturing === true,
  };
}

/**
 * Fetch Atlas session from Metro and enable Mockifyer when capture is active.
 * @returns true when enableMockifyer() was called this tick
 */
export async function syncMockifyerFromMetroAtlasSession(options?: {
  metroBaseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const base =
    options?.metroBaseUrl?.trim() || resolveMetroNetworkStreamBaseUrl();
  if (!base) return false;

  const toggle = registeredToggle;
  const enable = toggle?.enableMockifyer;
  if (!toggle || typeof enable !== 'function') return false;

  const fetchFn = options?.fetchImpl ?? resolveUnpatchedFetch();
  if (!fetchFn) return false;

  const url = joinMetroAtlasSessionUrl(base);
  let status: MetroAtlasSessionStatus | null = null;
  try {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer =
      controller &&
      setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, FETCH_TIMEOUT_MS);
    try {
      const res = await fetchFn(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (!res || !('ok' in res) || !res.ok) {
        return false;
      }
      const json = (await res.json()) as unknown;
      status = parseMetroAtlasSessionStatus(json);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    return false;
  }

  if (!status?.activateMockifyer) {
    lastActivatedForCapture = false;
    return false;
  }

  const isEnabled = toggle.isMockifyerEnabled;
  if (typeof isEnabled === 'function' && isEnabled()) {
    lastActivatedForCapture = true;
    return false;
  }

  if (lastActivatedForCapture) {
    return false;
  }

  enable();
  lastActivatedForCapture = true;
  logger.info(
    '[Mockifyer] Atlas capture active — Mockifyer enabled (Metro press t started tracing)',
  );
  return true;
}

/**
 * Start background polling of Metro Atlas session → enableMockifyer when capturing.
 * No-op when Metro stream base URL is unset. Safe to call repeatedly.
 */
export function startMetroAtlasRuntimeSync(options?: {
  intervalMs?: number;
  metroBaseUrl?: string;
}): void {
  const base =
    options?.metroBaseUrl?.trim() || resolveMetroNetworkStreamBaseUrl();
  if (!base) return;

  if (syncTimer !== null) {
    return;
  }

  const intervalMs = options?.intervalMs ?? METRO_ATLAS_RUNTIME_SYNC_INTERVAL_MS;
  // Immediate tick so pressing `t` activates without waiting a full interval.
  void syncMockifyerFromMetroAtlasSession({ metroBaseUrl: base });
  syncTimer = setInterval(() => {
    void syncMockifyerFromMetroAtlasSession({ metroBaseUrl: base });
  }, intervalMs);
  if (typeof syncTimer === 'object' && syncTimer !== null && 'unref' in syncTimer) {
    (syncTimer as NodeJS.Timeout).unref();
  }
}
