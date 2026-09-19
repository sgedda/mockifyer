import { randomEventId } from './crypto-digest';

/**
 * Process-local owners of hop ids.
 *
 * Downstream services that copy inbound `X-Mockifyer-Request-Id` without minting a
 * new id reuse the caller's id. The dashboard proxy (and in-process Mockifyer)
 * uses this registry so that reused id becomes the **parent**, not this hop.
 */

export interface HopOwnerRecord {
  requestId: string;
  method: string;
  url: string;
}

export interface RecordedHopIdentity {
  requestId: string;
  parentRequestId?: string;
}

export interface ResolveRecordedHopIdentityInput {
  inboundRequestId?: string | null;
  inboundParentRequestId?: string | null;
  method: string;
  url: string;
  storedRequestId?: string | null;
}

const HOP_OWNER_REGISTRY = Symbol.for('@sgedda/mockifyer-core.hopOwnerRegistry');
const MAX_HOP_OWNERS = 10_000;

type HopOwnerRegistry = Map<string, HopOwnerRecord>;

function getHopOwnerRegistry(): HopOwnerRegistry {
  const globalStore = globalThis as typeof globalThis & {
    [HOP_OWNER_REGISTRY]?: HopOwnerRegistry;
  };
  if (!globalStore[HOP_OWNER_REGISTRY]) {
    globalStore[HOP_OWNER_REGISTRY] = new Map();
  }
  return globalStore[HOP_OWNER_REGISTRY];
}

function trimId(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hopPathname(url: string): string {
  const raw = url.trim();
  if (!raw) return '';
  try {
    return new URL(raw).pathname || '/';
  } catch {
    const path = raw.split('?')[0] ?? raw;
    return path.startsWith('/') ? path : `/${path}`;
  }
}

/** Method + pathname so relative and absolute forms of the same hop still match. */
export function hopOwnerEndpointKey(method: string, url: string): string {
  const verb = (method || 'GET').toUpperCase();
  return `${verb} ${hopPathname(url)}`;
}

export function sameHopOwnerEndpoint(
  a: Pick<HopOwnerRecord, 'method' | 'url'>,
  b: Pick<HopOwnerRecord, 'method' | 'url'>
): boolean {
  if (!a.url?.trim() || !b.url?.trim()) {
    return false;
  }
  return hopOwnerEndpointKey(a.method, a.url) === hopOwnerEndpointKey(b.method, b.url);
}

export function findHopOwner(requestId: string | null | undefined): HopOwnerRecord | undefined {
  const id = trimId(requestId);
  if (!id) return undefined;
  return getHopOwnerRegistry().get(id);
}

/** Remember which endpoint minted or is serving this hop id. */
export function registerHopOwner(record: HopOwnerRecord): void {
  const requestId = trimId(record.requestId);
  if (!requestId) return;
  const registry = getHopOwnerRegistry();
  if (registry.has(requestId)) {
    registry.delete(requestId);
  }
  registry.set(requestId, {
    requestId,
    method: record.method || 'GET',
    url: record.url?.trim() ?? '',
  });
  while (registry.size > MAX_HOP_OWNERS) {
    const oldest = registry.keys().next().value;
    if (oldest == null) break;
    registry.delete(oldest);
  }
}

/** Test helper — hop-id ownership is process-global. */
export function resetHopOwnerRegistry(): void {
  getHopOwnerRegistry().clear();
}

/**
 * True when `inboundRequestId` already identifies a **different** endpoint's hop
 * (caller forwarded its own id instead of minting a child id).
 */
export function inboundHopIdBelongsToOtherEndpoint(
  inboundRequestId: string | null | undefined,
  method: string,
  url: string
): boolean {
  const owner = findHopOwner(inboundRequestId);
  if (!owner?.url?.trim()) {
    return false;
  }
  return !sameHopOwnerEndpoint(owner, { method, url });
}

/**
 * Exact hop identity for a recorded/proxied request.
 *
 * - Caller already minted this hop (inbound id is new or owned by this endpoint): keep it.
 * - Caller forwarded their hop id (owned by another endpoint): that id is the parent;
 *   this hop gets the stored id or a new one.
 */
export function resolveRecordedHopIdentity(
  input: ResolveRecordedHopIdentityInput
): RecordedHopIdentity {
  const inboundId = trimId(input.inboundRequestId);
  const inboundParent = trimId(input.inboundParentRequestId);
  const storedId = trimId(input.storedRequestId);
  const reusedCallerId = inboundHopIdBelongsToOtherEndpoint(inboundId, input.method, input.url);

  if (reusedCallerId && inboundId) {
    return {
      requestId: storedId ?? randomEventId(),
      parentRequestId: inboundId,
    };
  }

  const requestId = storedId ?? inboundId ?? randomEventId();
  return inboundParent ? { requestId, parentRequestId: inboundParent } : { requestId };
}
