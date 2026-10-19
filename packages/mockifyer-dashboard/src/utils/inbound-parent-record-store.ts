import {
  buildRequestOnlyMockData,
  findHopOwner,
  generateRequestKey,
  type MockData,
  type StoredRequest,
} from '@sgedda/mockifyer-core';
import * as crypto from 'crypto';

export interface InboundParentHopPayload {
  method: string;
  url: string;
  /** Parsed inbound body (required for GraphQL request-key stability). */
  data?: unknown;
}

export interface InboundParentRecordStore {
  getByHashInScenario(hash: string, scenarioName: string): Promise<MockData | null | undefined>;
  setByHashInScenario(
    hash: string,
    mockData: MockData,
    scenarioName: string,
    options?: { enforceWriteLimits?: boolean }
  ): Promise<boolean>;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

const HTTP_SCHEME_PREFIX = /^http:\/\//i;
const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

/**
 * Lookup order for an inbound parent URL. A service behind TLS termination sees
 * `http://` for a hop its caller proxied as `https://`; prefer that recorded https row.
 */
function inboundParentLookupUrls(url: string): string[] {
  if (!HTTP_SCHEME_PREFIX.test(url)) {
    return [url];
  }
  return [url.replace(HTTP_SCHEME_PREFIX, 'https://'), url];
}

/** Catalog request for the parent hop, plus the URLs its recorded row may be keyed under. */
interface ParentRecordTarget {
  request: StoredRequest;
  lookupUrls: string[];
}

/**
 * Prefer the URL this process sent the parent hop to (hop-owner registry): that is the
 * key its catalog row is written under. The downstream service's own inbound URL
 * (http behind TLS termination, gateway rewrites) is only a fallback.
 */
function resolveParentRecordTarget(
  parentId: string,
  parentHop: InboundParentHopPayload | undefined
): ParentRecordTarget | undefined {
  const owner = findHopOwner(parentId);
  const ownerUrl = owner?.url?.trim();
  const ownedUrl = ownerUrl && ABSOLUTE_HTTP_URL.test(ownerUrl) ? ownerUrl : undefined;
  const url = ownedUrl ?? parentHop?.url?.trim();
  if (!url || url.startsWith('mockifyer://')) {
    return undefined;
  }
  const rawMethod = ownedUrl ? owner?.method : parentHop?.method;
  const data = parentHop?.data;
  return {
    request: {
      method: rawMethod?.trim() ? rawMethod.trim().toUpperCase() : 'GET',
      url,
      headers: {},
      data: data === undefined ? null : data,
      queryParams: {},
    },
    lookupUrls: ownedUrl ? [ownedUrl] : inboundParentLookupUrls(url),
  };
}

interface RecordedParentLookup {
  /** `requestId` of the first recorded row for the parent request. */
  requestId?: string;
  /** Captured row without a `requestId` (older recordings) — stamp it, never overwrite it. */
  unlinked?: { hash: string; mock: MockData };
}

async function findRecordedParent(
  store: InboundParentRecordStore,
  scenarioName: string,
  target: ParentRecordTarget
): Promise<RecordedParentLookup> {
  const { request, lookupUrls } = target;
  let unlinked: RecordedParentLookup['unlinked'];
  for (const url of lookupUrls) {
    const hash = sha256Hex(generateRequestKey({ ...request, url }));
    const existing = await store.getByHashInScenario(hash, scenarioName);
    if (!existing) continue;
    const requestId = existing.requestId?.trim();
    if (requestId) {
      return { requestId };
    }
    if (!unlinked && existing.response && !existing.responsePending) {
      unlinked = { hash, mock: existing };
    }
  }
  return { unlinked };
}

function looksLikeGraphqlUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.includes('graphql');
  } catch {
    return url.toLowerCase().includes('graphql');
  }
}

/**
 * Ensure children link to the real inbound hop.
 *
 * - Key the parent by the URL this dashboard proxied it to when known (see
 *   {@link resolveParentRecordTarget}); otherwise by the downstream service's inbound URL.
 * - If a catalog row already exists for that request, return its `requestId`
 *   (heal ALS orphans onto the recorded id — the live id may predate a scenario clear).
 *   A captured row without a `requestId` gets the ALS id stamped on instead of being replaced.
 * - Otherwise upsert a request-only row under the ALS `parentRequestId`, keyed like the
 *   parent's own recording so the proxy overwrites it instead of adding a duplicate.
 * - GraphQL without a body is skipped (empty-body keys collide across operations).
 *
 * @returns effective parent request id to stamp on the child, or the input id when unchanged/skipped.
 */
export async function resolveInboundParentRequestIdForChild(
  store: InboundParentRecordStore,
  scenarioName: string,
  parentRequestId: string | undefined | null,
  parentHop: InboundParentHopPayload | undefined,
  debugProxy = false
): Promise<string | undefined> {
  const parentId = typeof parentRequestId === 'string' ? parentRequestId.trim() : '';
  if (!parentId) {
    return undefined;
  }
  const target = resolveParentRecordTarget(parentId, parentHop);
  if (!target) {
    return parentId;
  }
  const { request } = target;
  const { method, url } = request;
  if (looksLikeGraphqlUrl(url) && request.data === null) {
    if (debugProxy) {
      console.log(
        `[InboundParentRecord] skip GraphQL parent without body (requestId=${parentId.slice(0, 8)}…)`
      );
    }
    return parentId;
  }

  try {
    const recorded = await findRecordedParent(store, scenarioName, target);
    if (recorded.requestId) {
      if (debugProxy && recorded.requestId !== parentId) {
        console.log(
          `[InboundParentRecord] heal child parent ${parentId.slice(0, 8)}… → recorded ${recorded.requestId.slice(0, 8)}… (${method} ${url})`
        );
      }
      return recorded.requestId;
    }

    if (recorded.unlinked) {
      await store.setByHashInScenario(
        recorded.unlinked.hash,
        { ...recorded.unlinked.mock, requestId: parentId },
        scenarioName,
        { enforceWriteLimits: false }
      );
      if (debugProxy) {
        console.log(
          `[InboundParentRecord] stamped requestId onto complete recording (${method} ${url})`
        );
      }
      return parentId;
    }

    const mock: MockData = {
      ...buildRequestOnlyMockData(request, { alwaysUseRealApi: true }),
      requestId: parentId,
    };
    delete mock.inboundParentStub;
    delete mock.inboundParentDisplay;
    // Use the first lookup URL (prefer https) so the placeholder key matches the recording
    const placeholderUrl = target.lookupUrls[0];
    const hash = sha256Hex(generateRequestKey({ ...request, url: placeholderUrl }));
    const wrote = await store.setByHashInScenario(hash, mock, scenarioName, {
      enforceWriteLimits: false,
    });
    if (debugProxy) {
      console.log(
        `[InboundParentRecord] ${wrote ? 'upserted' : 'skipped'} ${method} ${url} (requestId=${parentId.slice(0, 8)}…)`
      );
    }
    return parentId;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[InboundParentRecord] upsert failed:', message);
    return parentId;
  }
}

/** @deprecated Use {@link resolveInboundParentRequestIdForChild}. */
export async function ensureInboundParentRecordInStore(
  store: InboundParentRecordStore,
  scenarioName: string,
  parentRequestId: string | undefined | null,
  parentHop: InboundParentHopPayload | undefined,
  debugProxy = false
): Promise<void> {
  await resolveInboundParentRequestIdForChild(
    store,
    scenarioName,
    parentRequestId,
    parentHop,
    debugProxy
  );
}
