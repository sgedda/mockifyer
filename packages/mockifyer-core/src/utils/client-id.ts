import type { MockifyerConfig } from '../types';
import { ENV_VARS } from '../types';

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Resolve the logical client lane id.
 *
 * Precedence:
 * 1) `MOCKIFYER_CLIENT_ID` env var
 * 2) `config.clientId`
 * 3) deterministic fallback based on env-provided build metadata:
 *    - `MOCKIFYER_CLIENT_LANE` if set (already precomputed)
 *    - else `MOCKIFYER_APPLICATION_ID` + `MOCKIFYER_MARKET` + `MOCKIFYER_VERSION_NAME` + `MOCKIFYER_VERSION_CODE`
 *
 * This intentionally does NOT generate per-device UUIDs or write dotfiles.
 */
export function resolveClientId(config: MockifyerConfig): string {
  const env = typeof process !== 'undefined' ? process.env : (undefined as any);

  const explicit = firstNonEmpty(env?.[ENV_VARS.MOCK_CLIENT_ID], config.clientId);
  if (explicit) {
    return explicit;
  }

  const precomputedLane = firstNonEmpty(env?.MOCKIFYER_CLIENT_LANE);
  if (precomputedLane) {
    return precomputedLane;
  }

  const applicationId = firstNonEmpty(env?.MOCKIFYER_APPLICATION_ID, env?.APP_ID, env?.APPLICATION_ID) ?? 'app';
  const market = firstNonEmpty(env?.MOCKIFYER_MARKET, env?.MARKET) ?? 'default';
  const versionName = firstNonEmpty(env?.MOCKIFYER_VERSION_NAME, env?.VERSION_NAME, env?.APP_VERSION) ?? '0.0.0';
  const versionCode = firstNonEmpty(env?.MOCKIFYER_VERSION_CODE, env?.VERSION_CODE, env?.BUILD_NUMBER) ?? '0';

  const out = [
    sanitizeSegment(applicationId),
    sanitizeSegment(market),
    sanitizeSegment(versionName),
    sanitizeSegment(versionCode),
  ]
    .filter(Boolean)
    .join('-');

  return out || 'default';
}

