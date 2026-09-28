/**
 * When Metro Atlas capture is active (press `t` / stream connect), enable the
 * registered Mockifyer runtime toggle so hops are recorded even with
 * `runtimeMode: 'manual'` (starts disabled).
 *
 * If Mockifyer was off when capture started, it is turned off again when capture
 * stops. If it was already on, stop leaves it on.
 *
 * These switches are transient: they never overwrite the user's saved launch preference. When the
 * user switches Mockifyer themselves during a capture, Atlas stops managing it until capture ends —
 * including across app restarts, so an explicit "off" is not undone on the next launch. A capture
 * that is already running when the app starts also leaves a saved off alone, unless Atlas already
 * owns it (`'true'` persisted). That owner is what survives a Metro reload: `sawCaptureIdle` resets
 * with the process, and the saved preference is still off because the enable was transient.
 */
import { logger } from './logger';
import {
  isMetroAtlasCaptureSessionActive,
  joinMetroAtlasSessionUrl,
  resolveMetroNetworkStreamBaseUrl,
  setMetroAtlasCaptureSessionActive,
} from './metro-network-stream';
import { resolveUnpatchedFetch } from './unpatched-global-fetch';
import type { MockifyerClientIdRuntime } from './runtime-client-id';
import {
  loadPersistedRuntimeEnabled,
  tryGetDefaultRuntimeEnabledStorage,
} from './runtime-enabled-persist';

/** How often the app polls Metro for Atlas capture → runtime enable. */
export const METRO_ATLAS_RUNTIME_SYNC_INTERVAL_MS = 1_000;
const FETCH_TIMEOUT_MS = 800;

/** Storage key to track who owns the toggle for the current capture (survives Metro reload). */
const ATLAS_AUTO_ENABLED_STORAGE_KEY = '@mockifyer/atlas-auto-enabled';

/**
 * Persisted per capture: `'true'` — Atlas turned Mockifyer on and turns it off at stop;
 * `'user'` — the user switched it during capture, so Atlas leaves it alone; `'false'` — neither.
 */
type AtlasCaptureOwner = 'true' | 'user' | 'false';

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

/**
 * True when the user switched Mockifyer during the current capture. In memory as well as persisted,
 * so it holds when storage is unavailable.
 */
let userOwnsCaptureToggle = false;
/**
 * The persisted owner may still name a capture that has since ended (the app was not running when it
 * stopped), so the first idle poll clears it.
 */
let persistedOwnerMayBeStale = true;
/**
 * True after this process has seen Metro idle. A capture that is already running at launch
 * must not undo a saved "off" — only a capture that starts while the app is up does.
 */
let sawCaptureIdle = false;

let registeredToggle: MetroAtlasRuntimeSyncToggle | null = null;

/**
 * Persist who owns the toggle for this capture so it survives Metro reloads and app restarts.
 */
async function persistAtlasCaptureOwner(owner: AtlasCaptureOwner): Promise<void> {
  persistedOwnerMayBeStale = owner !== 'false';
  const storage = tryGetDefaultRuntimeEnabledStorage();
  if (!storage) return;
  try {
    await Promise.resolve(storage.setItem(ATLAS_AUTO_ENABLED_STORAGE_KEY, owner));
  } catch (error) {
    logger.warn('[Mockifyer] Failed to persist Atlas auto-enabled flag:', error);
  }
}

/**
 * Load the persisted toggle owner to restore state after a Metro reload or app restart.
 */
async function loadAtlasCaptureOwner(): Promise<AtlasCaptureOwner> {
  const storage = tryGetDefaultRuntimeEnabledStorage();
  if (!storage) return 'false';
  try {
    const raw = await Promise.resolve(storage.getItem(ATLAS_AUTO_ENABLED_STORAGE_KEY));
    return raw === 'true' || raw === 'user' ? raw : 'false';
  } catch (error) {
    logger.warn('[Mockifyer] Failed to load Atlas auto-enabled flag:', error);
    return 'false';
  }
}

/**
 * Called when the user (not Atlas) switches Mockifyer on or off. During a capture that hands the
 * toggle back to the user: Atlas neither re-enables it on the next launch nor disables it at stop.
 */
export function noteMockifyerToggledByUser(): void {
  autoEnabledForAtlasCapture = false;
  if (!isMetroAtlasCaptureSessionActive()) return;
  userOwnsCaptureToggle = true;
  captureSessionHandled = true;
  void persistAtlasCaptureOwner('user');
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
  userOwnsCaptureToggle = false;
  sawCaptureIdle = false;
  void persistAtlasCaptureOwner('false');
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
 * Parse Metro `GET /mockifyer-atlas-capture` JSON (`activateMockifyer` / `active`).
 */
export function parseMetroAtlasSessionStatus(body: unknown): MetroAtlasSessionStatus | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  const phaseRaw = typeof raw.phase === 'string' ? raw.phase.trim() : '';
  const phase: MetroAtlasSessionPhase =
    phaseRaw === 'capturing' || phaseRaw === 'rendering' || phaseRaw === 'idle'
      ? phaseRaw
      : 'idle';
  const capturing =
    phase === 'capturing' || raw.capturing === true || raw.active === true;
  const activateMockifyer = raw.activateMockifyer === true || capturing;
  return {
    phase,
    activateMockifyer,
    capturing,
  };
}

function maybeDisableAfterAtlasCapture(toggle: MetroAtlasRuntimeSyncToggle): boolean {
  userOwnsCaptureToggle = false;
  if (!autoEnabledForAtlasCapture) {
    captureSessionHandled = false;
    if (persistedOwnerMayBeStale) {
      void persistAtlasCaptureOwner('false');
    }
    return false;
  }
  const disable = toggle.disableMockifyer;
  autoEnabledForAtlasCapture = false;
  captureSessionHandled = false;
  void persistAtlasCaptureOwner('false');
  if (typeof disable !== 'function') {
    return false;
  }
  disable({ transient: true });
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

  if (status) {
    setMetroAtlasCaptureSessionActive(status.capturing);
  }

  if (!status?.activateMockifyer) {
    sawCaptureIdle = true;
    return maybeDisableAfterAtlasCapture(toggle);
  }

  if (captureSessionHandled) {
    return false;
  }

  const owner = userOwnsCaptureToggle ? 'user' : await loadAtlasCaptureOwner();
  if (owner === 'user') {
    // The user switched Mockifyer during this capture (possibly before a restart) — leave it be.
    userOwnsCaptureToggle = true;
    captureSessionHandled = true;
    autoEnabledForAtlasCapture = false;
    return false;
  }

  if (!sawCaptureIdle && owner !== 'true') {
    // Capture was already active when this process started, and Atlas does not own it.
    // A saved off must stay off. Owner `'true'` is a Metro reload of a capture Atlas
    // already enabled transiently — the preference is still off, but recording resumes.
    const storage = tryGetDefaultRuntimeEnabledStorage();
    const saved = storage ? await loadPersistedRuntimeEnabled(storage) : undefined;
    if (saved === false) {
      captureSessionHandled = true;
      autoEnabledForAtlasCapture = false;
      logger.info(
        '[Mockifyer] Atlas capture already active at launch — keeping Mockifyer disabled (saved preference)'
      );
      return false;
    }
  }

  const isEnabled = toggle.isMockifyerEnabled;
  if (typeof isEnabled === 'function' && isEnabled()) {
    // Mockifyer is enabled — check if Atlas auto-enabled it before a reload.
    if (owner === 'true') {
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

  enable({ transient: true });
  captureSessionHandled = true;
  autoEnabledForAtlasCapture = true;
  void persistAtlasCaptureOwner('true');
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
