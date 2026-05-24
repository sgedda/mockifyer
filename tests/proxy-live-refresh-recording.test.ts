import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { MockData } from '@sgedda/mockifyer-core';
import { proxyRouter } from '../packages/mockifyer-dashboard/src/routes/proxy';

let mockStore: any;

jest.mock('../packages/mockifyer-dashboard/src/utils/redis-mock-store', () => ({
  RedisMockStore: jest.fn().mockImplementation(() => mockStore),
}));

jest.mock('../packages/mockifyer-dashboard/src/utils/proxy-network-log', () => ({
  appendProxyNetworkEvent: jest.fn(async () => undefined),
  closeProxyNetworkLog: jest.fn(async () => undefined),
  openProxyNetworkLog: jest.fn(async () => null),
  resolveNetworkLogScenario: jest.fn(() => 'default'),
}));

describe('proxy live refresh recording', () => {
  const originalFetch = global.fetch.bind(global);
  let server: Server;

  afterEach(async () => {
    global.fetch = originalFetch;
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    }
  });

  it('does not overwrite an existing refresh mock with a record-on-miss stub', async () => {
    const existingMock: MockData = {
      request: { method: 'GET', url: 'https://upstream.example.com/items', headers: {} },
      response: { status: 200, data: { stale: true }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
      alwaysRefreshFromLive: true,
      responseDateOverrides: [{ path: 'expiresAt' }],
    };
    mockStore = {
      close: jest.fn(async () => undefined),
      getByHashInScenario: jest.fn(async () => existingMock),
      getDateConfig: jest.fn(async () => null),
      getDomainPathRules: jest.fn(async () => []),
      getProxyConfig: jest.fn(async () => ({
        allowUpstream: true,
        recordOnMiss: true,
        recordResponses: false,
      })),
      recordLaneDeviceSeen: jest.fn(async () => undefined),
      recordLaneSeen: jest.fn(async () => undefined),
      recordProxyEffectiveObservation: jest.fn(async () => undefined),
      resolveProxyScenario: jest.fn(async () => ({
        scenario: 'default',
        resolutionSource: 'body',
        hadBodyScenarioOverride: true,
      })),
      setByHashInScenario: jest.fn(async () => undefined),
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === 'https://upstream.example.com/items') {
        return new Response(JSON.stringify({ fresh: true, expiresAt: '2000-01-01T00:00:00.000Z' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const app = express();
    app.locals.mockDataPath = process.cwd();
    app.locals.dashboardConfig = { provider: 'redis', redisUrl: 'redis://example.invalid' };
    app.use(express.json());
    app.use('/api/proxy', proxyRouter);
    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected test server to listen on a TCP port');
    }

    const response = await originalFetch(`http://127.0.0.1:${(address as AddressInfo).port}/api/proxy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://upstream.example.com/items',
        method: 'GET',
        scenario: 'default',
        record: true,
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.recordedToStore).toBe(false);
    expect(payload.refreshedStoredMock).toBe(true);
    expect(mockStore.setByHashInScenario).toHaveBeenCalledTimes(1);
    const persistedMock = mockStore.setByHashInScenario.mock.calls[0][1] as MockData;
    expect(persistedMock.alwaysRefreshFromLive).toBe(true);
    expect(persistedMock.responsePending).toBeUndefined();
    expect(persistedMock.response.data).toEqual({
      fresh: true,
      expiresAt: '2000-01-01T00:00:00.000Z',
    });
    expect(persistedMock.responseDateOverrides).toEqual([{ path: 'expiresAt' }]);
  });
});
