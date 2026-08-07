import { ENV_VARS, type DomainPathRulesMode } from '../types';
import { envRecordResponsesOverride } from './request-only-mock';
import { resolveOutboundUrl } from './recording-exclusion';
import { logger } from './logger';

/** Per host/path-prefix recording policy (stored in Redis / `domain-path-rules.json` per scenario). */
export interface DomainPathRule {
  /** When true, cache misses under this prefix save full response bodies. */
  recordResponses: boolean;
  /** When true with full recording, new mocks replay immediately (no alwaysUseRealApi). */
  autoMock?: boolean;
  updatedAt?: string;
}

export type DomainPathRulesMap = Record<string, DomainPathRule>;

export const DOMAIN_PATH_RULES_FILENAME = 'domain-path-rules.json';

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;

function normalizeRuntimeMode(raw: unknown): DomainPathRulesMode | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const t = String(raw).trim().toLowerCase().replace(/-/g, '_');
  if (!t) {
    return undefined;
  }
  if (t === 'allowlist' || t === 'allow_list' || t === 'allow') {
    return 'allowlist';
  }
  if (t === 'record_all' || t === 'recordall' || t === 'all') {
    return 'record_all';
  }
  if (t === 'off' || t === 'disabled' || t === 'none' || t === 'legacy') {
    return 'off';
  }
  return undefined;
}

/**
 * Resolves domain-path rules mode.
 *
 * Precedence: **`configMode`** → **`MOCKIFYER_DOMAIN_PATH_RULES_MODE`** → default **`allowlist`**.
 */
export function resolveDomainPathRulesMode(input?: {
  configMode?: DomainPathRulesMode | string | undefined;
}): DomainPathRulesMode {
  const fromConfig = normalizeRuntimeMode(input?.configMode);
  if (fromConfig) {
    return fromConfig;
  }

  const env = typeof process !== 'undefined' ? process.env : undefined;
  const rawMode = env?.[ENV_VARS.MOCK_DOMAIN_PATH_RULES_MODE];
  const fromEnv = normalizeRuntimeMode(rawMode);
  if (rawMode != null && String(rawMode).trim() !== '' && !fromEnv) {
    logger.warn(
      `[Mockifyer] Unknown ${ENV_VARS.MOCK_DOMAIN_PATH_RULES_MODE}="${rawMode}"; expected allowlist | record_all | off. Using default allowlist.`
    );
  }
  if (fromEnv) {
    return fromEnv;
  }

  return 'allowlist';
}

/** Defaults applied when discovering a new domain-path key for the given mode. */
export function discoveryDefaultsForMode(mode: DomainPathRulesMode): DomainPathRule | null {
  if (mode === 'off') {
    return null;
  }
  if (mode === 'record_all') {
    return { recordResponses: true, autoMock: true };
  }
  return { recordResponses: false, autoMock: false };
}

/** Build domain-tree key `host/segment/...` from a request URL. */
export function endpointUrlToDomainPath(url: string): string | null {
  try {
    const u = new URL(url);
    const segments = u.pathname
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '')
      .split('/')
      .filter(Boolean);
    return [u.host, ...segments].join('/');
  } catch {
    return null;
  }
}

/** Collapse pure-numeric and UUID path segments to `:id` for stable discovery keys. */
export function collapseDomainPathIdSegments(domainPath: string): string {
  const parts = domainPath.trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  const [host, ...segments] = parts;
  const collapsed = segments.map((seg) => {
    if (NUMERIC_SEGMENT.test(seg) || UUID_SEGMENT.test(seg)) {
      return ':id';
    }
    return seg;
  });
  return [host, ...collapsed].join('/');
}

/**
 * Discovery key for a request URL: host + path with id-like segments collapsed.
 * Resolves relative URLs when `baseUrl` is provided.
 */
export function normalizeDomainPathForDiscovery(
  rawUrl: string | null | undefined,
  baseUrl?: string | null
): string | null {
  const resolved = resolveOutboundUrl(rawUrl, baseUrl) ?? (typeof rawUrl === 'string' ? rawUrl.trim() : '');
  if (!resolved) {
    return null;
  }
  const full = endpointUrlToDomainPath(resolved);
  if (!full) {
    return null;
  }
  return collapseDomainPathIdSegments(full);
}

/** Host-only key from a domain path (`api.example.com/v1` → `api.example.com`). */
export function hostKeyFromDomainPath(domainPath: string): string | null {
  const host = domainPath.trim().replace(/^\/+|\/+$/g, '').split('/')[0];
  return host && host.length > 0 ? host : null;
}

/** Segment count + concrete-segment score for choosing among prefix matches. */
function domainPathMatchRank(domainPath: string): { segments: number; concrete: number } {
  const parts = domainPath.trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  let concrete = 0;
  for (const part of parts) {
    if (part !== ':id') {
      concrete += 1;
    }
  }
  return { segments: parts.length, concrete };
}

/** Prefer deeper rules; at the same depth prefer concrete segments over `:id`. */
function isBetterDomainPathMatch(candidate: string, current: string | null): boolean {
  if (!current) {
    return true;
  }
  const a = domainPathMatchRank(candidate);
  const b = domainPathMatchRank(current);
  if (a.segments !== b.segments) {
    return a.segments > b.segments;
  }
  return a.concrete > b.concrete;
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

  let best: { domainPath: string; rule: DomainPathRule } | null = null;
  for (const [domainPath, rule] of Object.entries(rules)) {
    if (!domainPath.trim() || !rule || typeof rule !== 'object') continue;
    const prefix = domainPath.trim().replace(/^\/+|\/+$/g, '');
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      if (!best || isBetterDomainPathMatch(prefix, best.domainPath)) {
        best = { domainPath: prefix, rule };
      }
    }
  }
  return best;
}

/**
 * Strict parent rule for a domain-path key (longest prefix shorter than `domainPath`).
 */
function findStrictParentDomainPathRule(
  domainPath: string,
  rules: DomainPathRulesMap
): DomainPathRule | null {
  const normalized = domainPath.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return null;
  }
  const parts = normalized.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const prefix = parts.slice(0, i).join('/');
    const parent = rules[prefix];
    if (parent && typeof parent === 'object') {
      return parent;
    }
  }
  return null;
}

function pickBetterDomainPathRuleMatch(
  a: { domainPath: string; rule: DomainPathRule } | null,
  b: { domainPath: string; rule: DomainPathRule } | null
): { domainPath: string; rule: DomainPathRule } | null {
  if (!a) return b;
  if (!b) return a;
  return isBetterDomainPathMatch(b.domainPath, a.domainPath) ? b : a;
}

/**
 * Best rule for a live request URL: consider both `:id`-collapsed and exact paths,
 * preferring deeper / more concrete keys so dashboard toggles on real IDs win over
 * discovery keys like `…/users/:id`.
 */
export function findBestDomainPathRuleForUrl(
  url: string,
  rules: DomainPathRulesMap | null | undefined,
  baseUrl?: string | null
): { domainPath: string; rule: DomainPathRule } | null {
  const resolved = resolveOutboundUrl(url, baseUrl) ?? (typeof url === 'string' ? url.trim() : '');
  if (!resolved) {
    return null;
  }
  const discoveryPath = normalizeDomainPathForDiscovery(resolved, null);
  const exactPath = endpointUrlToDomainPath(resolved);
  return pickBetterDomainPathRuleMatch(
    discoveryPath ? findLongestRuleForPath(discoveryPath, rules) : null,
    exactPath ? findLongestRuleForPath(exactPath, rules) : null
  );
}

/**
 * Longest-prefix rule match for a request URL against stored domain paths.
 * Uses `:id` collapse so discovery keys match live numeric/UUID URLs (Redis proxy + Hybrid).
 */
export function findLongestDomainPathRule(
  url: string,
  rules: DomainPathRulesMap | null | undefined
): { domainPath: string; rule: DomainPathRule } | null {
  return findBestDomainPathRuleForUrl(url, rules);
}

/** Longest-prefix rule for a domain-tree folder path (same keys as {@link endpointUrlToDomainPath}). */
export function findLongestDomainPathRuleForFolder(
  folderPath: string,
  rules: DomainPathRulesMap | null | undefined
): { domainPath: string; rule: DomainPathRule } | null {
  const normalized = folderPath.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return null;
  }
  const collapsed = collapseDomainPathIdSegments(normalized);
  return pickBetterDomainPathRuleMatch(
    findLongestRuleForPath(normalized, rules),
    collapsed !== normalized ? findLongestRuleForPath(collapsed, rules) : null
  );
}

/**
 * Insert missing domain-path keys with the given defaults.
 * When a parent rule already allows record/replay, new child keys inherit those flags
 * so allowlist discovery cannot shadow an enabled host with a deny `:id` path.
 * Also repairs discovery-seeded deny children (no `updatedAt`) under an allowing parent.
 * @returns whether the map changed and which keys were added/repaired.
 */
export function upsertDiscoveredDomainPathRule(
  rules: DomainPathRulesMap,
  domainPath: string,
  defaults: DomainPathRule
): { changed: boolean; upserted: string[] } {
  const upserted: string[] = [];
  const key = domainPath.trim().replace(/^\/+|\/+$/g, '');
  if (!key) {
    return { changed: false, upserted };
  }

  const ensure = (
    pathKey: string,
    ruleDefaults: DomainPathRule,
    options?: { repairDiscoverySeed?: boolean }
  ) => {
    const existing = rules[pathKey];
    if (existing) {
      // Discovery seeds omit updatedAt; dashboard/API writes set it.
      // Only repair path seeds when an allowing parent is being inherited — never
      // reinterpret mode defaults as a reason to flip an existing host/path key.
      const isDiscoverySeed =
        existing.updatedAt == null &&
        existing.recordResponses !== true &&
        existing.autoMock !== true;
      if (
        options?.repairDiscoverySeed &&
        isDiscoverySeed &&
        (ruleDefaults.recordResponses === true || ruleDefaults.autoMock === true)
      ) {
        rules[pathKey] = {
          recordResponses: ruleDefaults.recordResponses === true,
          autoMock: ruleDefaults.autoMock === true,
          updatedAt: ruleDefaults.updatedAt,
        };
        upserted.push(pathKey);
      }
      return;
    }
    rules[pathKey] = {
      recordResponses: ruleDefaults.recordResponses === true,
      autoMock: ruleDefaults.autoMock === true,
      updatedAt: ruleDefaults.updatedAt,
    };
    upserted.push(pathKey);
  };

  const host = hostKeyFromDomainPath(key);
  if (host) {
    ensure(host, defaults);
  }

  // Path keys (beyond host) inherit allowing parents so discovery cannot shadow them.
  if (key !== host) {
    const parent = findStrictParentDomainPathRule(key, rules);
    const inherit =
      parent != null && (parent.recordResponses === true || parent.autoMock === true);
    const pathDefaults = inherit
      ? {
          recordResponses: parent!.recordResponses === true,
          autoMock: parent!.autoMock === true,
        }
      : defaults;
    ensure(key, pathDefaults, { repairDiscoverySeed: inherit });
  }

  return { changed: upserted.length > 0, upserted };
}

/**
 * Discover host + normalized path keys for a URL into `rules` (mutates).
 */
export function discoverDomainPathRulesForUrl(
  rules: DomainPathRulesMap,
  rawUrl: string | null | undefined,
  mode: DomainPathRulesMode,
  baseUrl?: string | null
): { changed: boolean; upserted: string[] } {
  const defaults = discoveryDefaultsForMode(mode);
  if (!defaults) {
    return { changed: false, upserted: [] };
  }
  const domainPath = normalizeDomainPathForDiscovery(rawUrl, baseUrl);
  if (!domainPath) {
    return { changed: false, upserted: [] };
  }
  return upsertDiscoveredDomainPathRule(rules, domainPath, defaults);
}

/**
 * Merge discovery upserts into a copy of existing rules (immutable helper for Metro / file writers).
 */
export function mergeDiscoveredDomainPathRules(
  existing: DomainPathRulesMap,
  rawUrl: string | null | undefined,
  mode: DomainPathRulesMode,
  baseUrl?: string | null
): { rules: DomainPathRulesMap; changed: boolean; upserted: string[] } {
  const rules: DomainPathRulesMap = { ...existing };
  for (const [k, v] of Object.entries(existing)) {
    rules[k] = { ...v };
  }
  const result = discoverDomainPathRulesForUrl(rules, rawUrl, mode, baseUrl);
  return { rules, changed: result.changed, upserted: result.upserted };
}

/**
 * Merge multiple discovery payloads (Metro batch) without overwriting existing keys.
 */
export function mergeDomainPathRuleUpserts(
  existing: DomainPathRulesMap,
  upserts: DomainPathRulesMap
): { rules: DomainPathRulesMap; changed: boolean } {
  const rules: DomainPathRulesMap = { ...existing };
  for (const [k, v] of Object.entries(existing)) {
    rules[k] = { ...v };
  }
  let changed = false;
  for (const [domainPath, rule] of Object.entries(upserts)) {
    const key = domainPath.trim().replace(/^\/+|\/+$/g, '');
    if (!key || rules[key] || !rule || typeof rule !== 'object') {
      continue;
    }
    if (typeof rule.recordResponses !== 'boolean') {
      continue;
    }
    rules[key] = {
      recordResponses: rule.recordResponses === true,
      autoMock: rule.autoMock === true,
      updatedAt: typeof rule.updatedAt === 'string' ? rule.updatedAt : undefined,
    };
    changed = true;
  }
  return { rules, changed };
}

export interface DomainPathTrafficGate {
  mayRecord: boolean;
  mayReplay: boolean;
  matchedDomainPath: string | null;
  matchedRule: DomainPathRule | null;
}

/**
 * Hybrid/filesystem record + replay gate from longest-prefix rules + mode.
 *
 * - **`off`** — always allow (no gate).
 * - **`allowlist`** — unmatched → deny; matched uses rule flags.
 * - **`record_all`** — unmatched → allow; matched uses rule flags.
 */
export function resolveDomainPathTrafficGate(
  rawUrl: string | null | undefined,
  rules: DomainPathRulesMap | null | undefined,
  mode: DomainPathRulesMode,
  baseUrl?: string | null
): DomainPathTrafficGate {
  if (mode === 'off') {
    return { mayRecord: true, mayReplay: true, matchedDomainPath: null, matchedRule: null };
  }

  const resolved = resolveOutboundUrl(rawUrl, baseUrl) ?? (typeof rawUrl === 'string' ? rawUrl.trim() : '');
  if (!resolved) {
    const allow = mode === 'record_all';
    return { mayRecord: allow, mayReplay: allow, matchedDomainPath: null, matchedRule: null };
  }

  const matched = findBestDomainPathRuleForUrl(resolved, rules, null);

  if (!matched) {
    const allow = mode === 'record_all';
    return { mayRecord: allow, mayReplay: allow, matchedDomainPath: null, matchedRule: null };
  }

  return {
    mayRecord: matched.rule.recordResponses === true,
    mayReplay: matched.rule.autoMock === true,
    matchedDomainPath: matched.domainPath,
    matchedRule: matched.rule,
  };
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

/** Parse a JSON object into a {@link DomainPathRulesMap}. */
export function parseDomainPathRules(raw: unknown): DomainPathRulesMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: DomainPathRulesMap = {};
  for (const [domainPath, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const r = val as Record<string, unknown>;
    if (typeof r.recordResponses !== 'boolean') continue;
    out[domainPath] = {
      recordResponses: r.recordResponses,
      autoMock: r.autoMock === true,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    };
  }
  return out;
}
