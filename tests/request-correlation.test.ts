import http from 'http';
import {
  applyOutboundRequestCorrelation,
  attachMockifyerRequestIdToError,
  captureInboundMockifyerContext,
  captureInboundRequestCorrelation,
  createMockifyerCorrelationMiddleware,
  createMockifyerErrorHandler,
  getActiveInboundClientId,
  getActiveRequestCorrelation,
  getMockifyerRequestIdFromError,
  getOutboundMockifyerClientIdHeader,
  getOutboundMockifyerParentRequestIdHeader,
  getOutboundMockifyerRequestIdHeader,
  installNodeInboundRequestCorrelationCapture,
  isMockifyerEchoTraceIdEnabled,
  MOCKIFYER_CLIENT_ID_HEADER,
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  MOCKIFYER_REQUEST_ID_ERROR_PROP,
  MOCKIFYER_REQUEST_ID_HEADER,
  resolveMockifyerRequestIdForError,
  resolveOutboundParentRequestId,
  runWithMockifyerHopContext,
  runWithRequestCorrelation,
  type RequestCorrelationContext,
} from '@sgedda/mockifyer-core';

describe('request-correlation', () => {
  it('reads inbound lane and correlation headers', () => {
    const ctx = captureInboundMockifyerContext({
      get: (name: string) => {
        if (name.toLowerCase() === MOCKIFYER_CLIENT_ID_HEADER) return 'lane-a';
        if (name.toLowerCase() === MOCKIFYER_REQUEST_ID_HEADER) return 'req-a';
        if (name.toLowerCase() === MOCKIFYER_PARENT_REQUEST_ID_HEADER) return 'req-root';
        return undefined;
      },
    });
    expect(ctx).toEqual({
      inboundClientId: 'lane-a',
      correlation: { requestId: 'req-a', parentRequestId: 'req-root' },
    });
  });

  it('reads inbound correlation headers', () => {
    const ctx = captureInboundRequestCorrelation({
      get: (name: string) => {
        if (name.toLowerCase() === MOCKIFYER_REQUEST_ID_HEADER) return 'req-a';
        if (name.toLowerCase() === MOCKIFYER_PARENT_REQUEST_ID_HEADER) return 'req-root';
        return undefined;
      },
    });
    expect(ctx).toEqual({ requestId: 'req-a', parentRequestId: 'req-root' });
  });

  it('assigns hop ids and links to active inbound correlation', () => {
    const parentCtx = { requestId: 'req-inbound' };
    runWithRequestCorrelation(parentCtx, () => {
      const config = { headers: {} as Record<string, string> };
      const hop = applyOutboundRequestCorrelation(config);
      expect(hop.requestId).toBeTruthy();
      expect(hop.parentRequestId).toBe('req-inbound');
      expect(getOutboundMockifyerRequestIdHeader(config.headers)).toBe(hop.requestId);
      expect(getOutboundMockifyerParentRequestIdHeader(config.headers)).toBe('req-inbound');
      expect(getActiveRequestCorrelation()?.requestId).toBe('req-inbound');
    });
  });

  it('uses explicit parent header when no inbound context', () => {
    const config = {
      headers: {
        [MOCKIFYER_PARENT_REQUEST_ID_HEADER]: 'req-parent',
      },
    };
    expect(resolveOutboundParentRequestId(config.headers)).toBe('req-parent');
    const hop = applyOutboundRequestCorrelation(config);
    expect(hop.parentRequestId).toBe('req-parent');
  });

  it('propagates inbound client id on outbound fetch without manual headers', () => {
    runWithMockifyerHopContext({ inboundClientId: 'lane-gateway' }, () => {
      const config = { headers: {} as Record<string, string> };
      applyOutboundRequestCorrelation(config);
      expect(getOutboundMockifyerClientIdHeader(config.headers)).toBe('lane-gateway');
      expect(getActiveInboundClientId()).toBe('lane-gateway');
    });
  });

  it('forwards include-trace headers on outbound hops when parent opted in', () => {
    runWithMockifyerHopContext(
      {
        correlation: { requestId: 'root' },
        includeInlineTrace: true,
        includeInlineTraceBodies: true,
        inlineHops: [],
      },
      () => {
        const config = { headers: {} as Record<string, string> };
        applyOutboundRequestCorrelation(config);
        expect(config.headers[MOCKIFYER_INCLUDE_TRACE_HEADER]).toBe('1');
        expect(config.headers[MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER]).toBe('1');
      }
    );
  });

  it('does not forward include-trace when parent did not opt in', () => {
    runWithMockifyerHopContext({ correlation: { requestId: 'root' } }, () => {
      const config = { headers: {} as Record<string, string> };
      applyOutboundRequestCorrelation(config);
      expect(config.headers[MOCKIFYER_INCLUDE_TRACE_HEADER]).toBeUndefined();
      expect(config.headers[MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER]).toBeUndefined();
    });
  });

  it('middleware captures inbound request id for downstream hops', () => {
    const middleware = createMockifyerCorrelationMiddleware();
    const req = {
      header: (name: string) =>
        name.toLowerCase() === MOCKIFYER_REQUEST_ID_HEADER ? 'req-gateway' : undefined,
    };
    let activeDuringNext: string | undefined;
    middleware(req, {}, () => {
      activeDuringNext = getActiveRequestCorrelation()?.requestId;
    });
    expect(activeDuringNext).toBe('req-gateway');
  });

  it('middleware captures inbound client id for downstream hops', () => {
    const middleware = createMockifyerCorrelationMiddleware();
    const req = {
      header: (name: string) =>
        name.toLowerCase() === MOCKIFYER_CLIENT_ID_HEADER ? 'lane-web' : undefined,
    };
    let laneDuringNext: string | undefined;
    middleware(req, {}, () => {
      laneDuringNext = getActiveInboundClientId();
    });
    expect(laneDuringNext).toBe('lane-web');
  });

  it('middleware assigns trace id and echoes on response when inbound id is missing', () => {
    const middleware = createMockifyerCorrelationMiddleware();
    const req = { header: () => undefined };
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
    };
    let activeDuringNext: string | undefined;
    middleware(req, res, () => {
      activeDuringNext = getActiveRequestCorrelation()?.requestId;
    });
    expect(activeDuringNext).toBeTruthy();
    expect(headers[MOCKIFYER_REQUEST_ID_HEADER]).toBe(activeDuringNext);
  });

  it('middleware echoes client-supplied trace id on response', () => {
    const middleware = createMockifyerCorrelationMiddleware();
    const req = {
      header: (name: string) =>
        name.toLowerCase() === MOCKIFYER_REQUEST_ID_HEADER ? 'client-root-99' : undefined,
    };
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
    };
    middleware(req, res, () => undefined);
    expect(headers[MOCKIFYER_REQUEST_ID_HEADER]).toBe('client-root-99');
  });

  it('auto-installs inbound capture on Node http.Server without middleware', async () => {
    expect(installNodeInboundRequestCorrelationCapture()).toBe(true);

    let parentDuringHandler: string | undefined;
    let hopDuringHandler: RequestCorrelationContext | undefined;
    let echoedTraceId: string | undefined;

    const server = http.createServer((_req, res) => {
      parentDuringHandler = getActiveRequestCorrelation()?.requestId;
      const config = { headers: {} as Record<string, string> };
      hopDuringHandler = applyOutboundRequestCorrelation(config);
      res.writeHead(200);
      res.end('ok');
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('expected server address'));
          return;
        }

        http.get(
          {
            host: '127.0.0.1',
            port: address.port,
            path: '/',
            headers: {
              [MOCKIFYER_REQUEST_ID_HEADER]: 'req-inbound',
            },
          },
          (res) => {
            echoedTraceId = res.headers[MOCKIFYER_REQUEST_ID_HEADER] as string | undefined;
            res.resume();
            res.on('end', () => {
              server.close(() => resolve());
            });
          }
        ).on('error', reject);
      });
    });

    expect(parentDuringHandler).toBe('req-inbound');
    expect(hopDuringHandler?.parentRequestId).toBe('req-inbound');
    expect(hopDuringHandler?.requestId).toBeTruthy();
    expect(echoedTraceId).toBe('req-inbound');
  });

  it('Node inbound capture assigns and echoes a trace id when the request has none', async () => {
    expect(installNodeInboundRequestCorrelationCapture()).toBe(true);

    let parentDuringHandler: string | undefined;
    let echoedTraceId: string | undefined;

    const server = http.createServer((_req, res) => {
      parentDuringHandler = getActiveRequestCorrelation()?.requestId;
      res.writeHead(200);
      res.end('ok');
    });

    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('expected server address'));
          return;
        }

        http.get({ host: '127.0.0.1', port: address.port, path: '/' }, (res) => {
          echoedTraceId = res.headers[MOCKIFYER_REQUEST_ID_HEADER] as string | undefined;
          res.resume();
          res.on('end', () => {
            server.close(() => resolve());
          });
        }).on('error', reject);
      });
    });

    expect(parentDuringHandler).toBeTruthy();
    expect(echoedTraceId).toBe(parentDuringHandler);
  });

  it('respects MOCKIFYER_ECHO_TRACE_ID=false for Node inbound echo', async () => {
    expect(installNodeInboundRequestCorrelationCapture()).toBe(true);

    const previous = process.env.MOCKIFYER_ECHO_TRACE_ID;
    process.env.MOCKIFYER_ECHO_TRACE_ID = 'false';

    let parentDuringHandler: string | undefined;
    let echoedTraceId: string | undefined;

    try {
      expect(isMockifyerEchoTraceIdEnabled()).toBe(false);

      const server = http.createServer((_req, res) => {
        parentDuringHandler = getActiveRequestCorrelation()?.requestId;
        res.writeHead(200);
        res.end('ok');
      });

      await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (!address || typeof address === 'string') {
            reject(new Error('expected server address'));
            return;
          }

          http.get({ host: '127.0.0.1', port: address.port, path: '/' }, (res) => {
            echoedTraceId = res.headers[MOCKIFYER_REQUEST_ID_HEADER] as string | undefined;
            res.resume();
            res.on('end', () => {
              server.close(() => resolve());
            });
          }).on('error', reject);
        });
      });

      expect(parentDuringHandler).toBeTruthy();
      expect(echoedTraceId).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.MOCKIFYER_ECHO_TRACE_ID;
      } else {
        process.env.MOCKIFYER_ECHO_TRACE_ID = previous;
      }
    }
  });

  it('isMockifyerEchoTraceIdEnabled defaults on and honors falsey env values', () => {
    expect(isMockifyerEchoTraceIdEnabled({})).toBe(true);
    expect(isMockifyerEchoTraceIdEnabled({ MOCKIFYER_ECHO_TRACE_ID: 'false' })).toBe(false);
    expect(isMockifyerEchoTraceIdEnabled({ MOCKIFYER_ECHO_TRACE_ID: '0' })).toBe(false);
    expect(isMockifyerEchoTraceIdEnabled({ MOCKIFYER_ECHO_TRACE_ID: 'off' })).toBe(false);
  });

  it('attachMockifyerRequestIdToError stamps property and appends message marker', () => {
    const err = new Error('boom');
    attachMockifyerRequestIdToError(err, 'trace-abc');
    expect(getMockifyerRequestIdFromError(err)).toBe('trace-abc');
    expect((err as { mockifyerRequestId?: string }).mockifyerRequestId).toBe('trace-abc');
    expect(err.message).toContain(`[${MOCKIFYER_REQUEST_ID_ERROR_PROP}=trace-abc]`);

    attachMockifyerRequestIdToError(err, 'other-id');
    expect(getMockifyerRequestIdFromError(err)).toBe('trace-abc');
    expect(err.message.match(/mockifyerRequestId=/g)?.length).toBe(1);
  });

  it('resolveMockifyerRequestIdForError prefers active inbound over hop id', () => {
    runWithRequestCorrelation({ requestId: 'inbound-root' }, () => {
      expect(
        resolveMockifyerRequestIdForError({
          hopRequestId: 'hop-1',
          responseHeaders: { [MOCKIFYER_REQUEST_ID_HEADER]: 'from-header' },
        })
      ).toBe('inbound-root');
    });
    expect(
      resolveMockifyerRequestIdForError({
        hopRequestId: 'hop-1',
        responseHeaders: { [MOCKIFYER_REQUEST_ID_HEADER]: 'from-header' },
      })
    ).toBe('from-header');
    expect(resolveMockifyerRequestIdForError({ hopRequestId: 'hop-1' })).toBe('hop-1');
  });

  it('middleware stores mockifyerRequestId on req for error handlers', () => {
    const middleware = createMockifyerCorrelationMiddleware();
    const req: { header: () => undefined; mockifyerRequestId?: string } = {
      header: () => undefined,
    };
    middleware(req, { setHeader: () => undefined }, () => undefined);
    expect(req.mockifyerRequestId).toBeTruthy();
  });

  it('error handler enriches exception and can send JSON with requestId', () => {
    const handler = createMockifyerErrorHandler({ sendJsonResponse: true });
    const req = { header: () => undefined, mockifyerRequestId: 'err-trace-1' };
    let statusCode: number | undefined;
    let body: unknown;
    const headers: Record<string, string> = {};
    const res = {
      headersSent: false,
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return payload;
      },
    };
    let nextCalled = false;
    handler(new Error('handler failed'), req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(500);
    expect(body).toEqual({ error: expect.stringContaining('handler failed'), requestId: 'err-trace-1' });
    expect(headers[MOCKIFYER_REQUEST_ID_HEADER]).toBe('err-trace-1');
  });

  it('error handler without sendJsonResponse only enriches and next(err)', () => {
    const handler = createMockifyerErrorHandler();
    const req = { header: () => undefined, mockifyerRequestId: 'err-trace-2' };
    let forwarded: unknown;
    handler(new Error('x'), req, { setHeader: () => undefined }, (err) => {
      forwarded = err;
    });
    expect(getMockifyerRequestIdFromError(forwarded)).toBe('err-trace-2');
    expect((forwarded as Error).message).toContain('err-trace-2');
  });

  it('error handler recovers requestId from stamped error when req and ALS lack it', () => {
    const handler = createMockifyerErrorHandler({ sendJsonResponse: true });
    const err = attachMockifyerRequestIdToError(new Error('upstream failed'), 'from-axios');
    const req = { header: () => undefined };
    let statusCode: number | undefined;
    let body: unknown;
    const headers: Record<string, string> = {};
    const res = {
      headersSent: false,
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return payload;
      },
    };
    handler(err, req, res, () => undefined);
    expect(statusCode).toBe(500);
    expect(body).toEqual({
      error: expect.stringContaining('upstream failed'),
      requestId: 'from-axios',
    });
    expect(headers[MOCKIFYER_REQUEST_ID_HEADER]).toBe('from-axios');
  });
});
