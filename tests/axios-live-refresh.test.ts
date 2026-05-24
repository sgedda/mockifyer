import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import type { MockData } from '@sgedda/mockifyer-core';

describe('axios live refresh replay mode', () => {
  let tempDir: string;
  const originalScenario = process.env.MOCKIFYER_SCENARIO;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-refresh-'));
    delete process.env.MOCKIFYER_SCENARIO;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (originalScenario === undefined) {
      delete process.env.MOCKIFYER_SCENARIO;
    } else {
      process.env.MOCKIFYER_SCENARIO = originalScenario;
    }
  });

  it('persists and returns live refresh captures in replay mode', async () => {
    const scenarioPath = path.join(tempDir, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    const mockPath = path.join(scenarioPath, 'items.json');
    const mockData: MockData = {
      request: { method: 'GET', url: 'https://api.example.com/items', headers: {} },
      response: { status: 200, data: { stale: true }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
      alwaysRefreshFromLive: true,
    };
    fs.writeFileSync(mockPath, JSON.stringify(mockData, null, 2), 'utf-8');

    const axiosInstance = axios.create({
      adapter: async config => ({
        data: { fresh: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      }),
    });

    const client = setupMockifyer({
      mockDataPath: tempDir,
      recordMode: false,
      defaultScenario: 'default',
      axiosInstance,
    });

    const response = await client.get('https://api.example.com/items');
    const updated = JSON.parse(fs.readFileSync(mockPath, 'utf-8')) as MockData;

    expect(response.data).toEqual({ fresh: true });
    expect(updated.response.data).toEqual({ fresh: true });
    expect(updated.alwaysRefreshFromLive).toBe(true);
  });
});
