import {
  performDashboardProxyRequest,
  resolveUnpatchedFetch,
} from '../packages/mockifyer-core/src/utils/perform-dashboard-proxy-request';

describe('performDashboardProxyRequest / resolveUnpatchedFetch', () => {
  const previousOriginal = (globalThis as { __mockifyer_original_fetch?: typeof fetch })
    .__mockifyer_original_fetch;
  const previousFetch = global.fetch;

  afterEach(() => {
    if (previousOriginal) {
      (globalThis as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch =
        previousOriginal;
    } else {
      delete (globalThis as { __mockifyer_original_fetch?: typeof fetch })
        .__mockifyer_original_fetch;
    }
    global.fetch = previousFetch;
  });

  it('prefers __mockifyer_original_fetch over a patched global fetch', () => {
    const original = jest.fn() as unknown as typeof fetch;
    const patched = jest.fn() as unknown as typeof fetch;
    (globalThis as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch =
      original;
    global.fetch = patched;

    expect(resolveUnpatchedFetch()).toBe(original);
    expect(resolveUnpatchedFetch(patched)).toBe(patched);
  });

  it('uses unpatched fetch so dual-client proxy hops keep the dashboard envelope', async () => {
    const originalFetch = jest.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          response: { data: { ok: true }, status: 201, headers: { 'x-from': 'dashboard' } },
          source: 'redis',
          hash: 'deadbeef',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const patchedFetch = jest.fn(async () => {
      // Broken re-entry shape: only the unwrapped body (what patched fetch returns)
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    (globalThis as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch =
      originalFetch;
    global.fetch = patchedFetch;

    const result = await performDashboardProxyRequest({
      proxyBaseUrl: 'http://dashboard:3002',
      url: 'https://api.example.com/v1/items',
      method: 'GET',
      headers: {},
      body: null,
      lane: 'lane-1',
      deviceId: undefined,
      requestId: undefined,
      parentRequestId: undefined,
      scenario: 'demo',
      recordOnMiss: undefined,
      recordResponses: false,
      strictLaneScenario: true,
      upstreamTlsInsecure: false,
      config: { url: 'https://api.example.com/v1/items', method: 'GET' },
      logTag: 'test',
    });

    expect(patchedFetch).not.toHaveBeenCalled();
    expect(originalFetch).toHaveBeenCalledTimes(1);
    expect(String((originalFetch as jest.Mock).mock.calls[0][0])).toBe(
      'http://dashboard:3002/api/proxy'
    );
    expect(result.data).toEqual({ ok: true });
    expect(result.status).toBe(201);
    expect(result.headers).toEqual({ 'x-from': 'dashboard' });
  });
});
