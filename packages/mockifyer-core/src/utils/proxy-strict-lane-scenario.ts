import type { MockifyerConfig } from '../types';
import { ENV_VARS } from '../types';

function parseStrictLaneEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

/**
 * Whether `/api/proxy` should skip global `active_scenario` (and filesystem fallback) when
 * `clientId` is set but `client_scenario:{clientId}` is missing.
 *
 * Precedence: **`MOCKIFYER_STRICT_LANE_SCENARIO`** env → **`proxy.strictLaneScenario`** → default **`true`**
 * when `proxy.baseUrl` is set, else **`false`**.
 */
export function resolveProxyStrictLaneScenario(
  config: Pick<MockifyerConfig, 'proxy'>
): boolean {
  const fromEnv = parseStrictLaneEnv(
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_STRICT_LANE_SCENARIO] : undefined
  );
  if (fromEnv !== undefined) return fromEnv;

  const fromConfig = config.proxy?.strictLaneScenario;
  if (fromConfig === true || fromConfig === false) return fromConfig;

  const baseUrl = config.proxy?.baseUrl;
  if (typeof baseUrl === 'string' && baseUrl.trim() !== '') {
    return true;
  }

  return false;
}
