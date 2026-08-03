import {
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
  MOCKIFYER_TRACE_DATA_KEY,
  MOCKIFYER_TRACE_RESPONSE_KEY,
  buildInlineRequestTrace,
  createMockifyerCorrelationMiddleware,
  isIncludeInlineTraceRequested,
  recordInlineTraceHopFromExchange,
  runWithMockifyerHopContext,
  wrapBodyWithInlineTrace,
  type MockifyerHopContext,
} from '@sgedda/mockifyer-core';

describe('inline-trace', () => {
  it('detects include-trace from header or query', () => {
    expect(
      isIncludeInlineTraceRequested({
        headers: { [MOCKIFYER_INCLUDE_TRACE_HEADER]: 'true' },
      })
    ).toBe(true);
    expect(
      isIncludeInlineTraceRequested({
        url: '/api/x?trace-mockifyer=1',
      })
    ).toBe(true);
    expect(isIncludeInlineTraceRequested({ headers: {} })).toBe(false);
  });

  it('collects hops in ALS and wraps the body as data + mockifyerTrace', () => {
    const ctx: MockifyerHopContext = {
      correlation: { requestId: 'root-1' },
      includeInlineTrace: true,
      includeInlineTraceBodies: false,
      inlineHops: [],
    };

    runWithMockifyerHopContext(ctx, () => {
      recordInlineTraceHopFromExchange({
        method: 'GET',
        url: 'https://member.example/api/profile',
        status: 200,
        source: 'upstream',
        transport: 'axios',
        requestId: 'hop-1',
        parentRequestId: 'root-1',
        durationMs: 12,
        clientId: 'capi-graphql',
      });

      const trace = buildInlineRequestTrace();
      expect(trace).not.toBeNull();
      expect(trace!.requestId).toBe('root-1');
      expect(trace!.hopCount).toBe(1);
      expect(trace!.hops[0].url).toContain('/api/profile');
      expect(trace!.hops[0].parentRequestId).toBe('root-1');
      expect(trace!.hops[0].requestBodyPreview).toBeUndefined();

      const wrapped = wrapBodyWithInlineTrace({ ok: true });
      expect(wrapped).toEqual({
        [MOCKIFYER_TRACE_DATA_KEY]: { ok: true },
        [MOCKIFYER_TRACE_RESPONSE_KEY]: trace,
      });
    });
  });

  it('includes body previews when bodies opt-in is set', () => {
    const ctx: MockifyerHopContext = {
      correlation: { requestId: 'root-2' },
      includeInlineTrace: true,
      includeInlineTraceBodies: true,
      inlineHops: [],
    };

    runWithMockifyerHopContext(ctx, () => {
      recordInlineTraceHopFromExchange({
        method: 'POST',
        url: 'https://member.example/graphql',
        status: 200,
        source: 'mock-hit',
        transport: 'proxy',
        requestId: 'hop-2',
        parentRequestId: 'root-2',
        requestBody: { query: '{ me { id } }' },
        responseBody: { data: { me: { id: '1' } } },
      });
      const hop = buildInlineRequestTrace()!.hops[0];
      expect(hop.requestBodyPreview).toContain('me');
      expect(hop.responseBodyPreview).toContain('id');
    });
  });

  it('middleware wraps res.json when X-Mockifyer-Include-Trace is set', () => {
    const middleware = createMockifyerCorrelationMiddleware();
    const req = {
      header: (name: string) => {
        const n = name.toLowerCase();
        if (n === MOCKIFYER_INCLUDE_TRACE_HEADER) return '1';
        if (n === MOCKIFYER_REQUEST_ID_HEADER) return 'client-root';
        return undefined;
      },
    };
    const headers: Record<string, string> = {};
    let jsonBody: unknown;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      json: (body: unknown) => {
        jsonBody = body;
        return body;
      },
    };

    middleware(req, res, () => {
      recordInlineTraceHopFromExchange({
        method: 'GET',
        url: 'https://booking.example/api/x',
        status: 200,
        source: 'upstream',
        transport: 'fetch',
        requestId: 'hop-a',
        parentRequestId: 'client-root',
      });
      res.json!({ hello: 'world' });
    });

    expect(headers[MOCKIFYER_REQUEST_ID_HEADER]).toBe('client-root');
    expect(jsonBody).toMatchObject({
      data: { hello: 'world' },
      mockifyerTrace: {
        requestId: 'client-root',
        hopCount: 1,
        hops: [expect.objectContaining({ url: 'https://booking.example/api/x' })],
      },
    });
  });

  it('middleware does not wrap when include-trace is absent', () => {
    const middleware = createMockifyerCorrelationMiddleware();
    const req = {
      header: (name: string) =>
        name.toLowerCase() === MOCKIFYER_REQUEST_ID_HEADER ? 'only-id' : undefined,
    };
    let jsonBody: unknown;
    const res = {
      setHeader: () => undefined,
      json: (body: unknown) => {
        jsonBody = body;
        return body;
      },
    };

    middleware(req, res, () => {
      res.json!({ hello: 'world' });
    });

    expect(jsonBody).toEqual({ hello: 'world' });
  });

  it('supports bodies header without affecting wrap shape', () => {
    expect(
      isIncludeInlineTraceRequested({
        headers: {
          [MOCKIFYER_INCLUDE_TRACE_HEADER]: 'yes',
          [MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER]: '1',
        },
      })
    ).toBe(true);
  });
});
