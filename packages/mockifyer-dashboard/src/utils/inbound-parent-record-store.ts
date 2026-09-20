import {
  buildRequestOnlyMockData,
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
  const hash = sha256Hex(generateRequestKey(request));
  try {
    const existing = await store.getByHashInScenario(hash, scenarioName);
    const existingId = existing?.requestId?.trim();
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
