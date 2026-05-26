import fs from 'fs';
import os from 'os';
import path from 'path';
import { bulkSetLiveApiForDomain } from '../packages/mockifyer-dashboard/src/utils/bulk-domain-mocks';
import type { MockData } from '@sgedda/mockifyer-core';

const baseMock = (overrides: Partial<MockData> = {}): MockData => ({
  request: { method: 'GET', url: 'https://api.example.com/v1/items', headers: {} },
  response: { status: 200, data: { ok: true }, headers: {} },
  timestamp: '2020-01-01T00:00:00.000Z',
  ...overrides,
});

describe('bulk-domain-mocks', () => {
  let tmpRoot: string;
  let scenarioPath: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-bulk-domain-'));
    scenarioPath = path.join(tmpRoot, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function writeMock(filename: string, mockData: MockData): string {
    const filePath = path.join(scenarioPath, filename);
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2), 'utf-8');
    return filePath;
  }

  function readMock(filePath: string): MockData {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
  }

  it('clears all live replay flags when switching a domain back to stored replay', async () => {
    const alwaysRefreshPath = writeMock(
      'always-refresh.json',
      baseMock({ alwaysRefreshFromLive: true })
    );
    const refreshNextPath = writeMock(
      'refresh-next.json',
      baseMock({ request: { method: 'GET', url: 'https://api.example.com/v1/other', headers: {} }, refreshOnNextRequest: true })
    );
    const passthroughPath = writeMock(
      'passthrough.json',
      baseMock({ request: { method: 'GET', url: 'https://api.example.com/v1/live', headers: {} }, alwaysUseRealApi: true })
    );

    const result = await bulkSetLiveApiForDomain({
      provider: 'filesystem',
      mockDataPath: tmpRoot,
      scenario: 'default',
      domainPath: 'api.example.com/v1',
      useLiveApi: false,
    });

    expect(result.updated).toBe(3);
    for (const filePath of [alwaysRefreshPath, refreshNextPath, passthroughPath]) {
      const mockData = readMock(filePath);
      expect(mockData.alwaysRefreshFromLive).toBeUndefined();
      expect(mockData.refreshOnNextRequest).toBeUndefined();
      expect(mockData.alwaysUseRealApi).toBeUndefined();
    }
  });
});
