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

/**
 * Request-only catalog row for an ALS inbound hop that downstream children already
 * reference as `parentRequestId` but that was never recorded through `/api/proxy`
 * (direct GraphQL hit, header gap, concurrent race, etc.).
 */
export function buildInboundParentStubMock(
  parentRequestId: string,
  hop: InboundParentHop
): MockData {
  const method = hop.method?.trim() ? hop.method.trim().toUpperCase() : 'GET';
  const url = hop.url?.trim() || `mockifyer://inbound-parent/${parentRequestId}`;
  const mock = buildRequestOnlyMockData(
    {
      method,
      url,
      headers: {},
      data: null,
      queryParams: {},
    },
    { alwaysUseRealApi: true }
  );
  mock.requestId = parentRequestId.trim();
  return mock;
}
