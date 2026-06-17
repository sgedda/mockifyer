import type { MockifyerConfig } from '../types';
import { ENV_VARS } from '../types';

/**
 * Parses `MOCKIFYER_UPSTREAM_TLS_INSECURE` and similar boolean env values.
 */
export function parseProxyUpstreamTlsInsecureEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

/**
 * Whether dashboard `/api/proxy` should call upstream HTTPS with `rejectUnauthorized: false`.
 *
 * Precedence: **`MOCKIFYER_UPSTREAM_TLS_INSECURE`** env → **`proxy.upstreamTlsInsecure`** → **`false`**.
 */
export function resolveProxyUpstreamTlsInsecure(
  config: Pick<MockifyerConfig, 'proxy'>
): boolean {
  const fromEnv = parseProxyUpstreamTlsInsecureEnv(
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_UPSTREAM_TLS_INSECURE] : undefined
  );
  if (fromEnv !== undefined) return fromEnv;

  const fromConfig = config.proxy?.upstreamTlsInsecure;
  if (fromConfig === true || fromConfig === false) return fromConfig;

  return false;
}

/**
 * Resolves upstream TLS insecure mode for a single `/api/proxy` request on the dashboard.
 * Uses the JSON body when present; otherwise falls back to dashboard process env.
 */
export function resolveProxyUpstreamTlsInsecureForRequest(
  upstreamTlsInsecureFromBody: unknown
): boolean {
  if (typeof upstreamTlsInsecureFromBody === 'boolean') {
    return upstreamTlsInsecureFromBody;
  }
  const fromEnv = parseProxyUpstreamTlsInsecureEnv(
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_UPSTREAM_TLS_INSECURE] : undefined
  );
  return fromEnv === true;
}
