import {
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
  MOCKIFYER_TRACE_DATA_KEY,
  MOCKIFYER_TRACE_RESPONSE_KEY,
  buildInlineRequestTrace,
  createMockifyerCorrelationMiddleware,
  installInlineTraceBodyWrapper,
  isIncludeInlineTraceRequested,
  recordInlineTraceHopFromExchange,
  resolveInboundHopContext,
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

  it('wraps Apollo-style res.end JSON when include-trace is set via Node-like response', () => {
    const resolved = resolveInboundHopContext(
      {
        get: (name: string) =>
          name.toLowerCase() === MOCKIFYER_INCLUDE_TRACE_HEADER ? '1' : undefined,
      },
      { includeInlineTrace: true }
    );
    expect(resolved).toBeTruthy();

    let ended: string | undefined;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const res = {
      headersSent: false,
      setHeader: (name: string, value: string | number) => {
        headers[name.toLowerCase()] = String(value);
      },
      getHeader: (name: string) => headers[name.toLowerCase()],
      end: (chunk?: string) => {
        ended = chunk;
      },
    };

    runWithMockifyerHopContext(resolved!.ctx, () => {
      installInlineTraceBodyWrapper(res);
      recordInlineTraceHopFromExchange({
        method: 'GET',
        url: 'https://member.example/x',
        status: 200,
        source: 'upstream',
        transport: 'axios',
        requestId: 'hop-end',
        parentRequestId: resolved!.traceId!,
      });
      res.end(JSON.stringify({ data: { login: true } }));
    });

    const parsed = JSON.parse(ended!);
    expect(parsed.data).toEqual({ data: { login: true } });
    expect(parsed.mockifyerTrace.hopCount).toBe(1);
    expect(parsed.mockifyerTrace.hops[0].url).toContain('/x');
    expect(headers['content-length']).toBe(String(Buffer.byteLength(ended!)));
  });

  it('does not rewrite res.end JSON when headers were flushed with Content-Length', () => {
    const resolved = resolveInboundHopContext(
      {
        get: (name: string) =>
          name.toLowerCase() === MOCKIFYER_INCLUDE_TRACE_HEADER ? '1' : undefined,
      },
      { includeInlineTrace: true }
    );
    expect(resolved).toBeTruthy();

    const originalBody = JSON.stringify({ data: { login: true } });
    let ended: string | undefined;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(originalBody)),
    };
    const res = {
      headersSent: true,
      setHeader: (name: string, value: string | number) => {
        headers[name.toLowerCase()] = String(value);
      },
      getHeader: (name: string) => headers[name.toLowerCase()],
      end: (chunk?: string) => {
        ended = chunk;
      },
    };

    runWithMockifyerHopContext(resolved!.ctx, () => {
      installInlineTraceBodyWrapper(res);
      recordInlineTraceHopFromExchange({
        method: 'GET',
        url: 'https://member.example/x',
        status: 200,
        source: 'upstream',
        transport: 'axios',
        requestId: 'hop-end-committed',
        parentRequestId: resolved!.traceId!,
      });
      res.end(originalBody);
    });

    expect(ended).toBe(originalBody);
    expect(headers['content-length']).toBe(String(Buffer.byteLength(originalBody)));
  });

  it('does not nest envelopes when installInlineTraceBodyWrapper runs twice (inbound + middleware)', () => {
    const resolved = resolveInboundHopContext(
      {
        get: (name: string) =>
          name.toLowerCase() === MOCKIFYER_INCLUDE_TRACE_HEADER ? '1' : undefined,
      },
      { includeInlineTrace: true }
    );
    expect(resolved).toBeTruthy();

    let ended: string | undefined;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const res = {
      headersSent: false,
      setHeader: (name: string, value: string | number) => {
        headers[name.toLowerCase()] = String(value);
      },
      getHeader: (name: string) => headers[name.toLowerCase()],
      end: (chunk?: string) => {
        ended = chunk;
      },
    };

    runWithMockifyerHopContext(resolved!.ctx, () => {
      // Mirrors setupMockifyer auto inbound capture + createMockifyerCorrelationMiddleware.
      installInlineTraceBodyWrapper(res);
      installInlineTraceBodyWrapper(res);
      recordInlineTraceHopFromExchange({
        method: 'POST',
        url: 'https://member.example/graphql',
        status: 200,
        source: 'upstream',
        transport: 'axios',
        requestId: 'hop-double',
        parentRequestId: resolved!.traceId!,
      });
      res.end(JSON.stringify({ data: { login: { token: 't' } } }));
    });

    const parsed = JSON.parse(ended!);
    expect(parsed).toEqual({
      data: { data: { login: { token: 't' } } },
      mockifyerTrace: expect.objectContaining({
        hopCount: 1,
        hops: [expect.objectContaining({ url: 'https://member.example/graphql' })],
      }),
    });
    // Nested envelope would look like data.data.data / data.mockifyerTrace.
    expect(parsed.data).not.toHaveProperty('mockifyerTrace');
    expect(parsed.data.data).toEqual({ login: { token: 't' } });
  });

  it('wrapBodyWithInlineTrace does not nest when body is already enveloped', () => {
    const ctx: MockifyerHopContext = {
      correlation: { requestId: 'root-rewrap' },
      includeInlineTrace: true,
      includeInlineTraceBodies: false,
      inlineHops: [],
    };

    runWithMockifyerHopContext(ctx, () => {
      const first = wrapBodyWithInlineTrace({ ok: true }, ctx);
      const second = wrapBodyWithInlineTrace(first, ctx);
      expect(second).toEqual({
        [MOCKIFYER_TRACE_DATA_KEY]: { ok: true },
        [MOCKIFYER_TRACE_RESPONSE_KEY]: expect.objectContaining({ requestId: 'root-rewrap' }),
      });
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
