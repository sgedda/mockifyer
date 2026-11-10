import { ENV_VARS } from '../types';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const FALSY = new Set(['0', 'false', 'no', 'off']);

/**
 * Reads {@link ENV_VARS.MOCK_PROXY_RECORD_ON_MISS} when set.
 * Used to set `MockifyerConfig.proxy.recordOnMiss` without code changes.
 *
 * @param env — Defaults to `process.env` in Node; pass `undefined` in browsers.
 */
export function parseProxyRecordOnMissEnv(
  env: NodeJS.ProcessEnv | undefined = typeof process !== 'undefined' ? process.env : undefined
): boolean | undefined {
  if (!env) {
    return undefined;
  }
  const raw = env[ENV_VARS.MOCK_PROXY_RECORD_ON_MISS];
  if (typeof raw !== 'string') {
    return undefined;
  }
  const s = raw.trim().toLowerCase();
  if (!s) {
    return undefined;
  }
  if (TRUTHY.has(s)) {
    return true;
  }
  if (FALSY.has(s)) {
    return false;
  }
  return undefined;
}
