import fs from 'fs';
import os from 'os';
import path from 'path';
import { getScenarioFolderPath, type MockData } from '@sgedda/mockifyer-core';
import {
  bulkCaptureResponsesForDomain,
  bulkSetLiveApiForDomain,
} from '../packages/mockifyer-dashboard/src/utils/bulk-domain-mocks';

function makeMock(overrides: Partial<MockData> = {}): MockData {
  return {
    request: {
      method: 'GET',
      url: 'https://api.example.com/v1/users',
      headers: {},
    },
    response: {
      status: 200,
      data: { stale: true },
      headers: {},
    },
    timestamp: '2026-05-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('bulk domain mock actions', () => {
  let tmpDir: string;
  let scenarioDir: string;
  let mockPath: string;
  const originalFetch = global.fetch;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-bulk-'));
    scenarioDir = getScenarioFolderPath(tmpDir, 'default');
    fs.mkdirSync(scenarioDir, { recursive: true });
    mockPath = path.join(scenarioDir, 'mock.json');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('bulk disabling live API clears all live-refresh replay flags', async () => {
    fs.writeFileSync(
      mockPath,
      JSON.stringify(
        makeMock({
          alwaysUseRealApi: true,
          alwaysRefreshFromLive: true,
          refreshOnNextRequest: true,
        }),
        null,
        2
      )
    );

    const result = await bulkSetLiveApiForDomain({
      provider: 'filesystem',
      mockDataPath: tmpDir,
      scenario: 'default',
      domainPath: 'api.example.com',
      useLiveApi: false,
    });

    const updated = JSON.parse(fs.readFileSync(mockPath, 'utf-8')) as MockData;
    expect(result.updated).toBe(1);
    expect(updated.alwaysUseRealApi).toBeUndefined();
    expect(updated.alwaysRefreshFromLive).toBeUndefined();
    expect(updated.refreshOnNextRequest).toBeUndefined();
  });

  it('bulk capture activates pending mocks for stored replay', async () => {
    fs.writeFileSync(
      mockPath,
      JSON.stringify(
        makeMock({
          response: { status: 0, data: null, headers: {} },
          responsePending: true,
          alwaysUseRealApi: true,
        }),
        null,
        2
      )
    );
    global.fetch = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ fresh: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const result = await bulkCaptureResponsesForDomain({
      provider: 'filesystem',
      mockDataPath: tmpDir,
      scenario: 'default',
      domainPath: 'api.example.com',
    });

    const updated = JSON.parse(fs.readFileSync(mockPath, 'utf-8')) as MockData;
    expect(result.captured).toBe(1);
    expect(updated.responsePending).toBeUndefined();
    expect(updated.alwaysUseRealApi).toBeUndefined();
    expect(updated.response.status).toBe(201);
    expect(updated.response.data).toEqual({ fresh: true });
  });
});
