import type { MockifyerConfig } from '../types';
import { ENV_VARS } from '../types';

/**
 * Env/config flags for passthrough recordings.
 * Leaf module so mock-replay-mode can read the refresh flag without importing
 * record-passthrough-config (that file imports mock-passthrough, which imports
 * mock-replay-mode).
 */

function parseBoolEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

/**
 * When true, newly recorded mocks are saved with {@link MockData.alwaysUseRealApi} so they appear
 * in the dashboard but are not replayed until activated (flag cleared in the UI).
 *
 * Precedence: **`MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH`** env → **`recordNewMocksAsPassthrough`** config.
 */
export function resolveRecordNewMocksAsPassthrough(
  config: Pick<MockifyerConfig, 'recordNewMocksAsPassthrough'>
): boolean {
  const fromEnv = parseBoolEnv(
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_RECORD_NEW_AS_PASSTHROUGH] : undefined
  );
  if (fromEnv !== undefined) return fromEnv;
  return config.recordNewMocksAsPassthrough === true;
}

/**
 * When true, existing passthrough recordings are overwritten on each real API response (same request key).
 *
 * Precedence: **`MOCKIFYER_REFRESH_PASSTHROUGH_RECORDINGS`** env → **`refreshPassthroughRecordings`** config.
 */
export function resolveRefreshPassthroughRecordings(
  config: Pick<MockifyerConfig, 'refreshPassthroughRecordings'>
): boolean {
  const fromEnv = parseBoolEnv(
    typeof process !== 'undefined'
      ? process.env[ENV_VARS.MOCK_REFRESH_PASSTHROUGH_RECORDINGS]
      : undefined
  );
  if (fromEnv !== undefined) return fromEnv;
  return config.refreshPassthroughRecordings === true;
}
