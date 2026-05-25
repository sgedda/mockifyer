import fs from 'fs';
import os from 'os';
import path from 'path';
import { getScenarioFolderPath, type MockData } from '@sgedda/mockifyer-core';
import { initMockifyerForDashboardProxy } from '@sgedda/mockifyer-fetch';

function writeLocalMock(mockDataPath: string): void {
  const scenarioDir = getScenarioFolderPath(mockDataPath, 'default');
  fs.mkdirSync(scenarioDir, { recursive: true });
  const mock: MockData = {
    request: {
      method: 'GET',
      url: 'https://api.example.com/secret',
      headers: {},
    },
    response: {
      status: 200,
      data: { leakedLocalMock: true },
      headers: {},
    },
    timestamp: '2026-05-25T00:00:00.000Z',
  };
  fs.writeFileSync(path.join(scenarioDir, 'secret.json'), JSON.stringify(mock, null, 2));
}

describe('initMockifyerForDashboardProxy', () => {
  let tmpDir: string;
  const originalFetch = global.fetch;
  const originalMockifyerFetch = (global as any).__mockifyer_original_fetch;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-proxy-init-'));
    global.fetch = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/health')) {
        return new Response(JSON.stringify({ provider: 'redis', redisOk: false }), { status: 503 });
      }
      return new Response(JSON.stringify({ live: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalMockifyerFetch === undefined) {
      delete (global as any).__mockifyer_original_fetch;
    } else {
      (global as any).__mockifyer_original_fetch = originalMockifyerFetch;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not serve local filesystem mocks when strict dashboard proxy health check fails', async () => {
    writeLocalMock(tmpDir);
    const instance = await initMockifyerForDashboardProxy({
      dashboardBaseUrl: 'http://dashboard.local',
      mockDataPath: tmpDir,
      useGlobalFetch: false,
      config: {
        strictScenarioResolution: true,
        databaseProvider: { type: 'filesystem', path: tmpDir },
        logging: 'none',
      },
    });

    const response = await instance.request({
      method: 'GET',
      url: 'https://api.example.com/secret',
      headers: {},
    });

    expect(response.data).toEqual({ live: true });
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/secret', expect.any(Object));
  });
});
