import {
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  applyOutboundRequestCorrelation,
  clearFlightRecorder,
  configureFlightRecorder,
  resolveNetworkLogIncludeTraceOptions,
  setMetroAtlasCaptureSessionActive,
  isMetroAtlasCaptureSessionActive,
  unwrapInlineTraceEnvelopeEmittingNetworkEvents,
  __flightRecorderBuffersForTests,
} from '../packages/mockifyer-core/src';

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

  it('resolveNetworkLogIncludeTraceOptions ignores Atlas capture sessions', () => {
    const wasActive = isMetroAtlasCaptureSessionActive();
    try {
      setMetroAtlasCaptureSessionActive(true);
      expect(resolveNetworkLogIncludeTraceOptions({})).toEqual({
        includeInlineTrace: false,
        includeInlineTraceBodies: false,
      });
      expect(
        resolveNetworkLogIncludeTraceOptions({
          networkLog: { includeTraceHeader: true, includeTraceBodies: true },
        })
      ).toEqual({ includeInlineTrace: true, includeInlineTraceBodies: true });
    } finally {
      setMetroAtlasCaptureSessionActive(wasActive);
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
