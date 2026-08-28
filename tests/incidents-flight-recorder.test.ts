import {
  clearFlightRecorder,
  configureFlightRecorder,
  recordFlightNetworkEvent,
  getRecentFlightHops,
  __flightRecorderBuffersForTests,
  buildNetworkEvent,
  reportIncident,
  getCrashContext,
  explainIncidentFromEvents,
  explainCrashContext,
  detectResponseAnomalies,
  responseShapeFingerprint,
  resolveActiveMockifyerSessionId,
  setFlightRecorderRuntimeContext,
  collectCrashContextHops,
  sortHopsByRelevance,
} from '@sgedda/mockifyer-core';

describe('response-shape', () => {
  it('fingerprints object shape', () => {
    const fp = responseShapeFingerprint({ city: 'Stockholm', tempC: 18.4 });
    expect(fp).toContain('city');
    expect(fp).toContain('tempC');
  });

  it('flags graphql errors on 200', () => {
    const flags = detectResponseAnomalies({
      status: 200,
      source: 'mock-hit',
      responseBody: { data: null, errors: [{ message: 'bad' }] },
    });
    expect(flags).toContain('graphql_errors');
  });

  it('does not flag null_body when no response sample exists', () => {
    expect(detectResponseAnomalies({ status: 200, source: 'mock-hit' })).not.toContain('null_body');
  });

  it('flags mock miss', () => {
    expect(detectResponseAnomalies({ source: 'mock-miss', status: 200 })).toContain('mock_miss');
  });
});

describe('flight-recorder', () => {
  beforeEach(() => {
    clearFlightRecorder();
    configureFlightRecorder({ enabled: true, maxEvents: 10, maxIncidents: 5 });
    setFlightRecorderRuntimeContext({});
  });

  it('stores network hops in order', () => {
    const hop = buildNetworkEvent({
      scenario: 'default',
      transport: 'fetch',
      method: 'GET',
      url: 'https://example.com/a',
      source: 'mock-hit',
      sessionId: 'sess-1',
    });
    recordFlightNetworkEvent(hop);
    const recent = getRecentFlightHops({ sessionId: 'sess-1' });
    expect(recent).toHaveLength(1);
    expect(recent[0].url).toContain('/a');
  });

  it('records incidents separately from hops', () => {
    reportIncident({ type: 'error_boundary', message: 'boom', sessionId: 'sess-2' });
    const { incidents, network } = __flightRecorderBuffersForTests();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].kind).toBe('incident');
    expect(network).toHaveLength(0);
  });

  it('resolveActiveMockifyerSessionId prefers screen session', () => {
    setFlightRecorderRuntimeContext({ sessionId: 'screen-matchday-123' });
    expect(resolveActiveMockifyerSessionId(() => 'boot-session')).toBe('screen-matchday-123');
  });
});

describe('incidents', () => {
  beforeEach(() => {
    clearFlightRecorder();
    configureFlightRecorder({ enabled: true, maxEvents: 20, maxIncidents: 10 });
    setFlightRecorderRuntimeContext({});
  });

  it('builds crash context with preceding hops', () => {
    const sessionId = 'sess-crash';
    const at = '2026-08-20T20:00:00.000Z';

    recordFlightNetworkEvent(
      buildNetworkEvent({
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://example.com/weather',
        source: 'mock-hit',
        status: 200,
        sessionId,
        timestamp: '2026-08-20T19:59:50.000Z',
        responseBodyPreview: JSON.stringify({ tempC: null }),
        anomalyFlags: ['null_body'],
      })
    );

    const incident = reportIncident({
      type: 'error_boundary',
      message: 'Cannot read tempC',
      sessionId,
      at,
    });

    const ctx = getCrashContext({ incidentId: incident.id, at, windowMs: 60_000 });
    expect(ctx).not.toBeNull();
    expect(ctx!.hops.length).toBeGreaterThanOrEqual(1);
    expect(ctx!.suspects.length).toBeGreaterThanOrEqual(1);
    expect(explainCrashContext(ctx!)).toContain('Cannot read tempC');
  });

  it('includes cross-session prefetches within grace window', () => {
    const atMs = Date.parse('2026-08-20T20:00:00.000Z');
    const candidates = [
      buildNetworkEvent({
        id: 'prefetch-1',
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://example.com/prefetch-matchday',
        source: 'mock-hit',
        sessionId: 'boot-session',
        timestamp: '2026-08-20T19:59:58.000Z',
        responseBodyPreview: JSON.stringify({ tempC: null }),
        anomalyFlags: ['null_body'],
      }),
      buildNetworkEvent({
        id: 'screen-1',
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://example.com/on-screen',
        source: 'mock-hit',
        sessionId: 'screen-matchday',
        timestamp: '2026-08-20T19:59:59.500Z',
      }),
      buildNetworkEvent({
        id: 'other-1',
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://example.com/settings',
        source: 'mock-hit',
        sessionId: 'screen-settings',
        timestamp: '2026-08-20T19:59:40.000Z',
      }),
    ];

    const { hops, prefetchHopIds } = collectCrashContextHops(candidates, {
      sessionId: 'screen-matchday',
      atMs,
      windowMs: 60_000,
      prefetchGraceMs: 5_000,
    });

    expect(hops).toHaveLength(3);
    expect(prefetchHopIds).toContain('prefetch-1');
    expect(hops[0].id).toBe('prefetch-1');
  });

  it('sortHopsByRelevance puts suspects first', () => {
    const atMs = Date.parse('2026-08-20T20:00:00.000Z');
    const hops = [
      buildNetworkEvent({
        id: 'clean-recent',
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://example.com/clean',
        source: 'mock-hit',
        sessionId: 'screen-a',
        timestamp: '2026-08-20T19:59:59.000Z',
      }),
      buildNetworkEvent({
        id: 'bad-older',
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://example.com/bad',
        source: 'mock-hit',
        sessionId: 'screen-a',
        timestamp: '2026-08-20T19:59:50.000Z',
        anomalyFlags: ['null_body'],
      }),
    ];
    const suspects = [
      {
        eventId: 'bad-older',
        method: 'GET',
        url: 'https://example.com/bad',
        source: 'mock-hit' as const,
        flags: ['null_body' as const],
        summary: 'null_body',
      },
    ];
    const sorted = sortHopsByRelevance(hops, {
      suspects,
      sessionId: 'screen-a',
      atMs,
      windowMs: 60_000,
    });
    expect(sorted[0].id).toBe('bad-older');
  });

  it('explainIncidentFromEvents works on dashboard event lists', () => {
    const sessionId = 'sess-dash';
    const events = [
      buildNetworkEvent({
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://example.com/x',
        source: 'upstream',
        status: 500,
        sessionId,
        timestamp: '2026-08-20T19:59:55.000Z',
      }),
      buildNetworkEvent({
        id: 'inc-1',
        scenario: 'default',
        kind: 'incident',
        incidentType: 'unhandledrejection',
        transport: 'app',
        method: 'INCIDENT',
        url: 'app://unhandledrejection',
        source: 'error',
        errorMessage: 'fail',
        sessionId,
        timestamp: '2026-08-20T20:00:00.000Z',
      }),
    ];

    const ctx = explainIncidentFromEvents(events, { incidentId: 'inc-1', windowMs: 60_000 });
    expect(ctx?.hops).toHaveLength(1);
    expect(ctx?.suspects[0]?.flags).toContain('http_error_status');
  });
});
