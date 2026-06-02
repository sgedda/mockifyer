import axios, { AxiosAdapter, AxiosHeaders } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

describe('axios dashboard proxy', () => {
  const originalFetch = global.fetch;
  const originalAdapter = axios.defaults.adapter;
  let mockDataPath: string;
  let upstream: MockAdapter | undefined;

  function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  function getHeader(headers: Record<string, unknown>, name: string): string | undefined {
    const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    const value = key ? headers[key] : undefined;
    return value === undefined || value === null ? undefined : String(value);
  }

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-dashboard-proxy-'));
    axios.interceptors.request.clear();
    axios.interceptors.response.clear();
    axios.defaults.adapter = originalAdapter;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    upstream?.restore();
    upstream = undefined;
    axios.interceptors.request.clear();
    axios.interceptors.response.clear();
    axios.defaults.adapter = originalAdapter;
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('routes global axios requests through the dashboard proxy and mirrors recorded mocks', async () => {
    const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      jsonResponse({
        source: 'upstream',
        hash: 'abc123',
        recordedToStore: true,
        scenarioResolution: { scenario: 'default' },
        storedMock: {
          timestamp: '2026-06-02T04:00:00.000Z',
          request: {
            method: 'GET',
            url: 'https://api.example.com/users?page=1',
            headers: {},
          },
          response: {
            status: 202,
            data: { fromProxy: true },
            headers: { 'content-type': 'application/json' },
          },
        },
        response: {
          status: 202,
          data: { fromProxy: true },
          headers: { 'x-proxy': 'yes' },
        },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    setupMockifyer({
      mockDataPath,
      recordMode: false,
      useGlobalAxios: true,
      axiosInstance: axios,
      clientId: 'lane-alpha',
      proxy: {
        baseUrl: 'http://dashboard.local',
        mirrorRecordedMocksToClient: true,
      },
    });

    axios.defaults.adapter = (async () => {
      throw new Error('live upstream adapter should not be called');
    }) as AxiosAdapter;

    const response = await axios.get('https://api.example.com/users', {
      params: { page: '1' },
      headers: { Authorization: 'Bearer secret-token' },
    });

    expect(response.status).toBe(202);
    expect(response.data).toEqual({ fromProxy: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://dashboard.local/api/proxy');

    const proxyBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(proxyBody.url).toBe('https://api.example.com/users?page=1');
    expect(proxyBody.clientId).toBe('lane-alpha');
    expect(getHeader(proxyBody.headers, 'authorization')).toBe('Bearer secret-token');
    expect(getHeader(proxyBody.headers, 'x-mockifyer-client-id')).toBe('lane-alpha');

    const mirroredPath = path.join(mockDataPath, 'default', 'redis', 'abc123.json');
    expect(fs.existsSync(mirroredPath)).toBe(true);
  });

  it('does not append params into direct local axios URLs before axios serializes them', async () => {
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);
    let observedUrl = '';
    let observedParams: unknown;
    upstream.onGet().reply((config) => {
      observedUrl = config.url || '';
      observedParams = config.params;
      return [200, { ok: true }];
    });

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      useGlobalAxios: false,
      axiosInstance,
    });

    const response = await client.get('https://api.example.com/search', {
      params: { q: 'term' },
      headers: new AxiosHeaders({ Authorization: 'Bearer direct-token' }) as unknown as Record<string, string>,
    });

    expect(response.data).toEqual({ ok: true });
    expect(observedUrl).toBe('https://api.example.com/search');
    expect(observedParams).toEqual({ q: 'term' });
  });
});
