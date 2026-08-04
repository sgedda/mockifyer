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
  unwrapAndMergeInlineTraceEnvelope,
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

  it('keeps Express prototype res.json callable (no shadowing getter)', () => {
    const resolved = resolveInboundHopContext(
      {
        get: (name: string) =>
          name.toLowerCase() === MOCKIFYER_INCLUDE_TRACE_HEADER ? '1' : undefined,
      },
      { includeInlineTrace: true }
    );
    expect(resolved).toBeTruthy();

    // Simulate raw Node ServerResponse, then Express setPrototypeOf(app.response).
    const proto = {
      status(this: { statusCode?: number }, code: number) {
        this.statusCode = code;
        return this;
      },
      json(this: { body?: unknown }, body: unknown) {
        this.body = body;
        return this;
      },
    };
    const res = Object.setPrototypeOf(
      {
        headersSent: false,
        setHeader: () => undefined,
        getHeader: () => undefined,
        end: () => undefined,
      },
      proto
    ) as {
      statusCode?: number;
      body?: unknown;
      status: (code: number) => unknown;
      json: (body: unknown) => unknown;
      end: () => void;
    };

    runWithMockifyerHopContext(resolved!.ctx, () => {
      // Early install as Node inbound capture (before Express proto in real life;
      // here proto is already set to assert we never leave json undefined).
      installInlineTraceBodyWrapper(res);
      expect(typeof res.json).toBe('function');
      const chained = res.status(500) as { json: (body: unknown) => unknown };
      expect(typeof chained.json).toBe('function');
      chained.json({ error: 'x' });
    });

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      data: { error: 'x' },
      mockifyerTrace: expect.objectContaining({ hopCount: 0 }),
    });
  });

  it('wraps same-tick res.json when Express prototype is assigned after install', () => {
    const resolved = resolveInboundHopContext(
      {
        get: (name: string) =>
          name.toLowerCase() === MOCKIFYER_INCLUDE_TRACE_HEADER ? '1' : undefined,
      },
      { includeInlineTrace: true }
    );
    expect(resolved).toBeTruthy();

    // Raw Node ServerResponse (no Express json/send yet) — mirrors inbound capture
    // running before originalEmit / Express setPrototypeOf.
    const nodeProto = {
      end() {
        return undefined;
      },
    };
    const res = Object.setPrototypeOf(
      {
        headersSent: false,
        setHeader: () => undefined,
        getHeader: () => undefined,
        end: () => undefined,
      },
      nodeProto
    ) as {
      body?: unknown;
      json: (body: unknown) => unknown;
      send: (body: unknown) => unknown;
      end: () => void;
    };

    const expressProto = {
      json(this: { body?: unknown }, body: unknown) {
        this.body = body;
        return this;
      },
      send(this: { body?: unknown }, body: unknown) {
        this.body = body;
        return this;
      },
    };

    runWithMockifyerHopContext(resolved!.ctx, () => {
      installInlineTraceBodyWrapper(res);
      // Express app.handle: setPrototypeOf then sync route handler — same tick,
      // before any queueMicrotask deferred patch would run.
      Object.setPrototypeOf(res, expressProto);
      res.json({ ok: true });
    });

    expect(res.body).toMatchObject({
      data: { ok: true },
      mockifyerTrace: expect.objectContaining({ hopCount: 0 }),
    });
  });

  it('wraps same-tick res.send after late Express prototype assignment', () => {
    const resolved = resolveInboundHopContext(
      {
        get: (name: string) =>
          name.toLowerCase() === MOCKIFYER_INCLUDE_TRACE_HEADER ? '1' : undefined,
      },
      { includeInlineTrace: true }
    );
    expect(resolved).toBeTruthy();

    const res = Object.setPrototypeOf(
      {
        headersSent: false,
        setHeader: () => undefined,
        getHeader: () => undefined,
        end: () => undefined,
      },
      {}
    ) as {
      body?: unknown;
      send: (body: unknown) => unknown;
      end: () => void;
    };

    runWithMockifyerHopContext(resolved!.ctx, () => {
      installInlineTraceBodyWrapper(res);
      Object.setPrototypeOf(res, {
        send(this: { body?: unknown }, body: unknown) {
          this.body = body;
          return this;
        },
      });
      res.send({ queued: false });
    });

    expect(res.body).toMatchObject({
      data: { queued: false },
      mockifyerTrace: expect.objectContaining({ hopCount: 0 }),
    });
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

  it('unwraps nested mockifyerTrace after the parent hop (parent then children)', () => {
    const ctx: MockifyerHopContext = {
      correlation: { requestId: 'graphql-root' },
      includeInlineTrace: true,
      includeInlineTraceBodies: false,
      inlineHops: [],
    };

    runWithMockifyerHopContext(ctx, () => {
      recordInlineTraceHopFromExchange({
        method: 'POST',
        url: 'https://member.example/v-2/authenticate',
        status: 200,
        source: 'upstream',
        transport: 'proxy',
        requestId: 'hop-member',
        parentRequestId: 'graphql-root',
      });

      const nestedEnvelope = {
        [MOCKIFYER_TRACE_DATA_KEY]: { token: 'abc' },
        [MOCKIFYER_TRACE_RESPONSE_KEY]: {
          requestId: 'member-root',
          hopCount: 2,
          incomplete: false,
          hops: [
            {
              index: 0,
              requestId: 'hop-auth-db',
              parentRequestId: 'member-root',
              timestamp: '2026-01-01T00:00:00.000Z',
              method: 'POST',
              url: 'https://auth.example/token',
              status: 200,
              source: 'upstream',
              transport: 'axios',
            },
            {
              index: 1,
              requestId: 'hop-profile',
              parentRequestId: 'member-root',
              timestamp: '2026-01-01T00:00:01.000Z',
              method: 'GET',
              url: 'https://profile.example/me',
              status: 200,
              source: 'upstream',
              transport: 'fetch',
            },
          ],
        },
      };

      const business = unwrapAndMergeInlineTraceEnvelope(nestedEnvelope);
      expect(business).toEqual({ token: 'abc' });

      const trace = buildInlineRequestTrace();
      expect(trace!.hopCount).toBe(3);
      expect(trace!.hops.map((h) => h.url)).toEqual([
        'https://member.example/v-2/authenticate',
        'https://auth.example/token',
        'https://profile.example/me',
      ]);
      // Parent hop keeps business-body preview semantics when bodies are off
      expect(trace!.hops[0].responseBodyPreview).toBeUndefined();
    });
  });

  it('does not unwrap nested envelopes when parent is not collecting inline trace', () => {
    const envelope = {
      [MOCKIFYER_TRACE_DATA_KEY]: { ok: true },
      [MOCKIFYER_TRACE_RESPONSE_KEY]: {
        requestId: 'x',
        hopCount: 1,
        incomplete: false,
        hops: [
          {
            index: 0,
            requestId: 'h1',
            parentRequestId: null,
            timestamp: '2026-01-01T00:00:00.000Z',
            method: 'GET',
            url: 'https://example/a',
            source: 'upstream',
            transport: 'axios',
          },
        ],
      },
    };
    expect(unwrapAndMergeInlineTraceEnvelope(envelope)).toBe(envelope);
  });

  it('uses business body for hop previews when response is an envelope', () => {
    const ctx: MockifyerHopContext = {
      correlation: { requestId: 'root' },
      includeInlineTrace: true,
      includeInlineTraceBodies: true,
      inlineHops: [],
    };

    runWithMockifyerHopContext(ctx, () => {
      recordInlineTraceHopFromExchange({
        method: 'GET',
        url: 'https://member.example/me',
        status: 200,
        source: 'upstream',
        transport: 'axios',
        requestId: 'hop-1',
        parentRequestId: 'root',
        responseBody: {
          [MOCKIFYER_TRACE_DATA_KEY]: { id: 'user-1' },
          [MOCKIFYER_TRACE_RESPONSE_KEY]: {
            requestId: 'member',
            hopCount: 0,
            incomplete: false,
            hops: [],
          },
        },
      });
      const hop = buildInlineRequestTrace()!.hops[0];
      expect(hop.responseBodyPreview).toContain('user-1');
      expect(hop.responseBodyPreview).not.toContain('mockifyerTrace');
    });
  });
});
