import { ENV_VARS } from '../types';
import { sha256Hex } from './crypto-digest';

/** Default max distinct mock hashes per METHOD+host+pathname (Redis). `0` / off disables. */
export const DEFAULT_MAX_MOCKS_PER_PATH = 200;

export type RedisMockWriteSkipReason = 'scenario_limit' | 'path_limit';

export interface RedisMockWriteLimitDecision {
  allow: boolean;
  reason?: RedisMockWriteSkipReason;
  maxScenario?: number;
  scenarioCount?: number;
  maxPath?: number;
  pathCount?: number;
}

/**
 * {@link ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO} — when unset, no scenario cap.
 * Same env as filesystem {@link checkRequestLimit}.
 */
export function getMaxRequestsPerScenarioFromEnv(): number | undefined {
  const raw =
    typeof process !== 'undefined' ? process.env?.[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO] : undefined;
  if (raw == null || String(raw).trim() === '') return undefined;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Max distinct mocks per METHOD + host + pathname.
 * Default {@link DEFAULT_MAX_MOCKS_PER_PATH}. Set `0` / `off` / `false` / `no` to disable.
 */
export function getMaxMocksPerPathFromEnv(): number | undefined {
  const raw =
    typeof process !== 'undefined' ? process.env?.[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH] : undefined;
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_MAX_MOCKS_PER_PATH;
  }
  const trimmed = String(raw).trim().toLowerCase();
  if (trimmed === '0' || trimmed === 'off' || trimmed === 'false' || trimmed === 'no') {
    return undefined;
  }
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_MOCKS_PER_PATH;
}

/**
 * Stable Redis set suffix for path cardinality: METHOD + host + pathname (query ignored).
 */
export function buildMockPathCardinalitySegment(
  method: string | undefined,
  url: string | undefined
): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const m = (method || 'GET').toUpperCase();
  try {
    const parsed = new URL(url, 'http://localhost');
    const host = parsed.host.toLowerCase();
    const pathname = parsed.pathname || '/';
    const material = `${m}\n${host}\n${pathname}`;
    return sha256Hex(material).slice(0, 24);
  } catch {
    const material = `${m}\n${url.trim()}`;
    return sha256Hex(material).slice(0, 24);
  }
}

export function redisPathIndexKey(keyPrefix: string, scenario: string, pathSegment: string): string {
  return `${keyPrefix}:path_index:${scenario}:${pathSegment}`;
}

/**
 * Decide whether a **new** hash may be written. Overwrites (`hashAlreadyStored`) always allowed.
 */
export function decideRedisMockWriteLimits(input: {
  hashAlreadyStored: boolean;
  scenarioMockCount: number;
  pathMockCount: number;
  hashAlreadyOnPath: boolean;
  maxScenario?: number;
  maxPath?: number;
}): RedisMockWriteLimitDecision {
  if (input.hashAlreadyStored) {
    return { allow: true };
  }

  const maxScenario = input.maxScenario;
  if (typeof maxScenario === 'number' && input.scenarioMockCount >= maxScenario) {
    return {
      allow: false,
      reason: 'scenario_limit',
      maxScenario,
      scenarioCount: input.scenarioMockCount,
    };
  }

  const maxPath = input.maxPath;
  if (
    typeof maxPath === 'number' &&
    !input.hashAlreadyOnPath &&
    input.pathMockCount >= maxPath
  ) {
    return {
      allow: false,
      reason: 'path_limit',
      maxPath,
      pathCount: input.pathMockCount,
    };
  }

  return {
    allow: true,
    maxScenario,
    scenarioCount: input.scenarioMockCount,
    maxPath,
    pathCount: input.pathMockCount,
  };
}

export function formatRedisMockWriteSkipMessage(
  decision: RedisMockWriteLimitDecision,
  context: { scenario: string; method?: string; url?: string }
): string {
  if (decision.reason === 'scenario_limit') {
    return (
      `Redis mock write skipped: scenario "${context.scenario}" has ` +
      `${decision.scenarioCount ?? '?'} mocks (max ${decision.maxScenario}). ` +
      `Raise or unset ${ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO}.`
    );
  }
  if (decision.reason === 'path_limit') {
    const where = context.method && context.url ? `${context.method} ${context.url}` : 'this path';
    return (
      `Redis mock write skipped: ${where} already has ` +
      `${decision.pathCount ?? '?'} distinct hashes (max ${decision.maxPath} per path). ` +
      `Raise ${ENV_VARS.MOCK_MAX_MOCKS_PER_PATH} or set to 0 to disable.`
    );
  }
  return 'Redis mock write skipped by write limits';
}
