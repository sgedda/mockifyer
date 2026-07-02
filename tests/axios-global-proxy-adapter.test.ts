import axios, { isAxiosError, type AxiosInstance } from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import { resolveAxiosRequestUrl } from '../packages/mockifyer-axios/src/dashboard-proxy-axios-adapter';

describe('dashboard proxy axios adapter', () => {
  describe('resolveAxiosRequestUrl', () => {
    it('appends params to the URL', () => {
      const url = resolveAxiosRequestUrl({
        url: 'https://api.example.com/items',
        params: { page: '2', q: 'test' },
      });
      expect(url).toBe('https://api.example.com/items?page=2&q=test');
    });
  });

  describe('useGlobalAxios + proxy.baseUrl', () => {
    let mockDataPath: string;
    let fetchMock: jest.Mock;
    let axiosInstance: AxiosInstance;
    const originalFetch = global.fetch;

    beforeEach(() => {
      mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-proxy-'));
      axiosInstance = axios.create();
      fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          proxied: true,
          source: 'upstream',
          hash: 'abc123',
          response: {
            status: 200,
            data: { routed: true },
            headers: { 'content-type': 'application/json' },
          },
        }),
      });
      global.fetch = fetchMock as typeof fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      fs.rmSync(mockDataPath, { recursive: true, force: true });
    });

    it('routes global axios.get through dashboard /api/proxy', async () => {
      setupMockifyer({
        mockDataPath,
        useGlobalAxios: true,
        axiosInstance,
        clientId: 'test-lane',
        proxy: {
          baseUrl: 'http://localhost:3002',
          recordResponses: false,
          strictLaneScenario: false,
        },
        databaseProvider: { type: 'memory' },
      });

      const response = await axiosInstance.get('https://api.example.com/items/1', {
        params: { q: 'x' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ routed: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [proxyUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(proxyUrl).toBe('http://localhost:3002/api/proxy');
      expect(init.method).toBe('POST');

      const headers = init.headers as Record<string, string>;
      expect(headers['x-mockifyer-client-id']).toBe('test-lane');

      const body = JSON.parse(String(init.body));
      expect(body.url).toBe('https://api.example.com/items/1?q=x');
      expect(body.method).toBe('GET');
      expect(body.clientId).toBe('test-lane');
      expect(body.upstreamTlsInsecure).toBe(false);
    });

    it('includes upstreamTlsInsecure in proxy envelope when configured', async () => {
      setupMockifyer({
        mockDataPath,
        useGlobalAxios: true,
        axiosInstance,
        clientId: 'test-lane',
        proxy: {
          baseUrl: 'http://localhost:3002',
          recordResponses: false,
          strictLaneScenario: false,
          upstreamTlsInsecure: true,
        },
        databaseProvider: { type: 'memory' },
      });

      await axiosInstance.get('https://api.example.com/items/1');

      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body.upstreamTlsInsecure).toBe(true);
    });

    it('serializes FormData in proxy envelope as urlencoded body', async () => {
      setupMockifyer({
        mockDataPath,
        useGlobalAxios: true,
        axiosInstance,
        clientId: 'test-lane',
        proxy: {
          baseUrl: 'http://localhost:3002',
          recordResponses: false,
          strictLaneScenario: false,
        },
        databaseProvider: { type: 'memory' },
      });

      const formData = new FormData();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', 'abc');

      await axiosInstance.post('https://login.example.com/oauth2/token', formData);

      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(body.body.__mockifyerProxyBody).toBe(true);
      expect(body.body.kind).toBe('urlencoded');
      expect(body.body.data).toContain('grant_type=client_credentials');
      expect(body.body.data).toContain('client_id=abc');
    });

    it('bypasses dashboard proxy for excludedUrls matches', async () => {
      const upstreamMock = jest.fn().mockResolvedValue({
        data: { access_token: 'secret' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      setupMockifyer({
        mockDataPath,
        useGlobalAxios: true,
        axiosInstance,
        clientId: 'test-lane',
        proxy: {
          baseUrl: 'http://localhost:3002',
          recordResponses: false,
          strictLaneScenario: false,
        },
        excludedUrls: ['login.microsoftonline.com'],
        databaseProvider: { type: 'memory' },
      });

      const tokenUrl = 'https://login.microsoftonline.com/tenant/oauth2/token';
      await axiosInstance.post(
        tokenUrl,
        { grant_type: 'client_credentials' },
        { adapter: upstreamMock }
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(upstreamMock).toHaveBeenCalledTimes(1);
      expect(upstreamMock.mock.calls[0][0].url).toBe(tokenUrl);
    });

    it('rejects non-2xx proxied responses per the default validateStatus (parity with built-in adapters)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          proxied: true,
          source: 'upstream',
          hash: 'notfound',
          response: {
            status: 404,
            data: { ErrorMessage: 'Booking not found.' },
            headers: { 'content-type': 'application/json' },
          },
        }),
      });

      setupMockifyer({
        mockDataPath,
        useGlobalAxios: true,
        axiosInstance,
        clientId: 'test-lane',
        proxy: {
          baseUrl: 'http://localhost:3002',
          recordResponses: false,
          strictLaneScenario: false,
        },
        databaseProvider: { type: 'memory' },
      });

      await expect(axiosInstance.get('https://api.example.com/items/missing')).rejects.toMatchObject({
        isAxiosError: true,
        response: { status: 404, data: { ErrorMessage: 'Booking not found.' } },
      });
    });

    it('resolves a non-2xx proxied response when validateStatus permits it', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          proxied: true,
          source: 'upstream',
          hash: 'notfound',
          response: {
            status: 404,
            data: { ErrorMessage: 'Booking not found.' },
            headers: { 'content-type': 'application/json' },
          },
        }),
      });

      setupMockifyer({
        mockDataPath,
        useGlobalAxios: true,
        axiosInstance,
        clientId: 'test-lane',
        proxy: {
          baseUrl: 'http://localhost:3002',
          recordResponses: false,
          strictLaneScenario: false,
        },
        databaseProvider: { type: 'memory' },
      });

      const response = await axiosInstance.get('https://api.example.com/items/missing', {
        validateStatus: (status) => status === 404 || (status >= 200 && status < 300),
      });

      expect(response.status).toBe(404);
      expect(response.data).toEqual({ ErrorMessage: 'Booking not found.' });
    })
  });
});
