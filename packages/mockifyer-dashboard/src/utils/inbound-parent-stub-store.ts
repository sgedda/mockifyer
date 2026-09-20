import {
  buildInboundParentStubMock,
  inboundParentStubHash,
  type MockData,
} from '@sgedda/mockifyer-core';

export interface InboundParentStubStore {
  getByHashInScenario(hash: string, scenarioName: string): Promise<MockData | null | undefined>;
  setByHashInScenario(
    hash: string,
    mockData: MockData,
    scenarioName: string,
    options?: { enforceWriteLimits?: boolean }
  ): Promise<boolean>;
  deleteByHash(hash: string, scenario?: string, clientId?: string): Promise<void>;
}

/**
 * Upsert a request-only placeholder when children reference a parentRequestId that is
 * not (yet) in the catalog. Do **not** skip based on the in-process hop-owner registry:
 * GraphQL ALS registers the inbound id before any mock row exists, and skipping there
 * is exactly what leaves "Missing entry" chains after record.
 */
export async function ensureInboundParentStubInStore(
  store: InboundParentStubStore,
  scenarioName: string,
  parentRequestId: string | undefined | null,
  parentHop: { method: string; url: string } | undefined,
  debugProxy = false
): Promise<void> {
  const parentId = typeof parentRequestId === 'string' ? parentRequestId.trim() : '';
  if (!parentId) {
    return;
  }
  const hop = parentHop?.url?.trim()
    ? {
        method: parentHop.method?.trim() ? parentHop.method.trim().toUpperCase() : 'GET',
        url: parentHop.url.trim(),
      }
    : {
        method: 'POST',
        url: `mockifyer://inbound-parent/${parentId}`,
      };
  const stubHash = inboundParentStubHash(parentId);
  try {
    const existing = await store.getByHashInScenario(stubHash, scenarioName);
    if (
      existing?.requestId?.trim() === parentId &&
      existing?.inboundParentStub === true &&
      (existing.request?.url ?? '').startsWith('mockifyer://inbound-parent/')
    ) {
      return;
    }
    const stub = buildInboundParentStubMock(parentId, hop);
    const wrote = await store.setByHashInScenario(stubHash, stub, scenarioName, {
      enforceWriteLimits: false,
    });
    if (debugProxy) {
      console.log(
        `[InboundParentStub] ${wrote ? 'upserted' : 'skipped'} stub for ${parentId.slice(0, 8)}… (${hop.method} ${hop.url})`
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[InboundParentStub] upsert failed:', message);
  }
}

/** Drop the placeholder when a real hop is recorded under the same requestId. */
export async function removeInboundParentStubIfPresent(
  store: InboundParentStubStore,
  scenarioName: string,
  requestId: string | undefined | null,
  debugProxy = false
): Promise<void> {
  const id = typeof requestId === 'string' ? requestId.trim() : '';
  if (!id) return;
  const stubHash = inboundParentStubHash(id);
  try {
    const existing = await store.getByHashInScenario(stubHash, scenarioName);
    if (!existing) return;
    await store.deleteByHash(stubHash, scenarioName);
    if (debugProxy) {
      console.log(
        `[InboundParentStub] removed stub after real hop recorded (requestId=${id.slice(0, 8)}…)`
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[InboundParentStub] removal failed:', message);
  }
}

/**
 * For every parentRequestId in the catalog that has no matching requestId row,
 * upsert an inbound parent stub (heals races and pre-fix recordings).
 */
export async function healMissingInboundParentStubs(
  store: InboundParentStubStore,
  scenarioName: string,
  catalogRows: ReadonlyArray<{ requestId?: string | null; parentRequestId?: string | null }>
): Promise<number> {
  const known = new Set<string>();
  for (const row of catalogRows) {
    const id = row.requestId?.trim();
    if (id) known.add(id);
  }
  const missing = new Set<string>();
  for (const row of catalogRows) {
    const parentId = row.parentRequestId?.trim();
    if (parentId && !known.has(parentId)) {
      missing.add(parentId);
    }
  }
  let healed = 0;
  for (const parentId of missing) {
    await ensureInboundParentStubInStore(store, scenarioName, parentId, undefined, false);
    healed += 1;
  }
  return healed;
}
