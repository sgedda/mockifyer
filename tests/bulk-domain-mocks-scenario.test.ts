import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  bulkCaptureResponsesForDomain,
  bulkSetLiveApiForDomain,
} from '../packages/mockifyer-dashboard/src/utils/bulk-domain-mocks';

function writeMock(filePath: string, alwaysUseRealApi?: boolean): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        request: {
          method: 'GET',
          url: 'https://api.example.com/v1/users/1',
          headers: {},
        },
        response: { status: 200, data: { ok: true }, headers: {} },
        timestamp: '2026-01-01T00:00:00.000Z',
        ...(alwaysUseRealApi ? { alwaysUseRealApi: true } : {}),
      },
      null,
      2
    ),
    'utf-8'
  );
}

describe('bulk domain mocks scenario sanitization', () => {
  let tmp: string;
  let mockDataPath: string;
  let siblingMock: string;
  let scenarioMock: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-bulk-scenario-'));
    mockDataPath = path.join(tmp, 'mock-data');
    siblingMock = path.join(tmp, 'outside.json');
    scenarioMock = path.join(mockDataPath, 'default', 'users.json');
    writeMock(siblingMock);
    writeMock(scenarioMock);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('rejects scenario ".." so bulk-live-api cannot rewrite sibling JSON', async () => {
    await expect(
      bulkSetLiveApiForDomain({
        provider: 'filesystem',
        mockDataPath,
        scenario: '..',
        domainPath: 'api.example.com',
        useLiveApi: true,
      })
    ).rejects.toThrow(/Invalid scenario name/);

    const sibling = JSON.parse(fs.readFileSync(siblingMock, 'utf-8'));
    const inside = JSON.parse(fs.readFileSync(scenarioMock, 'utf-8'));
    expect(sibling.alwaysUseRealApi).toBeUndefined();
    expect(inside.alwaysUseRealApi).toBeUndefined();
  });

  it('rejects scenario ".." so bulk-capture cannot walk outside mock-data', async () => {
    await expect(
      bulkCaptureResponsesForDomain({
        provider: 'filesystem',
        mockDataPath,
        scenario: '..',
        domainPath: 'api.example.com',
      })
    ).rejects.toThrow(/Invalid scenario name/);
  });

  it('still updates mocks inside the named scenario folder', async () => {
    const result = await bulkSetLiveApiForDomain({
      provider: 'filesystem',
      mockDataPath,
      scenario: 'default',
      domainPath: 'api.example.com',
      useLiveApi: true,
    });

    expect(result.updated).toBe(1);
    const inside = JSON.parse(fs.readFileSync(scenarioMock, 'utf-8'));
    const sibling = JSON.parse(fs.readFileSync(siblingMock, 'utf-8'));
    expect(inside.alwaysUseRealApi).toBe(true);
    expect(sibling.alwaysUseRealApi).toBeUndefined();
  });
});
