/**
 * Unit tests for browser dashboard proxy implementation
 */

import { performDashboardProxyRequest } from '../packages/mockifyer-core/src/utils/perform-dashboard-proxy-request.browser';
import type { HTTPRequestConfig } from '../packages/mockifyer-core/src/types/http-client';

describe('browser dashboard proxy', () => {
  let mockFetch: jest.Mock;
  
  beforeEach(() => {
    mockFetch = jest.fn();
  });

  const createDefaultParams = (overrides = {}) => ({
    proxyBaseUrl: 'http://localhost:3002',
    url: 'https://api.example.com/data',
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    body: null,
    lane: 'test-lane',
    deviceId: 'device-123',
    requestId: 'req-456',
    parentRequestId: undefined,
    scenario: 'test-scenario',
    recordOnMiss: false,
    recordResponses: false,
    strictLaneScenario: false,
    upstreamTlsInsecure: false,
    config: { url: 'https://api.example.com/data' } as HTTPRequestConfig,
    fetchFn: mockFetch,
    ...overrides,
  });

  describe('mock hit', () => {
    it('should return HTTPResponse with mock data', async () => {
      const mockResponseData = { id: 1, name: 'Test' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: async () => ({
          source: 'redis',
          hash: 'abc123',
          response: {
            status: 200,
            data: mockResponseData,
            headers: { 'content-type': 'application/json' },
          },
        }),
      });

      const result = await performDashboardProxyRequest(createDefaultParams());

      expect(result).toMatchObject({
        data: mockResponseData,
        status: 200,
        statusText: '200',
        headers: {
          'content-type': 'application/json',
          'x-mockifyer': 'true', // Added for mock hits
        },
        config: expect.objectContaining({
          url: 'https://api.example.com/data',
          __mockifyer_skip_save: true,
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/proxy',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"url":"https://api.example.com/data"'),
        })
      );
    });

    it('should include mockifyerProxyRecording when present', async () => {
      const mockData = { temp: 99 };
      const storedMock = { 
        id: 'mock-123', 
        request: { url: 'https://api.example.com/data', method: 'GET' },
        response: { data: mockData, status: 200 }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: async () => ({
          source: 'redis',
          hash: 'abc123',
          response: {
            status: 200,
            data: mockData,
            headers: {},
          },
          recordedToStore: true,
          storedMock,
          scenarioResolution: { scenario: 'test-scenario' },
        }),
      });

      const result = await performDashboardProxyRequest(createDefaultParams());

      expect(result.mockifyerProxyRecording).toEqual({
        recordedToStore: true,
        storedMock,
        hash: 'abc123',
        scenarioName: 'test-scenario',
      });
    });

    it('should adopt requestId from mockifyerTrace', async () => {
      const adoptedRequestId = 'adopted-req-789';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ['x-mockifyer-request-id', adoptedRequestId],
          ['x-mockifyer-parent-request-id', 'parent-123'],
        ]),
        json: async () => ({
          source: 'redis',
          response: {
            status: 200,
            data: {},
            headers: {},
          },
          requestId: adoptedRequestId,
          parentRequestId: 'parent-123',
        }),
      });

      const result = await performDashboardProxyRequest(createDefaultParams());

      expect((result.config as any).__mockifyer_requestId).toBe(adoptedRequestId);
      expect((result.config as any).__mockifyer_parentRequestId).toBe('parent-123');
    });
  });

  describe('live response (miss)', () => {
    it('should return HTTPResponse from live upstream', async () => {
      const liveData = { message: 'Hello from live API' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: async () => ({
          source: 'upstream',
          hash: 'xyz789',
          response: {
            status: 200,
            data: liveData,
            headers: { 'x-upstream': 'true' },
          },
        }),
      });

      const result = await performDashboardProxyRequest(createDefaultParams({
        recordOnMiss: true,
      }));

      expect(result).toMatchObject({
        data: liveData,
        status: 200,
        statusText: '200',
        headers: { 'x-upstream': 'true' },
        config: expect.objectContaining({
          __mockifyer_skip_save: true,
        }),
      });
      expect(result.headers['x-mockifyer']).toBeUndefined(); // Not a mock hit
    });
  });

  describe('error handling', () => {
    it('should throw on HTTP error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        performDashboardProxyRequest(createDefaultParams())
      ).rejects.toThrow('[Mockifyer Browser Proxy] Dashboard proxy request failed: 500 Internal Server Error');
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(
        performDashboardProxyRequest(createDefaultParams())
      ).rejects.toThrow('[Mockifyer Browser Proxy] Network failure');
    });

    it('should handle undefined config gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({
          source: 'redis',
          response: {
            status: 200,
            data: { result: 'ok' },
            headers: {},
          },
        }),
      });

      const result = await performDashboardProxyRequest(
        createDefaultParams({ config: undefined, requestId: undefined })
      );

      expect(result.config).toEqual({
        __mockifyer_skip_save: true,
      });
    });
  });

  describe('POST with body', () => {
    it('should send request body through proxy', async () => {
      const requestBody = { query: 'test', limit: 10 };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Map(),
        json: async () => ({
          source: 'upstream',
          response: {
            status: 201,
            data: { created: true },
            headers: {},
          },
        }),
      });

      await performDashboardProxyRequest(
        createDefaultParams({
          method: 'POST',
          body: requestBody,
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.body).toEqual(requestBody);
      expect(callBody.method).toBe('POST');
    });

    it('should serialize URLSearchParams body', async () => {
      const params = new URLSearchParams();
      params.append('key1', 'value1');
      params.append('key2', 'value2');

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Map(),
        json: async () => ({
          source: 'upstream',
          response: {
            status: 201,
            data: { created: true },
            headers: {},
          },
        }),
      });

      await performDashboardProxyRequest(
        createDefaultParams({
          method: 'POST',
          body: params,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.body).toEqual({
        __mockifyerProxyBody: true,
        kind: 'urlencoded',
        contentType: 'application/x-www-form-urlencoded',
        data: 'key1=value1&key2=value2',
      });
    });

    it('should serialize FormData body', async () => {
      const formData = new FormData();
      formData.append('username', 'testuser');
      formData.append('email', 'test@example.com');

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Map(),
        json: async () => ({
          source: 'upstream',
          response: {
            status: 201,
            data: { created: true },
            headers: {},
          },
        }),
      });

      await performDashboardProxyRequest(
        createDefaultParams({
          method: 'POST',
          body: formData,
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.body).toEqual({
        __mockifyerProxyBody: true,
        kind: 'urlencoded',
        contentType: 'application/x-www-form-urlencoded',
        data: 'username=testuser&email=test%40example.com',
      });
    });
  });

  describe('custom fetch function', () => {
    it('should use provided fetch function', async () => {
      const customFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({
          source: 'redis',
          response: {
            status: 200,
            data: {},
            headers: {},
          },
        }),
      });

      await performDashboardProxyRequest(
        createDefaultParams({ fetchFn: customFetch })
      );

      expect(customFetch).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
