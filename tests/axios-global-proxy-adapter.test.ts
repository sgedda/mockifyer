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

    it('resolves relative URLs against axios baseURL before appending params', () => {
      const url = resolveAxiosRequestUrl({
        baseURL: 'https://api.example.com/v1',
        url: '/items',
        params: { q: 'test' },
      });

      expect(url).toBe('https://api.example.com/v1/items?q=test');
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
      const axiosInstance = axios.create();
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
    });

    it('routes relative URLs with axios baseURL through dashboard /api/proxy', async () => {
      const axiosInstance = axios.create({ baseURL: 'https://api.example.com/v1' });
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

      const response = await axiosInstance.get('/items/1', {
        params: { q: 'x' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ routed: true });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body));
      expect(body.url).toBe('https://api.example.com/v1/items/1?q=x');
    });

    it('mirrors dashboard proxy recordings from the global axios response path', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          proxied: true,
          source: 'upstream',
          hash: 'abc123',
          recordedToStore: true,
          scenarioResolution: { scenario: 'test-lane' },
          storedMock: {
            request: {
              method: 'GET',
              url: 'https://api.example.com/items/1',
              headers: {},
              body: null,
            },
            response: {
              status: 200,
              data: { routed: true },
              headers: { 'content-type': 'application/json' },
            },
          },
          response: {
            status: 200,
            data: { routed: true },
            headers: { 'content-type': 'application/json' },
          },
        }),
      });

      const axiosInstance = axios.create();
      setupMockifyer({
        mockDataPath,
        useGlobalAxios: true,
        axiosInstance,
        clientId: 'test-lane',
        proxy: {
          baseUrl: 'http://localhost:3002',
          recordResponses: false,
          strictLaneScenario: false,
          mirrorRecordedMocksToClient: true,
        },
        databaseProvider: { type: 'memory' },
      });

      await axiosInstance.get('https://api.example.com/items/1');

      const mirrorPath = path.join(mockDataPath, 'test-lane', 'redis', 'abc123.json');
      expect(fs.existsSync(mirrorPath)).toBe(true);
      const mirrored = JSON.parse(fs.readFileSync(mirrorPath, 'utf8'));
      expect(mirrored.response.data).toEqual({ routed: true });
    });
  });
});
