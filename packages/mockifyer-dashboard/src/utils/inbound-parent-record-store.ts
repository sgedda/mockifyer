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
 * Persist the real inbound hop (method/url/body) under `parentRequestId` so children
 * link to the actual GraphQL/HTTP entry — not a synthetic `mockifyer://inbound-parent/…` stub.
 *
 * GraphQL without a body is skipped (empty-body keys collide across operations).
 */
export async function ensureInboundParentRecordInStore(
  store: InboundParentRecordStore,
  scenarioName: string,
  parentRequestId: string | undefined | null,
  parentHop: InboundParentHopPayload | undefined,
  debugProxy = false
): Promise<void> {
  const parentId = typeof parentRequestId === 'string' ? parentRequestId.trim() : '';
  if (!parentId) {
    return;
  }
  const url = parentHop?.url?.trim();
  if (!url || url.startsWith('mockifyer://')) {
    return;
  }
  const method = parentHop?.method?.trim() ? parentHop.method.trim().toUpperCase() : 'GET';
  const data = parentHop?.data;
  if (looksLikeGraphqlUrl(url) && (data === undefined || data === null)) {
    if (debugProxy) {
      console.log(
        `[InboundParentRecord] skip GraphQL parent without body (requestId=${parentId.slice(0, 8)}…)`
      );
    }
    return;
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
    if (existing?.requestId?.trim() === parentId) {
      return;
    }
    const mock: MockData = existing
      ? { ...existing, requestId: parentId }
      : {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[InboundParentRecord] upsert failed:', message);
  }
}
