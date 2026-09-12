import {
  analyzeMetroNetworkEvents,
  formatMetroNetworkAnalysis,
  formatMetroNetworkHopLine,
  MetroNetworkEventBuffer,
  resolveMetroNetworkStreamBaseUrl,
  slimNetworkEventForMetroStream,
  resetMetroNetworkEventBuffer,
  getMetroNetworkEventBuffer,
} from '@sgedda/mockifyer-core';
import type { NetworkEvent } from '@sgedda/mockifyer-core';

function hop(partial: Partial<NetworkEvent> & Pick<NetworkEvent, 'method' | 'url' | 'source'>): NetworkEvent {
  return {
    id: partial.id ?? `e-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: partial.timestamp ?? '2026-09-12T10:00:00.000Z',
    scenario: partial.scenario ?? 'default',
    transport: partial.transport ?? 'fetch',
    method: partial.method,
    url: partial.url,
    host: partial.host,
    path: partial.path,
    status: partial.status,
    durationMs: partial.durationMs,
    source: partial.source,
    anomalyFlags: partial.anomalyFlags,
    requestBodyPreview: partial.requestBodyPreview,
    responseBodyPreview: partial.responseBodyPreview,
    requestHeaders: partial.requestHeaders,
    usage: partial.usage,
  };
}

describe('metro-network-stream', () => {
  const prevStream = process.env.MOCKIFYER_METRO_STREAM;
  const prevPort = process.env.METRO_PORT;
  const prevUrl = process.env.MOCKIFYER_METRO_URL;

  afterEach(() => {
    resetMetroNetworkEventBuffer();
    if (prevStream === undefined) delete process.env.MOCKIFYER_METRO_STREAM;
    else process.env.MOCKIFYER_METRO_STREAM = prevStream;
    if (prevPort === undefined) delete process.env.METRO_PORT;
    else process.env.METRO_PORT = prevPort;
    if (prevUrl === undefined) delete process.env.MOCKIFYER_METRO_URL;
    else process.env.MOCKIFYER_METRO_URL = prevUrl;
  });

  it('ring buffer keeps newest first and notifies subscribers', () => {
    const buffer = new MetroNetworkEventBuffer(3);
    const seen: string[] = [];
    buffer.subscribe((e) => seen.push(e.id));

    buffer.append(hop({ id: '1', method: 'GET', url: 'https://a.test/1', path: '/1', source: 'upstream' }));
    buffer.append(hop({ id: '2', method: 'GET', url: 'https://a.test/2', path: '/2', source: 'upstream' }));
    buffer.append(hop({ id: '3', method: 'GET', url: 'https://a.test/3', path: '/3', source: 'upstream' }));
    buffer.append(hop({ id: '4', method: 'GET', url: 'https://a.test/4', path: '/4', source: 'upstream' }));

    expect(buffer.list().map((e) => e.id)).toEqual(['4', '3', '2']);
    expect(seen).toEqual(['1', '2', '3', '4']);
  });

  it('slims large body previews and strips headers', () => {
    const big = 'x'.repeat(2_000);
    const slim = slimNetworkEventForMetroStream(
      hop({
        method: 'POST',
        url: 'https://a.test/gql',
        path: '/gql',
        source: 'upstream',
        requestBodyPreview: big,
        requestHeaders: { authorization: 'secret' },
      })
    );
    expect(slim.requestHeaders).toBeUndefined();
    expect((slim.requestBodyPreview ?? '').length).toBeLessThan(big.length);
  });

  it('analyze counts errors and slow hops', () => {
    const events = [
      hop({
        method: 'GET',
        url: 'https://api.test/ok',
        host: 'api.test',
        path: '/ok',
        status: 200,
        durationMs: 50,
        source: 'mock-hit',
      }),
      hop({
        method: 'GET',
        url: 'https://api.test/slow',
        host: 'api.test',
        path: '/slow',
        status: 200,
        durationMs: 4000,
        source: 'upstream',
      }),
      hop({
        method: 'POST',
        url: 'https://api.test/fail',
        host: 'api.test',
        path: '/fail',
        status: 500,
        durationMs: 20,
        source: 'error',
      }),
    ];
    const analysis = analyzeMetroNetworkEvents(events, { slowMs: 3000 });
    expect(analysis.hopCount).toBe(3);
    expect(analysis.errorCount).toBe(1);
    expect(analysis.slowCount).toBe(1);
    expect(analysis.byHost['api.test']).toBe(3);
    expect(analysis.topSlow[0]?.path).toBe('/slow');
    const text = formatMetroNetworkAnalysis(analysis);
    expect(text).toContain('errors=1');
    expect(text).toContain('slow');
  });

  it('formats a readable hop line', () => {
    const line = formatMetroNetworkHopLine(
      hop({
        timestamp: '2026-09-12T10:15:30.123Z',
        method: 'GET',
        url: 'https://api.test/x',
        path: '/x',
        status: 200,
        durationMs: 42,
        source: 'mock-hit',
        usage: { screen: 'Home' },
      })
    );
    expect(line).toContain('GET');
    expect(line).toContain('200');
    expect(line).toContain('/x');
    expect(line).toContain('screen=Home');
  });

  it('resolveMetroNetworkStreamBaseUrl respects off / on / METRO_PORT', () => {
    delete process.env.METRO_PORT;
    delete process.env.MOCKIFYER_METRO_URL;
    process.env.MOCKIFYER_METRO_STREAM = 'off';
    expect(resolveMetroNetworkStreamBaseUrl()).toBeUndefined();

    process.env.MOCKIFYER_METRO_STREAM = 'on';
    expect(resolveMetroNetworkStreamBaseUrl()).toBe('http://localhost:8081');

    delete process.env.MOCKIFYER_METRO_STREAM;
    process.env.METRO_PORT = '9091';
    expect(resolveMetroNetworkStreamBaseUrl()).toBe('http://localhost:9091');
  });

  it('getMetroNetworkEventBuffer is a shared singleton', () => {
    const a = getMetroNetworkEventBuffer();
    a.append(hop({ id: 'shared', method: 'GET', url: 'https://a.test/', path: '/', source: 'upstream' }));
    expect(getMetroNetworkEventBuffer().list()[0]?.id).toBe('shared');
  });
});
