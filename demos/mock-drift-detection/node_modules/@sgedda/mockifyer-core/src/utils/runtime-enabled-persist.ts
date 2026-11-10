import { logger } from './logger';

/** Default AsyncStorage / localStorage key for persisted runtime toggle. */
export const MOCKIFYER_RUNTIME_ENABLED_STORAGE_KEY = '@mockifyer/runtime-enabled';

/**
 * Minimal key-value storage for persisting {@link enableMockifyer} / {@link disableMockifyer}.
 * Compatible with AsyncStorage and `localStorage`.
 */
export interface MockifyerRuntimeEnabledStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

/**
 * Try AsyncStorage (RN), then `localStorage` (web). Returns undefined when neither is available.
 */
export function tryGetDefaultRuntimeEnabledStorage(): MockifyerRuntimeEnabledStorage | undefined {
  try {
    // Optional peer — React Native apps typically have this installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(/* webpackIgnore: true */ '@react-native-async-storage/async-storage') as {
      default?: MockifyerRuntimeEnabledStorage;
    } & MockifyerRuntimeEnabledStorage;
    const storage = mod?.default ?? mod;
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
      return storage;
    }
  } catch {
    // not installed
  }

  try {
    if (typeof globalThis !== 'undefined') {
      const ls = (globalThis as { localStorage?: MockifyerRuntimeEnabledStorage }).localStorage;
      if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') {
        return ls;
      }
    }
  } catch {
    // SSR / restricted environments
  }

  return undefined;
}

/**
 * Resolve storage from config: custom object, or default when `true`.
 */
export function resolveRuntimeEnabledStorage(
  persist: boolean | MockifyerRuntimeEnabledStorage | undefined
): MockifyerRuntimeEnabledStorage | undefined {
  if (persist === true) {
    return tryGetDefaultRuntimeEnabledStorage();
  }
  if (persist && typeof persist === 'object') {
    return persist;
  }
  return undefined;
}

/**
 * Read saved preference. Returns `undefined` when unset / unreadable.
 */
export async function loadPersistedRuntimeEnabled(
  storage: MockifyerRuntimeEnabledStorage,
  key: string = MOCKIFYER_RUNTIME_ENABLED_STORAGE_KEY
): Promise<boolean | undefined> {
  try {
    const raw = await Promise.resolve(storage.getItem(key));
    if (raw == null || String(raw).trim() === '') {
      return undefined;
    }
    const t = String(raw).trim().toLowerCase();
    if (t === 'true' || t === '1' || t === 'on' || t === 'yes') {
      return true;
    }
    if (t === 'false' || t === '0' || t === 'off' || t === 'no') {
      return false;
    }
    return undefined;
  } catch (error) {
    logger.warn('[Mockifyer] Failed to load persisted runtime enabled state:', error);
    return undefined;
  }
}

/**
 * Persist preference so the next app launch restores enable/disable.
 */
export async function savePersistedRuntimeEnabled(
  storage: MockifyerRuntimeEnabledStorage,
  enabled: boolean,
  key: string = MOCKIFYER_RUNTIME_ENABLED_STORAGE_KEY
): Promise<void> {
  try {
    await Promise.resolve(storage.setItem(key, enabled ? 'true' : 'false'));
  } catch (error) {
    logger.warn('[Mockifyer] Failed to save persisted runtime enabled state:', error);
  }
}

/**
 * Initial enabled flag after optional persistence + manual/startDisabled defaults.
 *
 * Precedence:
 * 1. Launch-arg scenario present → **enabled** (E2E wants mocks on)
 * 2. Explicit `initialRuntimeEnabled` (incl. persisted preference loaded by caller)
 * 3. Otherwise `!(startDisabled || runtimeMode === 'manual')`
 */
export function resolveInitialRuntimeEnabled(input: {
  initialRuntimeEnabled?: boolean;
  startDisabled?: boolean;
  runtimeMode?: string;
  /** When true, a native launch `scenario` argument was provided. */
  launchScenarioPresent?: boolean;
}): boolean {
  if (input.launchScenarioPresent === true) {
    return true;
  }
  if (typeof input.initialRuntimeEnabled === 'boolean') {
    return input.initialRuntimeEnabled;
  }
  return !(input.startDisabled === true || input.runtimeMode === 'manual');
}
