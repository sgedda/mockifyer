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

async function findRecordedParentRequestId(
  store: InboundParentRecordStore,
  scenarioName: string,
  request: StoredRequest
): Promise<string | undefined> {
  for (const url of inboundParentLookupUrls(request.url)) {
    const hash = sha256Hex(generateRequestKey({ ...request, url }));
    const existing = await store.getByHashInScenario(hash, scenarioName);
    const existingId = existing?.requestId?.trim();
    if (existingId) {
      return existingId;
    }
  }
  return undefined;
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
 * - If this dashboard proxied the parent hop, keep its id. The inbound URL a downstream
 *   service sees (http behind TLS termination, gateway rewrites) rarely matches the
 *   proxied URL, so a URL-keyed lookup would detach children onto a duplicate row.
 * - If a catalog row already exists for this method/url/body, return its `requestId`
 *   (heal ALS orphans onto the recorded GraphQL id — do not steal that id).
 * - Otherwise upsert a request-only row under the ALS `parentRequestId`.
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
  if (findHopOwner(parentId)) {
    return parentId;
  }
  const url = parentHop?.url?.trim();
  if (!url || url.startsWith('mockifyer://')) {
    return parentId;
  }
  const method = parentHop?.method?.trim() ? parentHop.method.trim().toUpperCase() : 'GET';
  const data = parentHop?.data;
  if (looksLikeGraphqlUrl(url) && (data === undefined || data === null)) {
    if (debugProxy) {
      console.log(
        `[InboundParentRecord] skip GraphQL parent without body (requestId=${parentId.slice(0, 8)}…)`
      );
    }
    return parentId;
  }

  const request: StoredRequest = {
    method,
    url,
    headers: {},
    data: data === undefined ? null : data,
    queryParams: {},
  };
  try {
    const existingId = await findRecordedParentRequestId(store, scenarioName, request);
    if (existingId) {
      if (debugProxy && existingId !== parentId) {
        console.log(
          `[InboundParentRecord] heal child parent ${parentId.slice(0, 8)}… → recorded ${existingId.slice(0, 8)}… (${method} ${url})`
        );
      }
      return existingId;
    }

    const mock: MockData = {
      ...buildRequestOnlyMockData(request, { alwaysUseRealApi: true }),
      requestId: parentId,
    };
    delete mock.inboundParentStub;
    delete mock.inboundParentDisplay;
    const hash = sha256Hex(generateRequestKey(request));
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
