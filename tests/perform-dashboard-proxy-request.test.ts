import { performDashboardProxyRequest } from '@sgedda/mockifyer-core';

describe('performDashboardProxyRequest mockifyerTrace', () => {
  it('maps proxy envelope trace to sidecar and keeps upstream body shape', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        forEach(cb: (value: string, key: string) => void) {
          cb('req-proxy-hop', 'x-mockifyer-request-id');
        },
      },
      json: async () => ({
        source: 'redis',
        requestId: 'req-proxy-hop',
        parentRequestId: 'req-root',
        response: {
          status: 200,
          headers: {},
          data: { city: 'Stockholm' },
        },
      }),
    });

    const result = await performDashboardProxyRequest({
      proxyBaseUrl: 'http://localhost:3002',
      url: 'http://example.test/api/city',
      method: 'GET',
      headers: {},
      body: null,
      lane: undefined,
      deviceId: undefined,
      requestId: undefined,
      parentRequestId: undefined,
      scenario: 'default',
      recordOnMiss: false,
      recordResponses: false,
      strictLaneScenario: true,
      upstreamTlsInsecure: false,
      config: { url: 'http://example.test/api/city', method: 'GET' },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.data).toEqual({ city: 'Stockholm' });
    expect(result.headers['x-mockifyer']).toBe('true');
    expect(result.mockifyerTrace).toEqual({
      requestId: 'req-proxy-hop',
      parentRequestId: 'req-root',
    });
  });

  it('strips accidental trace wrapper from upstream body before returning data', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      headers: { forEach() {} },
      json: async () => ({
        source: 'upstream',
        requestId: 'req-1',
        response: {
          status: 200,
          headers: {},
          data: {
            data: { ok: true },
            mockifyerTrace: { requestId: 'should-not-leak' },
          },
        },
      }),
    });

    const result = await performDashboardProxyRequest({
      proxyBaseUrl: 'http://localhost:3002',
      url: 'http://example.test/api/x',
      method: 'GET',
      headers: {},
      body: null,
      lane: undefined,
      deviceId: undefined,
      requestId: undefined,
      parentRequestId: undefined,
      scenario: undefined,
      recordOnMiss: false,
      recordResponses: false,
      strictLaneScenario: true,
      upstreamTlsInsecure: false,
      config: { url: 'http://example.test/api/x', method: 'GET' },
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(result.data).toEqual({ ok: true });
    expect(result.mockifyerTrace).toEqual({ requestId: 'req-1' });
  });
});
