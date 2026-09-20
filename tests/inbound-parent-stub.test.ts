import {
  applyOutboundRequestCorrelation,
  attachActiveInboundRequestBody,
  buildInboundParentStubMock,
  createMockifyerInboundBodyCaptureMiddleware,
  getActiveInboundRequest,
  inboundParentStubHash,
  inboundParentStubRequestKey,
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  resolveInboundHopContext,
  runWithMockifyerHopContext,
} from '@sgedda/mockifyer-core';

describe('inbound parent recording', () => {
  it('builds legacy stub helpers (hash stable per parent id)', () => {
    const a = inboundParentStubHash('parent-a');
    const b = inboundParentStubHash('parent-a');
    const c = inboundParentStubHash('parent-b');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(inboundParentStubRequestKey('parent-a')).toContain('parent-a');
  });

  it('legacy stub builder still uses synthetic URL (deprecated path)', () => {
    const stub = buildInboundParentStubMock('gql-als-1', {
      method: 'post',
      url: 'http://localhost:4000/graphql',
    });
    expect(stub.requestId).toBe('gql-als-1');
    expect(stub.inboundParentStub).toBe(true);
    expect(stub.request.url).toBe('mockifyer://inbound-parent/gql-als-1');
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

  it('body-capture middleware copies req.body onto ALS', () => {
    const mw = createMockifyerInboundBodyCaptureMiddleware();
    const resolved = resolveInboundHopContext(
      {},
      { method: 'POST', url: 'http://localhost:4000/graphql' }
    );
    runWithMockifyerHopContext(resolved!.ctx, () => {
      let called = false;
      mw({ body: { query: '{ x }' } }, {}, () => {
        called = true;
      });
      expect(called).toBe(true);
      expect(getActiveInboundRequest()?.data).toEqual({ query: '{ x }' });
    });
  });
});
