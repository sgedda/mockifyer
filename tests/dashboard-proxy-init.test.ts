import fs from 'fs';
import os from 'os';
import path from 'path';
import { initMockifyerForDashboardProxy } from '@sgedda/mockifyer-fetch';

describe('initMockifyerForDashboardProxy', () => {
  let tmpDir: string;
  const originalFetch = global.fetch;
  const originalMockifyerFetch = (global as any).__mockifyer_original_fetch;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-proxy-init-'));
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;
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

  it('uses memory storage when strict dashboard proxy health check fails', async () => {
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

    expect((instance as any).config.databaseProvider).toEqual({ type: 'memory' });
    expect((instance as any).config.intendedProxyBaseUrl).toBe('http://dashboard.local');
    expect((instance as any).config.proxy).toBeUndefined();
  });
});
