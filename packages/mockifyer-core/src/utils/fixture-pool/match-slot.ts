import type { StoredRequest } from '../../types';
import type { EndpointSlot, SlotMatch, SlotMatchQuery } from '../../types/fixture-pool';
import { isGraphQLRequest, normalizeGraphQLQuery } from '../mock-matcher';
import { hostFromUrl, matchPathPattern, pathnameFromUrl } from './path-pattern';

/**
 * True when the outbound request matches the slot's match rule.
 */
export function requestMatchesSlot(request: StoredRequest, match: SlotMatch): boolean {
  if (match.kind === 'rest') {
    if (isGraphQLRequest(request)) return false;
    const method = (request.method || 'GET').toUpperCase();
    if (method !== match.method.toUpperCase()) return false;

    if (match.host) {
      const host = hostFromUrl(request.url);
      if (!host || host !== match.host) return false;
    }

    const pathname = pathnameFromUrl(request.url);
    if (!matchPathPattern(pathname, match.pathPattern)) return false;

    return queryMatches(request, match.matchQuery);
  }

  // graphql
  if (!isGraphQLRequest(request)) return false;

  const body = parseBody(request.data);
  if (!body || typeof body !== 'object') return false;

  const operationName =
    typeof (body as { operationName?: unknown }).operationName === 'string'
      ? (body as { operationName: string }).operationName
      : undefined;
  const query =
    typeof (body as { query?: unknown }).query === 'string'
      ? (body as { query: string }).query
      : undefined;
  const variables = (body as { variables?: unknown }).variables;

  if (match.operationName) {
    if (operationName !== match.operationName) return false;
  }
  if (match.queryHash) {
    if (!query) return false;
    const normalized = normalizeGraphQLQuery(query);
    if (simpleHash(normalized) !== match.queryHash && normalized !== match.queryHash) {
      return false;
    }
  }
  if (!match.operationName && !match.queryHash) return false;

  if (match.variablesTemplate && Object.keys(match.variablesTemplate).length > 0) {
    if (!variables || typeof variables !== 'object') return false;
    for (const [key, expected] of Object.entries(match.variablesTemplate)) {
      if (!(key in (variables as Record<string, unknown>))) return false;
      if (expected === '*') continue;
      if ((variables as Record<string, unknown>)[key] !== expected) return false;
    }
  }

  return true;
}

function queryMatches(request: StoredRequest, matchQuery: SlotMatchQuery | undefined): boolean {
  const mode = matchQuery ?? 'exact';
  if (mode === 'ignore') return true;

  const params = request.queryParams ?? {};
  if (typeof mode === 'object' && Array.isArray(mode.requiredParams)) {
    for (const key of mode.requiredParams) {
      if (!(key in params)) return false;
    }
    return true;
  }

  // exact: no extra check beyond path — query identity is mainly for legacy keys.
  // For slots, "exact" means all provided query params on the request must match
  // if the slot later gains an explicit query map; for v1 treat as path-only.
  return true;
}

function parseBody(data: unknown): unknown {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return `q${(h >>> 0).toString(16)}`;
}

/**
 * First enabled slot whose match fits the request (manifest order).
 */
export function findMatchingSlot(
  request: StoredRequest,
  slots: EndpointSlot[]
): EndpointSlot | undefined {
  for (const slot of slots) {
    if (slot.enabled === false) continue;
    if (slot.assignment.kind === 'none') continue;
    if (requestMatchesSlot(request, slot.match)) return slot;
  }
  return undefined;
}
