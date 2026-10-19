import {
  applyOutboundRequestCorrelation,
  attachActiveInboundRequestBody,
  buildInboundParentStubMock,
  ensureLocalInboundParentStubSaved,
  getActiveInboundRequest,
  inboundParentStubFilename,
  inboundParentStubHash,
  inboundParentStubRequestKey,
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  prepareLocalInboundParentStub,
  readOutboundParentHopFromConfig,
  resolveInboundHopContext,
  runWithMockifyerHopContext,
} from '@sgedda/mockifyer-core';

describe('inbound parent recording', () => {
  it('builds stub helpers (hash stable per parent id)', () => {
    const a = inboundParentStubHash('parent-a');
    const b = inboundParentStubHash('parent-a');
    const c = inboundParentStubHash('parent-b');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(inboundParentStubRequestKey('parent-a')).toContain('parent-a');
    expect(inboundParentStubFilename('parent-a')).toBe(`inbound-parent_${a}.json`);
  });

  it('stub builder uses synthetic URL and display hop for Hops', () => {
    const stub = buildInboundParentStubMock('gql-als-1', {
      method: 'post',
      url: 'http://localhost:4000/graphql',
    });
    expect(stub.requestId).toBe('gql-als-1');
    expect(stub.inboundParentStub).toBe(true);
    expect(stub.request.url).toBe('mockifyer://inbound-parent/gql-als-1');
    expect(stub.inboundParentDisplay).toEqual({
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
  });

  it('prepareLocalInboundParentStub returns stable filename and mock', () => {
    const row = prepareLocalInboundParentStub('parent-fs-1', {
      method: 'POST',
      url: 'http://127.0.0.1:4200/graphql',
    });
    expect(row).not.toBeNull();
    expect(row!.filename).toBe(inboundParentStubFilename('parent-fs-1'));
    expect(row!.mock.requestId).toBe('parent-fs-1');
    expect(row!.mock.inboundParentStub).toBe(true);
  });

  it('ensureLocalInboundParentStubSaved persists once and skips when parentExists', async () => {
    const saved: string[] = [];
    const hop = { method: 'GET', url: 'http://127.0.0.1:4200/api/cms/navigation' };
    const first = await ensureLocalInboundParentStubSaved({
      parentRequestId: 'als-root-1',
      hop,
      save: (row) => {
        saved.push(row.filename);
      },
    });
    expect(first).toBe(true);
    expect(saved).toHaveLength(1);

    const second = await ensureLocalInboundParentStubSaved({
      parentRequestId: 'als-root-1',
      hop,
      parentExists: () => true,
      save: (row) => {
        saved.push(row.filename);
      },
    });
    expect(second).toBe(true);
    expect(saved).toHaveLength(1);
  });

  it('readOutboundParentHopFromConfig reads stashed parent hop', () => {
    expect(
      readOutboundParentHopFromConfig({
        __mockifyer_parentHop: { method: 'post', url: 'http://gw/graphql' },
      })
    ).toEqual({ method: 'POST', url: 'http://gw/graphql' });
    expect(readOutboundParentHopFromConfig({})).toBeUndefined();
  });

  it('attaches inbound body onto ALS for outbound parentHop stash', () => {
    const resolved = resolveInboundHopContext(
      { 'x-mockifyer-request-id': 'inbound-1' },
      { method: 'POST', url: 'http://localhost:4000/graphql' }
    );
    expect(resolved?.traceId).toBe('inbound-1');
    runWithMockifyerHopContext(resolved!.ctx, () => {
      attachActiveInboundRequestBody({
        query: 'query myAccount { id }',
        variables: {},
      });
      expect(getActiveInboundRequest()).toEqual({
        method: 'POST',
        url: 'http://localhost:4000/graphql',
        data: { query: 'query myAccount { id }', variables: {} },
      });

      const config: {
        headers: Record<string, string>;
        url: string;
        method: string;
        __mockifyer_parentHop?: { method: string; url: string; data?: unknown };
      } = {
        headers: {},
        url: 'http://tokenws.example/TokenService.asmx',
        method: 'POST',
      };
      applyOutboundRequestCorrelation(config);
      expect(config.__mockifyer_parentHop).toEqual({
        method: 'POST',
        url: 'http://localhost:4000/graphql',
        data: { query: 'query myAccount { id }', variables: {} },
      });
      expect(config.headers[MOCKIFYER_PARENT_REQUEST_ID_HEADER]).toBe('inbound-1');
    });
  });

  it('lazily reads body from stashed inboundHttpRequest', () => {
    const resolved = resolveInboundHopContext(
      {},
      { method: 'POST', url: 'http://localhost:4000/graphql' }
    );
    const fakeReq = { body: { query: 'query X { y }' } };
    resolved!.ctx.inboundHttpRequest = fakeReq;
    runWithMockifyerHopContext(resolved!.ctx, () => {
      expect(getActiveInboundRequest()?.data).toEqual({ query: 'query X { y }' });
    });
  });
});
