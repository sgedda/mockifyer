import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildRequestOnlyMockData,
  resolveMockReplayMode,
  type MockData,
} from '@sgedda/mockifyer-core';
import {
  bulkCaptureResponsesForDomain,
  bulkSetLiveApiForDomain,
} from '../packages/mockifyer-dashboard/src/utils/bulk-domain-mocks';
import { fetchUpstreamResponse } from '../packages/mockifyer-dashboard/src/utils/capture-upstream-response';

jest.mock('../packages/mockifyer-dashboard/src/utils/capture-upstream-response', () => ({
  fetchUpstreamResponse: jest.fn(),
}));

const mockedFetchUpstreamResponse = fetchUpstreamResponse as jest.MockedFunction<typeof fetchUpstreamResponse>;

function createMockFile(mockDataPath: string, scenario: string, filename: string, mockData: MockData): string {
  const scenarioPath = path.join(mockDataPath, scenario);
  fs.mkdirSync(scenarioPath, { recursive: true });
  const filePath = path.join(scenarioPath, filename);
  fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2), 'utf-8');
  return filePath;
}

describe('bulk domain mock operations', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-bulk-'));
    mockedFetchUpstreamResponse.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('activates request-only mocks after bulk response capture', async () => {
    const filePath = createMockFile(
      tempDir,
      'default',
      'pending.json',
      buildRequestOnlyMockData({
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
      })
    );
    mockedFetchUpstreamResponse.mockResolvedValue({
      response: { status: 200, data: { users: [{ id: 1 }] }, headers: { 'content-type': 'application/json' } },
      durationMs: 42,
    });

    const result = await bulkCaptureResponsesForDomain({
      provider: 'filesystem',
      mockDataPath: tempDir,
      scenario: 'default',
      domainPath: 'api.example.com',
    });

    const updated = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
    expect(result.captured).toBe(1);
    expect(updated.responsePending).toBeUndefined();
    expect(updated.alwaysUseRealApi).toBeUndefined();
    expect(updated.response.data).toEqual({ users: [{ id: 1 }] });
    expect(resolveMockReplayMode(updated)).toBe('stored');
  });

  it('clears refresh flags when switching a domain back to stored mocks', async () => {
    const filePath = createMockFile(tempDir, 'default', 'refresh.json', {
      request: { method: 'GET', url: 'https://api.example.com/users/1', headers: {} },
      response: { status: 200, data: { id: 1 }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
      alwaysRefreshFromLive: true,
    });

    const result = await bulkSetLiveApiForDomain({
      provider: 'filesystem',
      mockDataPath: tempDir,
      scenario: 'default',
      domainPath: 'api.example.com',
      useLiveApi: false,
    });

    const updated = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
    expect(result.updated).toBe(1);
    expect(updated.alwaysRefreshFromLive).toBeUndefined();
    expect(updated.refreshOnNextRequest).toBeUndefined();
    expect(updated.alwaysUseRealApi).toBeUndefined();
    expect(resolveMockReplayMode(updated)).toBe('stored');
  });
});
