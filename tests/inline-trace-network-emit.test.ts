import http from 'http';
import {
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  applyOutboundRequestCorrelation,
  clearFlightRecorder,
  configureFlightRecorder,
  resolveNetworkLogIncludeTraceOptions,
  resolveNetworkLogIncludeTraceOptionsAsync,
  setMetroAtlasCaptureSessionActive,
  isMetroAtlasCaptureSessionActive,
  unwrapInlineTraceEnvelopeEmittingNetworkEvents,
  __flightRecorderBuffersForTests,
} from '../packages/mockifyer-core/src';

const ATLAS_CAPTURE_SESSION_KEY = Symbol.for(
  '@sgedda/mockifyer-core.metroAtlasCaptureSession'
);

/** Force the next capture-session refresh to run (TTL starts at 0, no in-flight poll). */
function resetAtlasCaptureSessionCache(): void {
  (globalThis as Record<symbol, unknown>)[ATLAS_CAPTURE_SESSION_KEY] = {
    active: false,
    lastSyncedAtMs: 0,
  };
}

describe('networkLog includeTraceHeader wiring', () => {
  beforeEach(() => {
    configureFlightRecorder({ enabled: true, maxEvents: 50 });
    clearFlightRecorder();
  });

  it('resolveNetworkLogIncludeTraceOptions reads config flags', () => {
    expect(resolveNetworkLogIncludeTraceOptions({})).toEqual({
      includeInlineTrace: false,
      includeInlineTraceBodies: false,
    });
    expect(
      resolveNetworkLogIncludeTraceOptions({
        networkLog: { includeTraceHeader: true, includeTraceBodies: true },
      })
    ).toEqual({ includeInlineTrace: true, includeInlineTraceBodies: true });
  });

  it('resolveNetworkLogIncludeTraceOptions stamps include-trace during Atlas t capture', () => {
    const wasActive = isMetroAtlasCaptureSessionActive();
    try {
      setMetroAtlasCaptureSessionActive(true);
      expect(resolveNetworkLogIncludeTraceOptions({})).toEqual({
        includeInlineTrace: true,
        includeInlineTraceBodies: false,
      });
      expect(
        resolveNetworkLogIncludeTraceOptions({
          networkLog: { includeTraceHeader: false },
        })
      ).toEqual({ includeInlineTrace: false, includeInlineTraceBodies: false });
      expect(
        resolveNetworkLogIncludeTraceOptions({
          networkLog: { includeTraceBodies: true },
        })
      ).toEqual({ includeInlineTrace: true, includeInlineTraceBodies: true });
    } finally {
      setMetroAtlasCaptureSessionActive(wasActive);
    }
  });

  it('resolveNetworkLogIncludeTraceOptionsAsync does not wait on a hung Metro poll', async () => {
    const previousStream = process.env.MOCKIFYER_METRO_STREAM;
    const previousUrl = process.env.MOCKIFYER_METRO_URL;
    let requestReceived = false;
    const server = http.createServer((_req, res) => {
      requestReceived = true;
      void res;
      // Never respond — models Metro blocked or a blackholed localhost:8081.
    });

    try {
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
      });
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('test server failed to bind');
      }
      process.env.MOCKIFYER_METRO_STREAM = 'on';
      process.env.MOCKIFYER_METRO_URL = `http://127.0.0.1:${address.port}`;
      resetAtlasCaptureSessionCache();

      const started = Date.now();
      const result = await resolveNetworkLogIncludeTraceOptionsAsync({});
      const elapsedMs = Date.now() - started;

      expect(result).toEqual({
        includeInlineTrace: false,
        includeInlineTraceBodies: false,
      });
      expect(elapsedMs).toBeLessThan(250);

      const sawPoll = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(requestReceived), 1_000);
        if (requestReceived) {
          clearTimeout(timer);
          resolve(true);
          return;
        }
        server.once('request', () => {
          clearTimeout(timer);
          resolve(true);
        });
      });
      expect(sawPoll).toBe(true);
    } finally {
      if (previousStream === undefined) {
        delete process.env.MOCKIFYER_METRO_STREAM;
      } else {
        process.env.MOCKIFYER_METRO_STREAM = previousStream;
      }
      if (previousUrl === undefined) {
        delete process.env.MOCKIFYER_METRO_URL;
      } else {
        process.env.MOCKIFYER_METRO_URL = previousUrl;
      }
      setMetroAtlasCaptureSessionActive(false);
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it('applyOutboundRequestCorrelation stamps include-trace headers from options', () => {
    const config: { headers: Record<string, string> } = { headers: {} };
    applyOutboundRequestCorrelation(config, {
      includeInlineTrace: true,
      includeInlineTraceBodies: true,
    });
    const headers = Object.fromEntries(
      Object.entries(config.headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    expect(headers[MOCKIFYER_INCLUDE_TRACE_HEADER]).toBe('1');
    expect(headers[MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER]).toBe('1');
    expect(headers['x-mockifyer-request-id']).toBeTruthy();
  });

  it('unwrapInlineTraceEnvelopeEmittingNetworkEvents emits children with parentRequestId', async () => {
    const body = {
      data: ['ok', true],
      mockifyerTrace: {
        requestId: 'client-hop',
        hopCount: 2,
        hops: [
          {
            index: 0,
            requestId: 'client-hop',
            parentRequestId: null,
            method: 'POST',
            url: 'https://bff.example/graphql',
            status: 200,
            source: 'upstream',
            transport: 'fetch',
          },
          {
            index: 1,
            requestId: 'child-hop',
            parentRequestId: 'client-hop',
            method: 'GET',
            url: 'https://api.example/downstream',
            status: 200,
            source: 'upstream',
            transport: 'fetch',
            responseBodyPreview: '{"n":1}',
          },
        ],
        incomplete: false,
      },
    };

    const unwrapped = unwrapInlineTraceEnvelopeEmittingNetworkEvents(body, {
      parentRequestId: 'client-hop',
      config: { networkLog: { enabled: true, captureBodies: true } },
      scenario: 'default',
      clientId: 'lane-1',
      sessionId: 'sess-1',
      transport: 'fetch',
    });

    expect(unwrapped).toEqual(['ok', true]);
    expect(__flightRecorderBuffersForTests().network).toHaveLength(0);
    await new Promise((resolve) => setImmediate(resolve));
    const hops = __flightRecorderBuffersForTests().network;
    expect(hops).toHaveLength(1);
    expect(hops[0].requestId).toBe('child-hop');
    expect(hops[0].parentRequestId).toBe('client-hop');
    expect(hops[0].url).toBe('https://api.example/downstream');
    expect(hops[0].method).toBe('GET');
  });

  it('leaves non-envelope bodies unchanged and emits nothing', () => {
    const body = { plain: true };
    const out = unwrapInlineTraceEnvelopeEmittingNetworkEvents(body, {
      parentRequestId: 'client-hop',
      config: { networkLog: { enabled: true } },
    });
    expect(out).toBe(body);
    expect(__flightRecorderBuffersForTests().network).toHaveLength(0);
  });
});
