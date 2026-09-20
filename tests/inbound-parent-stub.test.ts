import {
  buildInboundParentStubMock,
  inboundParentStubHash,
  inboundParentStubRequestKey,
  resolveInboundHopContext,
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

  it('creates a request-only stub with the inbound method/url and parent requestId', () => {
    const stub = buildInboundParentStubMock('gql-als-1', {
      method: 'post',
      url: 'http://localhost:4000/graphql',
    });
    expect(stub.requestId).toBe('gql-als-1');
    expect(stub.responsePending).toBe(true);
    expect(stub.alwaysUseRealApi).toBe(true);
    expect(stub.request.method).toBe('POST');
    expect(stub.request.url).toBe('http://localhost:4000/graphql');
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
});
