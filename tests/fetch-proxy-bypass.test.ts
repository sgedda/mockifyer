import { clearMockifyerClientIdRuntime, setupMockifyer } from '@sgedda/mockifyer-fetch';
import fs from 'fs';
import path from 'path';

describe('fetch proxy bypass', () => {
  const testMockDataPath = path.join(__dirname, './test-mock-data-fetch-proxy-bypass');
  const originalFetch = global.fetch;

  function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  beforeEach(() => {
    delete (global as any).__mockifyer_original_fetch;
    clearMockifyerClientIdRuntime();
    fs.mkdirSync(testMockDataPath, { recursive: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (global as any).__mockifyer_original_fetch;
    clearMockifyerClientIdRuntime();
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true, force: true });
    }
  });

  it('uses dashboard proxy for active proxied requests', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({
        source: 'upstream',
        hash: 'abc123',
        response: {
          status: 202,
          data: { fromProxy: true },
          headers: { 'x-proxy': 'yes' },
        },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local' },
    });

    const response = await client.get('https://api.example.com/users');

    expect(response.status).toBe(202);
    expect(response.data).toEqual({ fromProxy: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://dashboard.local/api/proxy');

    const proxyBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(proxyBody.url).toBe('https://api.example.com/users');
    expect(proxyBody.clientId).toBe('lane-alpha');
    expect(proxyBody).not.toHaveProperty('record');
  });

  it('only sends proxy record override when explicitly configured', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({
        source: 'upstream',
        hash: 'abc123',
        response: {
          status: 200,
          data: { ok: true },
          headers: {},
        },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const baseConfig = {
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
    };

    const defaultClient = setupMockifyer({
      ...baseConfig,
      proxy: { baseUrl: 'http://dashboard.local' },
    });
    await defaultClient.get('https://api.example.com/default');

    const recordOffClient = setupMockifyer({
      ...baseConfig,
      proxy: { baseUrl: 'http://dashboard.local', recordOnMiss: false },
    });
    await recordOffClient.get('https://api.example.com/off');

    const recordOnClient = setupMockifyer({
      ...baseConfig,
      proxy: { baseUrl: 'http://dashboard.local', recordOnMiss: true },
    });
    await recordOnClient.get('https://api.example.com/on');

    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse(String((call[1] as RequestInit).body))
    );
    expect(bodies[0]).not.toHaveProperty('record');
    expect(bodies[1].record).toBe(false);
    expect(bodies[2].record).toBe(true);
  });

  it('does not send bypassed requests to dashboard proxy', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({ direct: true })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      activationMode: 'off',
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local' },
    });

    const response = await client.get('https://api.example.com/private');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ direct: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/private');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('GET');
    expect((init.headers as Headers).get('x-mockifyer-client-id')).toBeNull();
  });
});
