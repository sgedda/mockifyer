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
    expect(Object.prototype.hasOwnProperty.call(proxyBody, 'record')).toBe(false);
  });

  it('sends record false when proxy.recordOnMiss is false', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({
        source: 'upstream',
        hash: 'abc123',
        response: {
          status: 200,
          data: {},
          headers: {},
        },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local', recordOnMiss: false },
    });
    await client.get('https://api.example.com/x');

    const proxyBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(proxyBody.record).toBe(false);
  });

  it('applies MOCKIFYER_PROXY_RECORD_ON_MISS when proxy.recordOnMiss is omitted', async () => {
    const prev = process.env.MOCKIFYER_PROXY_RECORD_ON_MISS;
    process.env.MOCKIFYER_PROXY_RECORD_ON_MISS = 'true';

    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({
        source: 'upstream',
        hash: 'abc123',
        response: {
          status: 200,
          data: {},
          headers: {},
        },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const client = setupMockifyer({
        mockDataPath: testMockDataPath,
        recordMode: false,
        useGlobalFetch: false,
        proxy: { baseUrl: 'http://dashboard.local' },
      });
      await client.get('https://api.example.com/env');
      const proxyBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
      expect(proxyBody.record).toBe(true);
    } finally {
      if (prev === undefined) {
        delete process.env.MOCKIFYER_PROXY_RECORD_ON_MISS;
      } else {
        process.env.MOCKIFYER_PROXY_RECORD_ON_MISS = prev;
      }
    }
  });

  it('uses direct upstream when strict proxy has no lane (devtools shows real URL)', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({ live: true })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      strictScenarioResolution: true,
      proxy: { baseUrl: 'http://dashboard.local' },
    });

    const response = await client.get('https://api.example.com/explore');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ live: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.example.com/explore');
  });

  it('does not serve local filesystem mocks when dashboard proxy is active', async () => {
    const scenarioPath = path.join(testMockDataPath, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    const targetUrl = 'http://127.0.0.1:4101/aggregate';
    const requestKey = `GET:${targetUrl}`;
    fs.writeFileSync(
      path.join(scenarioPath, 'local_only_aggregate.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        request: { method: 'GET', url: targetUrl, headers: {} },
        response: {
          status: 200,
          data: { fromLocalFilesystem: true },
          headers: { 'content-type': 'application/json' },
        },
      }),
      'utf-8'
    );

    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({
        source: 'upstream',
        hash: 'proxy-hash',
        response: {
          status: 200,
          data: { fromProxy: true },
          headers: {},
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

    const response = await client.get(targetUrl);

    expect(response.data).toEqual({ fromProxy: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://dashboard.local/api/proxy');
    const proxyBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(proxyBody.url).toBe(targetUrl);
    expect(requestKey).toContain('4101');
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

  it('bypasses dashboard proxy for excludedUrls matches', async () => {
    const tokenUrl = 'https://login.microsoftonline.com/tenant/oauth2/token';
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({ access_token: 'secret-token' })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local' },
      excludedUrls: ['login.microsoftonline.com'],
    });

    const response = await client.post(tokenUrl, { grant_type: 'client_credentials' });

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ access_token: 'secret-token' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(tokenUrl);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('dashboard.local');
  });

  it('preserves URLSearchParams bodies for bypassed excludedUrls POSTs', async () => {
    const tokenUrl = 'https://login.microsoftonline.com/tenant/oauth2/token';
    const tokenBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_secret: 'super-secret',
    });
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({ access_token: 'secret-token' })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local' },
      excludedUrls: ['login.microsoftonline.com'],
    });

    const response = await client.post(tokenUrl, tokenBody);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(tokenUrl);
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBe(tokenBody);
  });

  it('urlencodes plain object bodies for bypassed excludedUrls POSTs with form headers', async () => {
    const tokenUrl = 'https://login.microsoftonline.com/tenant/oauth2/token';
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({ access_token: 'secret-token' })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local' },
      excludedUrls: ['login.microsoftonline.com'],
    });

    const response = await client.post(
      tokenUrl,
      {
        grant_type: 'client_credentials',
        client_secret: 'super-secret',
      },
      { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(tokenUrl);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('grant_type=client_credentials&client_secret=super-secret');
    expect((init.headers as Headers).get('content-type')).toBe('application/x-www-form-urlencoded');
  });
});
