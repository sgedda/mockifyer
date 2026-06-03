import axios, { AxiosHeaders } from 'axios';
import fs from 'fs';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import { AxiosHTTPClient } from '@sgedda/mockifyer-axios/clients/axios-client';

describe('axios dashboard proxy', () => {
  const testMockDataPath = path.join(__dirname, './test-mock-data-axios-dashboard-proxy');
  const originalFetch = global.fetch;
  const originalAdapter = axios.defaults.adapter;

  function proxyResponse(data: unknown, status = 200): Response {
    return new Response(
      JSON.stringify({
        source: 'upstream',
        hash: 'abc123',
        response: {
          status,
          data,
          headers: { 'x-proxy': 'yes' },
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }

  beforeEach(() => {
    fs.mkdirSync(testMockDataPath, { recursive: true });
    if (typeof (axios.interceptors.request as any).clear === 'function') {
      (axios.interceptors.request as any).clear();
    }
    if (typeof (axios.interceptors.response as any).clear === 'function') {
      (axios.interceptors.response as any).clear();
    }
    axios.defaults.adapter = originalAdapter;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    axios.defaults.adapter = originalAdapter;
    if (typeof (axios.interceptors.request as any).clear === 'function') {
      (axios.interceptors.request as any).clear();
    }
    if (typeof (axios.interceptors.response as any).clear === 'function') {
      (axios.interceptors.response as any).clear();
    }
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true, force: true });
    }
  });

  it('routes useGlobalAxios dashboard proxy traffic through /api/proxy with params and headers', async () => {
    const proxiedAxios = axios.create();
    const directAdapter = jest.fn(async (config: any) => ({
      data: { direct: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    proxiedAxios.defaults.adapter = directAdapter;
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      proxyResponse({ fromProxy: true }, 203)
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalAxios: true,
      axiosInstance: proxiedAxios,
      clientId: 'lane-alpha',
      proxy: { baseUrl: 'http://dashboard.local' },
    });

    const response = await proxiedAxios.get('https://api.example.com/users', {
      params: { page: '1' },
      headers: new AxiosHeaders({ Authorization: 'Bearer token' }),
    });

    expect(response.status).toBe(203);
    expect(response.data).toEqual({ fromProxy: true });
    expect(directAdapter).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://dashboard.local/api/proxy');

    const proxyBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(proxyBody.url).toBe('https://api.example.com/users?page=1');
    expect(proxyBody.clientId).toBe('lane-alpha');
    expect(proxyBody.headers.Authorization ?? proxyBody.headers.authorization).toBe('Bearer token');
  });

  it('leaves params on direct axios requests instead of also appending them to url', async () => {
    let adapterConfig: any;
    const instance = axios.create({
      adapter: async (config: any) => {
        adapterConfig = config;
        return {
          data: { ok: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      },
    });
    const client = new AxiosHTTPClient(instance as any);

    await client.get('https://api.example.com/items', { params: { page: '1' } });

    expect(adapterConfig.url).toBe('https://api.example.com/items');
    expect(adapterConfig.params).toEqual({ page: '1' });
  });
});
