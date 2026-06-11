import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

describe('axios dashboard proxy', () => {
  const testMockDataPath = path.join(__dirname, './test-mock-data-axios-dashboard-proxy');
  const originalFetch = global.fetch;
  const originalAdapter = axios.defaults.adapter;

  function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  function proxyPayload(data: unknown, status = 200): Record<string, unknown> {
    return {
      source: 'upstream',
      hash: 'proxy-hash',
      response: {
        status,
        data,
        headers: { 'x-proxy': 'yes' },
      },
    };
  }

  beforeEach(() => {
    fs.mkdirSync(testMockDataPath, { recursive: true });
    delete (global as any).__mockifyer_original_fetch;
    axios.defaults.adapter = originalAdapter;
    axios.interceptors.request.clear();
    axios.interceptors.response.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (global as any).__mockifyer_original_fetch;
    axios.defaults.adapter = originalAdapter;
    axios.interceptors.request.clear();
    axios.interceptors.response.clear();
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true, force: true });
    }
  });

  it('routes a configured global axios instance through the dashboard proxy adapter', async () => {
    const proxyFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse(proxyPayload({ proxied: true }, 201))
    );
    global.fetch = proxyFetch as unknown as typeof fetch;
    const axiosInstance = axios.create();

    setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalAxios: true,
      axiosInstance,
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local' },
    });

    const response = await axiosInstance.get('https://api.example.com/users', {
      params: { page: '1' },
      headers: { authorization: 'Bearer secret' },
    });

    expect(response.status).toBe(201);
    expect(response.data).toEqual({ proxied: true });
    expect(proxyFetch).toHaveBeenCalledTimes(1);
    expect(String(proxyFetch.mock.calls[0][0])).toBe('http://dashboard.local/api/proxy');

    const proxyBody = JSON.parse(String((proxyFetch.mock.calls[0][1] as RequestInit).body));
    expect(proxyBody.url).toBe('https://api.example.com/users?page=1');
    expect(proxyBody.clientId).toBe('lane-alpha');
    expect(proxyBody.method).toBe('GET');
  });

  it('uses the original fetch for axios proxy calls when global fetch is patched', async () => {
    const originalProxyFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse(proxyPayload({ fromOriginalFetch: true }))
    );
    const patchedFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () => {
      throw new Error('patched fetch should not relay axios dashboard proxy requests');
    });
    global.fetch = originalProxyFetch as unknown as typeof fetch;

    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalAxios: false,
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local' },
    });
    global.fetch = patchedFetch as unknown as typeof fetch;

    const response = await client.get('https://api.example.com/orders');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ fromOriginalFetch: true });
    expect(originalProxyFetch).toHaveBeenCalledTimes(1);
    expect(String(originalProxyFetch.mock.calls[0][0])).toBe('http://dashboard.local/api/proxy');
    expect(patchedFetch).not.toHaveBeenCalled();
  });
});
