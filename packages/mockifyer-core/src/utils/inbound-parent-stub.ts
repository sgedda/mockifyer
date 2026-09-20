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
