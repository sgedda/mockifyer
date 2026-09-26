/**
 * Pull correlated hops from the dashboard network log into Atlas / Metro.
 *
 * Remote BFFs emit children to the shared dashboard with `parentRequestId`.
 * Metro cannot receive those POSTs, so Atlas merges them via
 * `GET /api/network-events/trace?requestId=…`.
 */

import { joinProxyDashboardApiUrl } from './join-proxy-dashboard-api-url';
import type { NetworkEvent } from './network-event-types';
import type { NetworkRequestTrace, NetworkTraceHop } from './network-trace';
import { resolveUnpatchedFetch } from './unpatched-global-fetch';

/** Keep Atlas responsive: a slow dashboard must not stall Metro `t`. */
const DEFAULT_TRACE_FETCH_TIMEOUT_MS = 3_000;

/** Enough to cover a capture session without scanning the whole store. */
const DEFAULT_EVENT_LIST_LIMIT = 1_000;

export interface FetchDashboardNetworkTraceOptions {
  /** Dashboard origin + optional mount (e.g. `http://localhost:4000/mockifyer`). */
  dashboardBaseUrl: string;
  /** Root or parent hop id (`X-Mockifyer-Request-Id`). */
  requestId: string;
  scenario?: string;
  clientId?: string;
  /** Scan depth for the dashboard store list behind `/trace`. */
  limit?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * Normalize a dashboard base from env, Metro config, or a hop POST hint.
 */
export function normalizeDashboardBaseUrl(raw: string | null | undefined): string | undefined {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/\/+$/, '');
}

/**
 * Convert a dashboard `/api/network-events/trace` hop into a Metro {@link NetworkEvent}.
 */
export function networkTraceHopToNetworkEvent(
  hop: NetworkTraceHop,
  scenario: string
): NetworkEvent {
  return {
    id: hop.eventId,
    timestamp: hop.timestamp,
    scenario,
    transport: hop.transport,
    method: hop.method,
    url: hop.url,
    host: hop.host,
    path: hop.path,
    status: hop.status ?? hop.response?.status,
    source: hop.source,
    durationMs: hop.durationMs,
    requestId: hop.requestId,
    parentRequestId: hop.parentRequestId,
    clientId: hop.clientId ?? null,
    requestHeaders: hop.request?.headers,
    responseHeaders: hop.response?.headers,
    requestBodyPreview: hop.request?.body,
    responseBodyPreview: hop.response?.body,
  };
}

export function networkTraceToNetworkEvents(trace: NetworkRequestTrace): NetworkEvent[] {
  return trace.hops.map((hop) => networkTraceHopToNetworkEvent(hop, trace.scenario));
}

/**
 * GET dashboard JSON with an abort deadline. Returns `undefined` on any failure —
 * observability must never break Metro ingest or Atlas render.
 */
async function fetchDashboardJson<T>(
  url: string,
  timeoutMs: number,
  fetchFn?: typeof fetch
): Promise<T | undefined> {
  const doFetch = fetchFn ?? resolveUnpatchedFetch();
  if (!doFetch) {
    return undefined;
  }
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer =
    controller && typeof setTimeout === 'function'
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;
  try {
    const res = await doFetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!res.ok) {
      return undefined;
    }
    return (await res.json()) as T;
  } catch {
    return undefined;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Fetch the multi-hop trace for `requestId` from the dashboard. Returns `[]` on
 * miss / errors. Prefer {@link fetchDashboardNetworkEventsList} when enriching many
 * parents — one list call beats one trace call per hop.
 */
export async function fetchDashboardNetworkTraceEvents(
  options: FetchDashboardNetworkTraceOptions
): Promise<NetworkEvent[]> {
  const dashboardBaseUrl = normalizeDashboardBaseUrl(options.dashboardBaseUrl);
  const requestId = options.requestId.trim();
  if (!dashboardBaseUrl || !requestId) {
    return [];
  }

  const params = new URLSearchParams();
  params.set('requestId', requestId);
  params.set(
    'limit',
    String(options.limit && options.limit > 0 ? options.limit : DEFAULT_EVENT_LIST_LIMIT)
  );
  if (options.scenario?.trim()) {
    params.set('scenario', options.scenario.trim());
  }
  if (options.clientId?.trim()) {
    params.set('clientId', options.clientId.trim());
  }

  const json = await fetchDashboardJson<{ trace?: NetworkRequestTrace }>(
    `${joinProxyDashboardApiUrl(dashboardBaseUrl, 'api/network-events/trace')}?${params}`,
    options.timeoutMs ?? DEFAULT_TRACE_FETCH_TIMEOUT_MS,
    options.fetchFn
  );
  if (!json?.trace || !Array.isArray(json.trace.hops)) {
    return [];
  }
  return networkTraceToNetworkEvents(json.trace);
}

export interface FetchDashboardNetworkEventsListOptions {
  dashboardBaseUrl: string;
  scenario?: string;
  clientId?: string;
  /** Newest-N scan window (default 1000). */
  limit?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * One `GET /api/network-events` for the whole capture window. Children are linked
 * locally by `parentRequestId`, so enrichment costs a single request.
 */
export async function fetchDashboardNetworkEventsList(
  options: FetchDashboardNetworkEventsListOptions
): Promise<NetworkEvent[]> {
  const dashboardBaseUrl = normalizeDashboardBaseUrl(options.dashboardBaseUrl);
  if (!dashboardBaseUrl) {
    return [];
  }

  const params = new URLSearchParams();
  params.set(
    'limit',
    String(options.limit && options.limit > 0 ? options.limit : DEFAULT_EVENT_LIST_LIMIT)
  );
  if (options.scenario?.trim()) {
    params.set('scenario', options.scenario.trim());
  }
  if (options.clientId?.trim()) {
    params.set('clientId', options.clientId.trim());
  }

  const json = await fetchDashboardJson<{ events?: NetworkEvent[] }>(
    `${joinProxyDashboardApiUrl(dashboardBaseUrl, 'api/network-events')}?${params}`,
    options.timeoutMs ?? DEFAULT_TRACE_FETCH_TIMEOUT_MS,
    options.fetchFn
  );
  return Array.isArray(json?.events) ? json.events : [];
}

export interface SelectDashboardDescendantHopsOptions {
  /** Hop ids already in Metro that may own remote children. */
  parentRequestIds: readonly string[];
  /** Events already in the Metro buffer (skip duplicates). */
  existing: readonly NetworkEvent[];
  /** Dashboard events to link (trace hops or a plain list). */
  candidateEvents: readonly NetworkEvent[];
}

/**
 * Keep dashboard hops that descend from any of `parentRequestIds` and are not already
 * buffered. Parent rows themselves are skipped — Metro already has those hops.
 */
export function selectNewDashboardDescendantHops(
  options: SelectDashboardDescendantHopsOptions
): NetworkEvent[] {
  const parentIds = new Set(
    options.parentRequestIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id))
  );
  if (parentIds.size === 0) {
    return [];
  }

  const existingIds = new Set(
    options.existing.map((e) => e.id).filter((id): id is string => Boolean(id?.trim()))
  );
  const existingRequestIds = new Set(
    options.existing
      .map((e) => e.requestId?.trim())
      .filter((id): id is string => Boolean(id))
  );

  const byRequestId = new Map<string, NetworkEvent>();
  for (const ev of options.candidateEvents) {
    const rid = ev.requestId?.trim();
    if (rid && !byRequestId.has(rid)) {
      byRequestId.set(rid, ev);
    }
  }

  const descendsFromParent = (ev: NetworkEvent): boolean => {
    let current: NetworkEvent | undefined = ev;
    const guard = new Set<string>();
    while (current?.parentRequestId) {
      const pid = current.parentRequestId.trim();
      if (!pid || guard.has(pid)) {
        return false;
      }
      if (parentIds.has(pid)) {
        return true;
      }
      guard.add(pid);
      current = byRequestId.get(pid);
    }
    return false;
  };

  const out: NetworkEvent[] = [];
  const seen = new Set<string>();

  for (const ev of options.candidateEvents) {
    const rid = ev.requestId?.trim();
    if (rid && parentIds.has(rid)) {
      continue;
    }
    if (existingIds.has(ev.id) || (rid && existingRequestIds.has(rid))) {
      continue;
    }
    if (!descendsFromParent(ev)) {
      continue;
    }
    const key = rid || ev.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(ev);
  }

  return out;
}

export interface SelectDashboardTraceChildrenOptions {
  /** Parent hop id we already have in Metro (GraphQL / entry). */
  parentRequestId: string;
  /** Events already in the Metro buffer (skip duplicates). */
  existing: readonly NetworkEvent[];
  /** Full trace from the dashboard (may include the parent row). */
  traceEvents: readonly NetworkEvent[];
}

/** Single-parent form of {@link selectNewDashboardDescendantHops}. */
export function selectNewDashboardChildHops(
  options: SelectDashboardTraceChildrenOptions
): NetworkEvent[] {
  return selectNewDashboardDescendantHops({
    parentRequestIds: [options.parentRequestId],
    existing: options.existing,
    candidateEvents: options.traceEvents,
  });
}

export interface PullDashboardDescendantsOptions {
  dashboardBaseUrl: string;
  /** Buffered hop ids to look for children of. */
  parentRequestIds: readonly string[];
  existing: readonly NetworkEvent[];
  scenario?: string;
  clientId?: string;
  limit?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/**
 * One dashboard list call, then link new descendants for every buffered parent.
 * Use this for Atlas enrichment — it replaces per-hop `/trace` fan-out.
 */
export async function pullDashboardDescendantsForParents(
  options: PullDashboardDescendantsOptions
): Promise<NetworkEvent[]> {
  const parentRequestIds = options.parentRequestIds
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));
  if (parentRequestIds.length === 0) {
    return [];
  }

  const candidateEvents = await fetchDashboardNetworkEventsList({
    dashboardBaseUrl: options.dashboardBaseUrl,
    scenario: options.scenario,
    clientId: options.clientId,
    limit: options.limit,
    timeoutMs: options.timeoutMs,
    fetchFn: options.fetchFn,
  });
  if (candidateEvents.length === 0) {
    return [];
  }

  return selectNewDashboardDescendantHops({
    parentRequestIds,
    existing: options.existing,
    candidateEvents,
  });
}

export interface PullDashboardChildrenForParentOptions {
  dashboardBaseUrl: string;
  parentRequestId: string;
  existing: readonly NetworkEvent[];
  scenario?: string;
  clientId?: string;
  fetchFn?: typeof fetch;
}

/**
 * Fetch dashboard trace for one `parentRequestId` and return new descendant hops.
 * Prefer {@link pullDashboardDescendantsForParents} when enriching a whole buffer.
 */
export async function pullDashboardChildrenForParent(
  options: PullDashboardChildrenForParentOptions
): Promise<NetworkEvent[]> {
  const traceEvents = await fetchDashboardNetworkTraceEvents({
    dashboardBaseUrl: options.dashboardBaseUrl,
    requestId: options.parentRequestId,
    scenario: options.scenario,
    clientId: options.clientId,
    fetchFn: options.fetchFn,
  });
  if (traceEvents.length === 0) {
    return [];
  }
  return selectNewDashboardChildHops({
    parentRequestId: options.parentRequestId,
    existing: options.existing,
    traceEvents,
  });
}
