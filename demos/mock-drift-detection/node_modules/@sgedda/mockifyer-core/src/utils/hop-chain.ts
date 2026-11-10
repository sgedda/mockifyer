/**
 * Hop-chain shape helpers shared by dashboard UI and tests.
 *
 * A real multi-service call chain is a short nested tree (gateway → services →
 * external). A client session dump is a flat fan-out of unrelated APIs (or a
 * degenerate daisy-chain) and must not be shown as one "service chain".
 */

export interface HopChainLink {
  id: string;
  parentId?: string | null;
  method?: string | null;
  url?: string | null;
}

export interface HopChainShape {
  hopCount: number;
  uniqueEndpoints: number;
  uniqueHosts: number;
  /** Longest parent walk among hops that have a parent in the same set (0 = no links). */
  maxDepth: number;
}

/** Flat session of many unrelated APIs incorrectly parented to one root. */
export const SESSION_FANOUT_MIN_HOPS = 16;
export const SESSION_FANOUT_MIN_UNIQUE_ENDPOINTS = 8;
/** 2 covers recordings through a single dashboard proxy host plus one upstream. */
export const SESSION_FANOUT_MIN_UNIQUE_HOSTS = 2;
/** Nested service hops are depth 2+ (A → B → C). Depth 0–1 is a session fan-out. */
export const SESSION_FANOUT_MAX_NESTING = 1;
/** Linked-list of hops (each parent of the next) is not a service topology. */
export const DAISY_CHAIN_MIN_HOPS = 16;

const UUID_IN_PATH =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_PATH_SEGMENT = /\/\d+(?=\/|$)/g;

function parseUrlParts(url: string | null | undefined): { host: string; path: string } {
  const raw = url?.trim() ?? '';
  if (!raw) {
    return { host: '', path: '' };
  }
  try {
    const parsed = new URL(raw);
    return { host: parsed.host, path: parsed.pathname || '/' };
  } catch {
    const withoutQuery = raw.split('?')[0] ?? raw;
    return { host: '', path: withoutQuery };
  }
}

function normalizePathForFingerprint(path: string): string {
  return path.replace(UUID_IN_PATH, ':id').replace(NUMERIC_PATH_SEGMENT, '/:id');
}

/** Method + normalized path so repeated bookings/tokens collapse as one unique hop. */
export function hopEndpointFingerprint(
  method: string | null | undefined,
  url: string | null | undefined
): string {
  const verb = (method ?? 'GET').toUpperCase();
  const { path } = parseUrlParts(url);
  return `${verb} ${normalizePathForFingerprint(path || '/')}`;
}

export function hopHostKey(url: string | null | undefined): string {
  const { host, path } = parseUrlParts(url);
  if (host) {
    return host.toLowerCase();
  }
  return path;
}

export function describeHopChainShape(hops: HopChainLink[]): HopChainShape {
  const uniqueEndpoints = new Set<string>();
  const uniqueHosts = new Set<string>();
  const byId = new Map<string, HopChainLink>();

  for (const hop of hops) {
    uniqueEndpoints.add(hopEndpointFingerprint(hop.method, hop.url));
    const host = hopHostKey(hop.url);
    if (host) {
      uniqueHosts.add(host);
    }
    byId.set(hop.id, hop);
  }

  let maxDepth = 0;
  for (const hop of hops) {
    let depth = 0;
    let current: HopChainLink | undefined = hop;
    const seen = new Set<string>();
    while (current?.parentId) {
      if (seen.has(current.id)) {
        break;
      }
      seen.add(current.id);
      const parent = byId.get(current.parentId);
      if (!parent) {
        break;
      }
      depth += 1;
      current = parent;
    }
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }

  return {
    hopCount: hops.length,
    uniqueEndpoints: uniqueEndpoints.size,
    uniqueHosts: uniqueHosts.size,
    maxDepth,
  };
}

/** Many sibling APIs under one root — a client session, not a nested call chain. */
export function isShallowClientSessionFanout(shape: HopChainShape): boolean {
  if (shape.hopCount < SESSION_FANOUT_MIN_HOPS) {
    return false;
  }
  if (shape.uniqueEndpoints < SESSION_FANOUT_MIN_UNIQUE_ENDPOINTS) {
    return false;
  }
  if (shape.maxDepth > SESSION_FANOUT_MAX_NESTING) {
    return false;
  }
  if (shape.uniqueHosts < SESSION_FANOUT_MIN_UNIQUE_HOSTS) {
    return false;
  }
  return true;
}

/** Sequential parent links with no fan-out — stale hop ids, not a service topology. */
export function isDegenerateHopDaisyChain(shape: HopChainShape): boolean {
  return shape.hopCount >= DAISY_CHAIN_MIN_HOPS && shape.maxDepth >= shape.hopCount - 1;
}

/** True when this set of hops should not be presented as one user-request service chain. */
export function isNonsensicalServiceChain(shape: HopChainShape): boolean {
  return isShallowClientSessionFanout(shape) || isDegenerateHopDaisyChain(shape);
}
