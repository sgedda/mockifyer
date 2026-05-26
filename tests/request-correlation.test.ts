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

  it('auto-installs inbound capture on Node http.Server without middleware', async () => {
    expect(installNodeInboundRequestCorrelationCapture()).toBe(true);

    let parentDuringHandler: string | undefined;
    let hopDuringHandler: RequestCorrelationContext | undefined;

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
  });
});
