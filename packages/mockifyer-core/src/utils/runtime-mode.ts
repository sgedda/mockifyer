import { ENV_VARS, type MockifyerRuntimeMode } from '../types';
import { logger } from './logger';

function normalizeRuntimeMode(raw: unknown): MockifyerRuntimeMode | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const t = String(raw).trim().toLowerCase();
  if (!t) {
    return undefined;
  }
  if (t === 'off' || t === 'disabled' || t === 'none') {
    return 'off';
  }
  if (t === 'on' || t === 'enabled' || t === 'always') {
    return 'on';
  }
  if (t === 'launch_client' || t === 'launch-client' || t === 'e2e' || t === 'maestro') {
    return 'launch_client';
  }
  if (t === 'manual' || t === 'gui' || t === 'toggle') {
    return 'manual';
  }
  return undefined;
}

/**
 * Resolves whether `setupMockifyerForReactNative` should patch `fetch`.
 *
 * Precedence: **`configMode`** (from app config / RN options) → **`MOCKIFYER_MODE`** env → default **`on`**
 * (patch `fetch` whenever `setupMockifyerForReactNative` runs). Use **`launch_client`** explicitly for Maestro-only activation,
 * or **`manual`** to patch but start disabled (enable via GUI toggle).
 */
export function resolveMockifyerRuntimeMode(input?: {
  configMode?: MockifyerRuntimeMode | string | undefined;
}): MockifyerRuntimeMode {
  const fromConfig = normalizeRuntimeMode(input?.configMode);
  if (fromConfig) {
    return fromConfig;
  }

  const env = typeof process !== 'undefined' ? process.env : undefined;
  const rawMode = env?.[ENV_VARS.MOCK_RUNTIME_MODE];
  const fromEnv = normalizeRuntimeMode(rawMode);
  if (rawMode != null && String(rawMode).trim() !== '' && !fromEnv) {
    logger.warn(
      `[Mockifyer] Unknown ${ENV_VARS.MOCK_RUNTIME_MODE}="${rawMode}"; expected off | on | launch_client | manual (aliases: disabled, enabled, e2e, maestro, gui, toggle, …). Using default on.`
    );
  }
  if (fromEnv) {
    return fromEnv;
  }

  return 'on';
}
