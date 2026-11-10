import { OVERRIDE_GROUP_ID_PATTERN } from '../types/override-group';
import { ENV_VARS } from '../types';

/** Optional request/header override: `X-Mockifyer-Override-Group`. */
export const MOCKIFYER_OVERRIDE_GROUP_HEADER = 'x-mockifyer-override-group';

/** Sanitize lane id for use in `override-group-config.{clientId}.json`. */
export function sanitizeOverrideGroupClientId(clientId: string): string | null {
  const trimmed = clientId.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (!sanitized || sanitized.includes('..')) return null;
  return sanitized;
}

export function normalizeOverrideGroupId(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const id = String(raw).trim();
  if (!id) return null;
  if (!OVERRIDE_GROUP_ID_PATTERN.test(id)) return null;
  return id;
}

export interface ResolveActiveOverrideGroupIdParams {
  /** Highest priority when set (header / proxy body / API explicit). */
  explicitGroupId?: string | null;
  /** Env `MOCKIFYER_OVERRIDE_GROUP` when not passed explicitly. */
  envGroupId?: string | null;
  /** Per-lane selection (Redis `client_override_group` or FS `override-group-config.{clientId}.json`). */
  laneGroupId?: string | null;
  /** Scenario default (`override-group-config.json`). */
  defaultGroupId?: string | null;
  /** Known group ids; invalid ids are ignored. */
  knownGroupIds?: Iterable<string>;
}

/**
 * Resolve which override group applies for a request/process.
 *
 * Precedence (highest first):
 * 1. explicit (header / body)
 * 2. env `MOCKIFYER_OVERRIDE_GROUP`
 * 3. per-client lane selection
 * 4. scenario default
 * 5. none
 */
export function resolveActiveOverrideGroupId(
  params: ResolveActiveOverrideGroupIdParams
): string | null {
  const known = params.knownGroupIds
    ? new Set([...params.knownGroupIds].map((id) => id.trim()).filter(Boolean))
    : null;

  const pick = (raw: string | null | undefined): string | null => {
    const id = normalizeOverrideGroupId(raw);
    if (!id) return null;
    if (known && !known.has(id)) return null;
    return id;
  };

  return (
    pick(params.explicitGroupId) ??
    pick(params.envGroupId) ??
    pick(params.laneGroupId) ??
    pick(params.defaultGroupId) ??
    null
  );
}

/** Read `MOCKIFYER_OVERRIDE_GROUP` from process env when available. */
export function readOverrideGroupIdFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined = typeof process !==
  'undefined'
    ? process.env
    : undefined
): string | null {
  if (!env) return null;
  return normalizeOverrideGroupId(env[ENV_VARS.MOCK_OVERRIDE_GROUP]);
}
