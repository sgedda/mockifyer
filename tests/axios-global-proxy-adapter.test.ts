import axios from 'axios';
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
    const originalFetch = global.fetch;

    beforeEach(() => {
      mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-proxy-'));
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
        axiosInstance: axios,
        clientId: 'test-lane',
        proxy: {
          baseUrl: 'http://localhost:3002',
          recordResponses: false,
          strictLaneScenario: false,
        },
        databaseProvider: { type: 'memory' },
      });

      const response = await axios.get('https://api.example.com/items/1', {
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
    });
  });
});
