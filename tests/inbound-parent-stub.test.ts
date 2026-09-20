import {
  applyOutboundRequestCorrelation,
  buildInboundParentStubMock,
  inboundParentStubHash,
  inboundParentStubRequestKey,
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  resolveInboundHopContext,
  runWithMockifyerHopContext,
} from '@sgedda/mockifyer-core';

describe('inbound parent stub', () => {
  it('builds a stable hash per parent request id', () => {
    const a = inboundParentStubHash('parent-a');
    const b = inboundParentStubHash('parent-a');
    const c = inboundParentStubHash('parent-b');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(inboundParentStubRequestKey('parent-a')).toContain('parent-a');
  });

  it('creates a request-only stub with synthetic URL and display metadata', () => {
    const stub = buildInboundParentStubMock('gql-als-1', {
      method: 'post',
      url: 'http://localhost:4000/graphql',
    });
    expect(stub.requestId).toBe('gql-als-1');
    expect(stub.responsePending).toBe(true);
    expect(stub.alwaysUseRealApi).toBe(true);
    expect(stub.inboundParentStub).toBe(true);
    expect(stub.request.method).toBe('POST');
    expect(stub.request.url).toBe('mockifyer://inbound-parent/gql-als-1');
    expect(stub.inboundParentDisplay).toEqual({
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
  });

  it('stores inbound method/url on hop context for outbound parent stubs', () => {
    const resolved = resolveInboundHopContext(
      { 'x-mockifyer-request-id': 'inbound-1' },
      { method: 'POST', url: 'http://localhost:4000/graphql' }
    );
    expect(resolved?.traceId).toBe('inbound-1');
    expect(resolved?.ctx.inboundRequest).toEqual({
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
  });

  it('stashes inbound parentHop on the outbound config for later proxy stub upsert', () => {
    const config: {
      headers: Record<string, string>;
      url: string;
      method: string;
      __mockifyer_parentHop?: { method: string; url: string };
    } = {
      headers: {},
      url: 'http://tokenws.example/TokenService.asmx',
      method: 'POST',
    };
    runWithMockifyerHopContext(
      {
        correlation: { requestId: 'gql-als' },
        inboundRequest: { method: 'POST', url: 'http://localhost:4000/graphql' },
      },
      () => {
        applyOutboundRequestCorrelation(config);
      }
    );
    expect(config.__mockifyer_parentHop).toEqual({
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
    expect(config.headers[MOCKIFYER_PARENT_REQUEST_ID_HEADER]).toBe('gql-als');
  });
});
