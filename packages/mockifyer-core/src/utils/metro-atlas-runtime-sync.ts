/**
 * When Metro Atlas capture is active (press `t` / stream connect), enable the
 * registered Mockifyer runtime toggle so hops are recorded even with
 * `runtimeMode: 'manual'` (starts disabled).
 *
 * If Mockifyer was off when capture started, it is turned off again when capture
 * stops. If it was already on, stop leaves it on.
 */
import { logger } from './logger';
import {
  joinMetroAtlasSessionUrl,
  resolveMetroNetworkStreamBaseUrl,
} from './metro-network-stream';
import { resolveUnpatchedFetch } from './unpatched-global-fetch';
import type { MockifyerClientIdRuntime } from './runtime-client-id';
import { tryGetDefaultRuntimeEnabledStorage } from './runtime-enabled-persist';

/** How often the app polls Metro for Atlas capture → runtime enable. */
export const METRO_ATLAS_RUNTIME_SYNC_INTERVAL_MS = 1_000;
const FETCH_TIMEOUT_MS = 800;

/** Storage key to track if Atlas auto-enabled Mockifyer (survives Metro reload). */
const ATLAS_AUTO_ENABLED_STORAGE_KEY = '@mockifyer/atlas-auto-enabled';

export type MetroAtlasSessionPhase = 'idle' | 'capturing' | 'rendering';

export interface MetroAtlasSessionStatus {
  phase: MetroAtlasSessionPhase;
  /** True while capturing — app should enable Mockifyer for tracing. */
  activateMockifyer: boolean;
  capturing: boolean;
}

export type MetroAtlasRuntimeSyncToggle = Pick<
  MockifyerClientIdRuntime,
  'enableMockifyer' | 'disableMockifyer' | 'isMockifyerEnabled'
>;

let syncTimer: ReturnType<typeof setInterval> | null = null;
/**
 * True after we have handled the current capture period (enable or leave-as-is).
 * Resets when capture is no longer active.
 */
let captureSessionHandled = false;
/**
 * True when this capture session called enableMockifyer because Mockifyer was off.
 * When set, stop capture calls disableMockifyer again.
 * Persisted to survive Metro reloads during capture.
 */
let autoEnabledForAtlasCapture = false;

let registeredToggle: MetroAtlasRuntimeSyncToggle | null = null;

/**
 * Persist Atlas auto-enable flag so it survives Metro reloads.
 */
async function persistAtlasAutoEnabled(enabled: boolean): Promise<void> {
  const storage = tryGetDefaultRuntimeEnabledStorage();
  if (!storage) return;
  try {
    await Promise.resolve(
      storage.setItem(ATLAS_AUTO_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false')
    );
  } catch (error) {
    logger.warn('[Mockifyer] Failed to persist Atlas auto-enabled flag:', error);
  }
}

/**
 * Load persisted Atlas auto-enable flag to restore state after Metro reload.
 */
async function loadAtlasAutoEnabled(): Promise<boolean> {
  const storage = tryGetDefaultRuntimeEnabledStorage();
  if (!storage) return false;
  try {
    const raw = await Promise.resolve(storage.getItem(ATLAS_AUTO_ENABLED_STORAGE_KEY));
    return raw === 'true';
  } catch (error) {
    logger.warn('[Mockifyer] Failed to load Atlas auto-enabled flag:', error);
    return false;
  }
}

/** Called from {@link registerMockifyerInstance} when enable APIs are present. */
export function setRegisteredMockifyerRuntimeToggle(
  instance: MetroAtlasRuntimeSyncToggle | null
): void {
  registeredToggle = instance;
}

export function getRegisteredMockifyerRuntimeToggle(): MetroAtlasRuntimeSyncToggle | null {
  return registeredToggle;
}

export function clearMetroAtlasRuntimeSyncState(): void {
  captureSessionHandled = false;
  autoEnabledForAtlasCapture = false;
  void persistAtlasAutoEnabled(false);
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

function maybeDisableAfterAtlasCapture(toggle: MetroAtlasRuntimeSyncToggle): boolean {
  if (!autoEnabledForAtlasCapture) {
    captureSessionHandled = false;
    return false;
  }
  const disable = toggle.disableMockifyer;
  autoEnabledForAtlasCapture = false;
  captureSessionHandled = false;
  void persistAtlasAutoEnabled(false);
  if (typeof disable !== 'function') {
    return false;
  }
  disable();
  logger.info(
    '[Mockifyer] Atlas capture stopped — Mockifyer disabled again (was off before press t)',
  );
  return true;
}

/**
 * Fetch Atlas session from Metro and sync the runtime toggle:
 * - capturing + was off → enableMockifyer
 * - stop + we auto-enabled → disableMockifyer
 * - was already on → leave enabled when capture stops
 *
 * @returns true when enable or disable was called this tick
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
    return maybeDisableAfterAtlasCapture(toggle);
  }

  if (captureSessionHandled) {
    return false;
  }

  const isEnabled = toggle.isMockifyerEnabled;
  if (typeof isEnabled === 'function' && isEnabled()) {
    // Mockifyer is enabled — check if Atlas auto-enabled it before a reload.
    const wasAutoEnabled = await loadAtlasAutoEnabled();
    if (wasAutoEnabled) {
      // Restore: Atlas enabled it, so we should disable when capture stops.
      autoEnabledForAtlasCapture = true;
      captureSessionHandled = true;
      return false;
    }
    // Already on before / during this press — do not disable when capture stops.
    captureSessionHandled = true;
    autoEnabledForAtlasCapture = false;
    return false;
  }

  enable();
  captureSessionHandled = true;
  autoEnabledForAtlasCapture = true;
  void persistAtlasAutoEnabled(true);
  logger.info(
    '[Mockifyer] Atlas capture active — Mockifyer enabled (Metro press t; will disable again when you stop)',
  );
  return true;
}

/**
 * Start background polling of Metro Atlas session → enable/disable Mockifyer with capture.
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
