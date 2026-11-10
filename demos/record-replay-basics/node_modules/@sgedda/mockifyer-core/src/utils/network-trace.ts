import type { NetworkEvent, NetworkEventSource, NetworkEventTransport } from './network-log';

export type NetworkTraceLookupBy = 'requestId' | 'eventId';

export interface NetworkTraceLookup {
  by: NetworkTraceLookupBy;
  value: string;
}

export interface NetworkTraceHopRequest {
  headers?: Record<string, string>;
  body?: string;
}

export interface NetworkTraceHopResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

/** One hop in a multi-service trace (root → downstream). */
export interface NetworkTraceHop {
  index: number;
  eventId: string;
  requestId: string | null;
  parentRequestId: string | null;
  timestamp: string;
  method: string;
  url: string;
  host?: string;
  path?: string;
  status?: number;
  source: NetworkEventSource;
  durationMs?: number;
  transport: NetworkEventTransport;
  clientId?: string | null;
  request?: NetworkTraceHopRequest;
  response?: NetworkTraceHopResponse;
}

/**
 * Full request chain for a {@link MOCKIFYER_REQUEST_ID_HEADER} or dashboard event id.
 * `hops` are ordered root-first (caller → callee → consumer).
 */
export interface NetworkRequestTrace {
  lookup: NetworkTraceLookup;
  scenario: string;
  rootRequestId: string | null;
  anchorRequestId: string | null;
  anchorEventId: string;
  hopCount: number;
  hops: NetworkTraceHop[];
  /** True when a parent or child link points outside the loaded event set. */
  incomplete: boolean;
}

export interface ResolveNetworkRequestTraceOptions {
  by: NetworkTraceLookupBy;
  value: string;
  scenario: string;
}

export interface NetworkEventChainMaps {
  byRequestId: Map<string, NetworkEvent>;
  byEventId: Map<string, NetworkEvent>;
  childrenByParent: Map<string, NetworkEvent[]>;
}

export function buildNetworkEventChainMaps(events: NetworkEvent[]): NetworkEventChainMaps {
  const byRequestId = new Map<string, NetworkEvent>();
  const byEventId = new Map<string, NetworkEvent>();
  const childrenByParent = new Map<string, NetworkEvent[]>();

  for (const event of events) {
    byEventId.set(event.id, event);
    if (event.requestId) {
      const existing = byRequestId.get(event.requestId);
      if (!existing || event.timestamp > existing.timestamp) {
        byRequestId.set(event.requestId, event);
      }
    }
    if (event.parentRequestId) {
      const siblings = childrenByParent.get(event.parentRequestId) ?? [];
      siblings.push(event);
      childrenByParent.set(event.parentRequestId, siblings);
    }
  }

  for (const [, children] of childrenByParent) {
    children.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  return { byRequestId, byEventId, childrenByParent };
}

function networkEventToTraceHop(event: NetworkEvent, index: number): NetworkTraceHop {
  const hop: NetworkTraceHop = {
    index,
    eventId: event.id,
    requestId: event.requestId ?? null,
    parentRequestId: event.parentRequestId ?? null,
    timestamp: event.timestamp,
    method: event.method,
    url: event.url,
    host: event.host,
    path: event.path,
    status: event.status,
    source: event.source,
    durationMs: event.durationMs,
    transport: event.transport,
    clientId: event.clientId,
  };

  if (event.requestHeaders || event.requestBodyPreview) {
    hop.request = {
      headers: event.requestHeaders,
      body: event.requestBodyPreview,
    };
  }
  if (event.responseHeaders || event.responseBodyPreview || event.status !== undefined) {
    hop.response = {
      status: event.status,
      headers: event.responseHeaders,
      body: event.responseBodyPreview,
    };
  }

  return hop;
}

function walkAncestors(
  anchor: NetworkEvent,
  byRequestId: Map<string, NetworkEvent>
): { ancestors: NetworkEvent[]; incomplete: boolean } {
  const ancestors: NetworkEvent[] = [];
  let incomplete = false;
  const seen = new Set<string>([anchor.id]);
  let current = anchor;

  while (current.parentRequestId) {
    const parent = byRequestId.get(current.parentRequestId);
    if (!parent || seen.has(parent.id)) {
      incomplete = true;
      break;
    }
    ancestors.unshift(parent);
    seen.add(parent.id);
    current = parent;
  }

  return { ancestors, incomplete };
}

function collectDescendants(
  anchorRequestId: string,
  childrenByParent: Map<string, NetworkEvent[]>
): NetworkEvent[] {
  const out: NetworkEvent[] = [];
  const seenEventIds = new Set<string>();
  const queue = [...(childrenByParent.get(anchorRequestId) ?? [])];

  while (queue.length > 0) {
    const child = queue.shift()!;
    if (seenEventIds.has(child.id)) {
      continue;
    }
    seenEventIds.add(child.id);
    out.push(child);
    if (child.requestId) {
      const grandchildren = childrenByParent.get(child.requestId) ?? [];
      for (const gc of grandchildren) {
        queue.push(gc);
      }
    }
  }

  return out;
}

function buildTraceResult(
  options: ResolveNetworkRequestTraceOptions,
  ordered: NetworkEvent[],
  anchor: NetworkEvent | null,
  rootRequestId: string | null,
  incomplete: boolean
): NetworkRequestTrace {
  const hops = ordered.map((event, index) => networkEventToTraceHop(event, index));
  return {
    lookup: { by: options.by, value: options.value.trim() },
    scenario: options.scenario,
    rootRequestId,
    anchorRequestId: anchor?.requestId ?? rootRequestId,
    anchorEventId: anchor?.id ?? ordered[0]?.id ?? '',
    hopCount: hops.length,
    hops,
    incomplete,
  };
}

/**
 * Trace keyed by an inbound/root id echoed on the entry service response.
 * No network row has `requestId === rootId`; downstream hops use it as `parentRequestId`.
 */
function resolveTraceFromVirtualRoot(
  maps: NetworkEventChainMaps,
  options: ResolveNetworkRequestTraceOptions,
  rootId: string
): NetworkRequestTrace | null {
  const descendants = collectDescendants(rootId, maps.childrenByParent);
  if (descendants.length === 0) {
    return null;
  }
  const incomplete = descendants.some(
    (event) =>
      Boolean(
        event.parentRequestId &&
          event.parentRequestId !== rootId &&
          !maps.byRequestId.has(event.parentRequestId)
      )
  );
  return buildTraceResult(options, descendants, null, rootId, incomplete);
}

/**
 * Resolves a correlated multi-hop trace from network log events.
 * Use `requestId` from `X-Mockifyer-Request-Id` (preferred) or dashboard `eventId`.
 *
 * When `requestId` matches only as a parent (entry-service trace id with no logged inbound hop),
 * returns all descendant hops ordered root-first.
 */
export function resolveNetworkRequestTrace(
  events: NetworkEvent[],
  options: ResolveNetworkRequestTraceOptions
): NetworkRequestTrace | null {
  const value = options.value.trim();
  if (!value) {
    return null;
  }

  const maps = buildNetworkEventChainMaps(events);

  if (options.by === 'eventId') {
    const anchor = maps.byEventId.get(value);
    if (!anchor) {
      return null;
    }
    return resolveTraceFromAnchor(maps, options, anchor);
  }

  const anchor = maps.byRequestId.get(value);
  if (anchor) {
    return resolveTraceFromAnchor(maps, options, anchor);
  }

  return resolveTraceFromVirtualRoot(maps, options, value);
}

function resolveTraceFromAnchor(
  maps: NetworkEventChainMaps,
  options: ResolveNetworkRequestTraceOptions,
  anchor: NetworkEvent
): NetworkRequestTrace {
  const { ancestors, incomplete: ancestorsIncomplete } = walkAncestors(anchor, maps.byRequestId);
  const descendants = anchor.requestId
    ? collectDescendants(anchor.requestId, maps.childrenByParent)
    : [];

  const ordered = [...ancestors, anchor, ...descendants];
  const root = ordered[0];

  let incomplete = ancestorsIncomplete;
  if (anchor.parentRequestId && !maps.byRequestId.has(anchor.parentRequestId)) {
    incomplete = true;
  }

  return buildTraceResult(
    options,
    ordered,
    anchor,
    root.requestId ?? anchor.requestId ?? null,
    incomplete
  );
}
