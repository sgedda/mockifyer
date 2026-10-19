import type { MockData } from '../types';
import { sha256Hex } from './crypto-digest';
import { buildRequestOnlyMockData } from './request-only-mock';

export interface InboundParentHop {
  method: string;
  url: string;
}

/** Stable Redis/disk key so inbound parent stubs never collide with real hop hashes. */
export function inboundParentStubRequestKey(parentRequestId: string): string {
  return `MOCKIFYER_INBOUND_PARENT:${parentRequestId.trim()}`;
}

export function inboundParentStubHash(parentRequestId: string): string {
  return sha256Hex(inboundParentStubRequestKey(parentRequestId));
}

/** Synthetic catalog URL — must not collide with real GraphQL/HTTP request keys. */
export function inboundParentStubUrl(parentRequestId: string): string {
  return `mockifyer://inbound-parent/${parentRequestId.trim()}`;
}

/** Stable filesystem filename for a local inbound-parent stub (one file per parent id). */
export function inboundParentStubFilename(parentRequestId: string): string {
  return `inbound-parent_${inboundParentStubHash(parentRequestId)}.json`;
}

export function isInboundParentStubMock(mock: {
  inboundParentStub?: boolean;
  request?: { url?: string };
  requestId?: string;
  /** Redis/disk storage hash when known (filename without extension). */
  storageHash?: string | null;
}): boolean {
  if (mock.inboundParentStub === true) return true;
  const url = mock.request?.url?.trim() ?? '';
  if (url.startsWith('mockifyer://inbound-parent/')) return true;
  const requestId = mock.requestId?.trim();
  const storageHash = mock.storageHash?.trim();
  if (requestId && storageHash && storageHash === inboundParentStubHash(requestId)) {
    return true;
  }
  return false;
}

/**
 * Request-only catalog row for an ALS inbound hop that downstream children already
 * reference as `parentRequestId` but that was never recorded through `/api/proxy`
 * (direct GraphQL hit, header gap, concurrent race, etc.).
 *
 * Always uses a synthetic URL so stubs never share a request key with a real
 * GraphQL/HTTP recording (which previously created duplicate hop roots).
 */
export function buildInboundParentStubMock(
  parentRequestId: string,
  hop: InboundParentHop
): MockData {
  const parentId = parentRequestId.trim();
  const displayMethod = hop.method?.trim() ? hop.method.trim().toUpperCase() : 'POST';
  const displayUrl = hop.url?.trim() || inboundParentStubUrl(parentId);
  const mock = buildRequestOnlyMockData(
    {
      method: displayMethod,
      url: inboundParentStubUrl(parentId),
      headers: {},
      data: null,
      queryParams: {},
    },
    { alwaysUseRealApi: true }
  );
  mock.requestId = parentId;
  mock.inboundParentStub = true;
  mock.inboundParentDisplay = { method: displayMethod, url: displayUrl };
  return mock;
}

/**
 * Read the inbound parent hop stashed on an outbound request config
 * (`__mockifyer_parentHop` from {@link applyOutboundRequestCorrelation}).
 */
export function readOutboundParentHopFromConfig(config: unknown): InboundParentHop | undefined {
  if (!config || typeof config !== 'object') {
    return undefined;
  }
  const stashed = (config as { __mockifyer_parentHop?: { method?: string; url?: string } })
    .__mockifyer_parentHop;
  const url = stashed?.url?.trim();
  if (!url) {
    return undefined;
  }
  return {
    method: stashed?.method?.trim() ? stashed.method.trim().toUpperCase() : 'GET',
    url,
  };
}

export interface LocalInboundParentStubRow {
  hash: string;
  filename: string;
  mock: MockData;
}

/**
 * Build a catalog stub for a child hop's missing inbound parent (filesystem / hybrid).
 * Uses a synthetic URL so multi-writer scenarios never overwrite a real hop key.
 * Returns null when there is no parent id.
 */
export function prepareLocalInboundParentStub(
  parentRequestId: string | null | undefined,
  hop?: InboundParentHop | null
): LocalInboundParentStubRow | null {
  const parentId = typeof parentRequestId === 'string' ? parentRequestId.trim() : '';
  if (!parentId) {
    return null;
  }
  const resolvedHop: InboundParentHop = {
    method: hop?.method?.trim() ? hop.method.trim().toUpperCase() : 'GET',
    url: hop?.url?.trim() || inboundParentStubUrl(parentId),
  };
  return {
    hash: inboundParentStubHash(parentId),
    filename: inboundParentStubFilename(parentId),
    mock: buildInboundParentStubMock(parentId, resolvedHop),
  };
}

/**
 * Persist a local inbound-parent stub when a child hop is recorded.
 * Callers supply `save` (filesystem / provider); optional `parentExists` skips duplicates.
 */
export async function ensureLocalInboundParentStubSaved(options: {
  parentRequestId?: string | null;
  hop?: InboundParentHop | null;
  parentExists?: (parentRequestId: string) => boolean | Promise<boolean>;
  save: (row: LocalInboundParentStubRow) => void | Promise<void>;
}): Promise<boolean> {
  const row = prepareLocalInboundParentStub(options.parentRequestId, options.hop);
  if (!row) {
    return false;
  }
  const parentId = row.mock.requestId?.trim() ?? '';
  if (parentId && options.parentExists && (await options.parentExists(parentId))) {
    return true;
  }
  await options.save(row);
  return true;
}
