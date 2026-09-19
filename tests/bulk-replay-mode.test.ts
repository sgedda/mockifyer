import fs from 'fs';
import os from 'os';
import path from 'path';
import type { MockData } from '@sgedda/mockifyer-core';
import { bulkSetReplayModeForFilenames } from '../packages/mockifyer-dashboard/src/utils/bulk-domain-mocks';

function sampleMock(overrides: Partial<MockData> = {}): MockData {
  return {
    request: {
      method: 'GET',
      url: 'http://booking.example/api/booking/1',
      headers: {},
    },
    response: { status: 200, data: { ok: true }, headers: {} },
    timestamp: '2026-01-01T00:00:00.000Z',
    alwaysUseRealApi: true,
    ...overrides,
  };
}

describe('bulkSetReplayModeForFilenames', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-bulk-replay-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('sets stored mock on source files and live API on parent files', async () => {
    const scenarioPath = path.join(tmpRoot, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    const sourceFile = 'booking.json';
    const bffFile = 'graphql.json';
    fs.writeFileSync(path.join(scenarioPath, sourceFile), JSON.stringify(sampleMock(), null, 2));
    fs.writeFileSync(
      path.join(scenarioPath, bffFile),
      JSON.stringify(sampleMock({ alwaysUseRealApi: undefined }), null, 2)
    );

    const result = await bulkSetReplayModeForFilenames({
      provider: 'filesystem',
      mockDataPath: tmpRoot,
      scenario: 'default',
      stored: [sourceFile],
      passthrough: [bffFile],
    });

    expect(result).toMatchObject({
      updatedStored: 1,
      updatedLive: 1,
      skippedPending: 0,
      missing: 0,
    });
    const source = JSON.parse(fs.readFileSync(path.join(scenarioPath, sourceFile), 'utf-8')) as MockData;
    const bff = JSON.parse(fs.readFileSync(path.join(scenarioPath, bffFile), 'utf-8')) as MockData;
    expect(source.alwaysUseRealApi).toBeUndefined();
    expect(bff.alwaysUseRealApi).toBe(true);
  });

  it('skips pending stubs when switching to stored mock', async () => {
    const scenarioPath = path.join(tmpRoot, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioPath, 'pending.json'),
      JSON.stringify(sampleMock({ responsePending: true }), null, 2)
    );

    const result = await bulkSetReplayModeForFilenames({
      provider: 'filesystem',
      mockDataPath: tmpRoot,
      scenario: 'default',
      stored: ['pending.json'],
    });

    expect(result.skippedPending).toBe(1);
    expect(result.updatedStored).toBe(0);
    const pending = JSON.parse(fs.readFileSync(path.join(scenarioPath, 'pending.json'), 'utf-8')) as MockData;
    expect(pending.responsePending).toBe(true);
  });
});
