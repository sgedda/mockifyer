import http from 'http';
import {
  applyOutboundRequestCorrelation,
  captureInboundMockifyerContext,
  captureInboundRequestCorrelation,
  createMockifyerCorrelationMiddleware,
  getActiveInboundClientId,
  getActiveRequestCorrelation,
  getOutboundMockifyerClientIdHeader,
  getOutboundMockifyerParentRequestIdHeader,
  getOutboundMockifyerRequestIdHeader,
  installNodeInboundRequestCorrelationCapture,
  isMockifyerEchoTraceIdEnabled,
  MOCKIFYER_CLIENT_ID_HEADER,
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
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
});
