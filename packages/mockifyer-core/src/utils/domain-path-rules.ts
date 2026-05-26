import { envRecordResponsesOverride } from './request-only-mock';

/** Per host/path-prefix recording policy (stored in Redis per scenario). */
export interface DomainPathRule {
  /** When true, cache misses under this prefix save full response bodies. */
  recordResponses: boolean;
  /** When true with full recording, new mocks replay immediately (no alwaysUseRealApi). */
  autoMock?: boolean;
  updatedAt?: string;
}

export type DomainPathRulesMap = Record<string, DomainPathRule>;

/** Build domain-tree key `host/segment/...` from a request URL. */
export function endpointUrlToDomainPath(url: string): string | null {
  try {
    const u = new URL(url);
    const segments = u.pathname.replace(/\/+/g, '/').replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    return [u.host, ...segments].join('/');
  } catch {
    return null;
  }
}

/**
 * Longest-prefix rule match for a normalized domain path (folder key or request path).
 */
function findLongestRuleForPath(
  requestPath: string,
  rules: DomainPathRulesMap | null | undefined
): { domainPath: string; rule: DomainPathRule } | null {
  if (!rules || typeof rules !== 'object') return null;
  const normalized = requestPath.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) return null;

  let best: { domainPath: string; rule: DomainPathRule; len: number } | null = null;
  for (const [domainPath, rule] of Object.entries(rules)) {
    if (!domainPath.trim() || !rule || typeof rule !== 'object') continue;
    const prefix = domainPath.trim().replace(/^\/+|\/+$/g, '');
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best.len) {
        best = { domainPath: prefix, rule, len: prefix.length };
      }
    }
  }
  return best ? { domainPath: best.domainPath, rule: best.rule } : null;
}

/**
 * Longest-prefix rule match for a request URL against stored domain paths.
 */
export function findLongestDomainPathRule(
  url: string,
  rules: DomainPathRulesMap | null | undefined
): { domainPath: string; rule: DomainPathRule } | null {
  const requestPath = endpointUrlToDomainPath(url);
  if (!requestPath) return null;
  return findLongestRuleForPath(requestPath, rules);
}

/** Longest-prefix rule for a domain-tree folder path (same keys as {@link endpointUrlToDomainPath}). */
export function findLongestDomainPathRuleForFolder(
  folderPath: string,
  rules: DomainPathRulesMap | null | undefined
): { domainPath: string; rule: DomainPathRule } | null {
  return findLongestRuleForPath(folderPath, rules);
}

/**
 * Effective recordResponses for a proxy cache miss.
 *
 * Precedence: env → matching path rule → client body → scenario proxy config → default false.
 */
export function resolveRecordResponsesForRequest(input: {
  url: string;
  pathRules?: DomainPathRulesMap | null;
  fromBody?: boolean;
  fromScenario?: boolean;
}): { recordResponses: boolean; matchedPathRule: DomainPathRule | null; matchedDomainPath: string | null } {
  const envOverride = envRecordResponsesOverride();
  if (envOverride !== undefined) {
    return { recordResponses: envOverride, matchedPathRule: null, matchedDomainPath: null };
  }

  const matched = findLongestDomainPathRule(input.url, input.pathRules ?? undefined);
  if (matched && typeof matched.rule.recordResponses === 'boolean') {
    return {
      recordResponses: matched.rule.recordResponses,
      matchedPathRule: matched.rule,
      matchedDomainPath: matched.domainPath,
    };
  }

  if (typeof input.fromBody === 'boolean') {
    return { recordResponses: input.fromBody, matchedPathRule: null, matchedDomainPath: null };
  }
  if (typeof input.fromScenario === 'boolean') {
    return { recordResponses: input.fromScenario, matchedPathRule: null, matchedDomainPath: null };
  }

  return { recordResponses: false, matchedPathRule: null, matchedDomainPath: null };
}
