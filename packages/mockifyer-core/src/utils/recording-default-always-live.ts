import { ENV_VARS } from '../types';

const FALSY = new Set(['0', 'false', 'no', 'off']);

/**
 * When true, newly persisted recordings (dashboard Redis proxy, fetch/axios disk saves)
 * include **`alwaysUseRealApi: true`**: the response body is stored, but subsequent calls
 * hit the live API until the user turns off passthrough in the dashboard.
 *
 * Set **`MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API=false`** for legacy behavior
 * (serve the recorded mock immediately on the next matching request).
 *
 * @param env — Defaults to `process.env` in Node; pass `undefined` when `process` is unavailable.
 */
export function newRecordingUsesAlwaysUseRealApi(
  env: NodeJS.ProcessEnv | undefined = typeof process !== 'undefined' ? process.env : undefined
): boolean {
  if (!env) {
    return true;
  }
  const raw = env[ENV_VARS.MOCK_RECORD_DEFAULT_ALWAYS_USE_REAL_API];
  if (typeof raw !== 'string' || !raw.trim()) {
    return true;
  }
  return !FALSY.has(raw.trim().toLowerCase());
}
