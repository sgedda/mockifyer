import fs from 'fs';
import os from 'os';
import path from 'path';
import type { MockData } from '@sgedda/mockifyer-core';
import { bulkSetLiveApiForDomain, bulkSetReplayModeForFilenames } from '../packages/mockifyer-dashboard/src/utils/bulk-domain-mocks';

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
      queuedRefreshNext: 0,
      skippedPending: 0,
      missing: 0,
    });
    const source = JSON.parse(fs.readFileSync(path.join(scenarioPath, sourceFile), 'utf-8')) as MockData;
    const bff = JSON.parse(fs.readFileSync(path.join(scenarioPath, bffFile), 'utf-8')) as MockData;
    expect(source.alwaysUseRealApi).toBeUndefined();
    expect(bff.alwaysUseRealApi).toBe(true);
  });

  it('queues pending stubs as refresh-next so the next request captures then replays', async () => {
    const scenarioPath = path.join(tmpRoot, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioPath, 'pending.json'),
      JSON.stringify(
        sampleMock({
          responsePending: true,
          alwaysUseRealApi: true,
          response: { status: 0, data: null, headers: {} },
        }),
        null,
        2
      )
    );

    const result = await bulkSetReplayModeForFilenames({
      provider: 'filesystem',
      mockDataPath: tmpRoot,
      scenario: 'default',
      stored: ['pending.json'],
    });

    expect(result.queuedRefreshNext).toBe(1);
    expect(result.updatedStored).toBe(0);
    expect(result.skippedPending).toBe(0);
    const pending = JSON.parse(fs.readFileSync(path.join(scenarioPath, 'pending.json'), 'utf-8')) as MockData;
    expect(pending.responsePending).toBeUndefined();
    expect(pending.alwaysUseRealApi).toBeUndefined();
    expect(pending.refreshOnNextRequest).toBe(true);
  });

  it('patches replay flags without pretty-reprinting a large GraphQL body', async () => {
    const scenarioPath = path.join(tmpRoot, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    const marker = `query Q { ${'n'.repeat(4000)} }`;
    const raw = [
      '{',
      '  "request": { "method": "POST", "url": "http://booking.example/graphql", "headers": {}, "data": { "query": ' +
        JSON.stringify(marker) +
        ' } },',
      '  "response": { "status": 200, "data": { "q": ' + JSON.stringify(marker) + ' }, "headers": {} },',
      '  "timestamp": "2026-01-01T00:00:00.000Z",',
      '  "alwaysUseRealApi": true',
      '}',
    ].join('\n');
    fs.writeFileSync(path.join(scenarioPath, 'graphql.json'), raw);

    const result = await bulkSetReplayModeForFilenames({
      provider: 'filesystem',
      mockDataPath: tmpRoot,
      scenario: 'default',
      stored: ['graphql.json'],
    });

    expect(result.updatedStored).toBe(1);
    const after = fs.readFileSync(path.join(scenarioPath, 'graphql.json'), 'utf-8');
    expect(after).toContain('"request": { "method": "POST"');
    expect(after).toContain(marker);
    expect(after).not.toContain('alwaysUseRealApi');
  });
});

describe('bulkSetLiveApiForDomain', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-bulk-live-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('clears refresh-from-live flags when switching a domain to replay', async () => {
    const scenarioPath = path.join(tmpRoot, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioPath, 'booking.json'),
      JSON.stringify(
        sampleMock({
          alwaysUseRealApi: undefined,
          alwaysRefreshFromLive: true,
        }),
        null,
        2
      )
    );

    const result = await bulkSetLiveApiForDomain({
      provider: 'filesystem',
      mockDataPath: tmpRoot,
      scenario: 'default',
      domainPath: 'booking.example',
      useLiveApi: false,
    });

    expect(result.updated).toBe(1);
    const booking = JSON.parse(fs.readFileSync(path.join(scenarioPath, 'booking.json'), 'utf-8')) as MockData;
    expect(booking.alwaysRefreshFromLive).toBeUndefined();
    expect(booking.alwaysUseRealApi).toBeUndefined();
    expect(booking.refreshOnNextRequest).toBeUndefined();
  });

  it('queues pending stubs as refresh-next instead of skipping them', async () => {
    const scenarioPath = path.join(tmpRoot, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioPath, 'pending.json'),
      JSON.stringify(
        sampleMock({
          responsePending: true,
          alwaysUseRealApi: true,
          response: { status: 0, data: null, headers: {} },
        }),
        null,
        2
      )
    );

    const result = await bulkSetLiveApiForDomain({
      provider: 'filesystem',
      mockDataPath: tmpRoot,
      scenario: 'default',
      domainPath: 'booking.example',
      useLiveApi: false,
    });

    expect(result.updated).toBe(1);
    expect(result.skippedPending).toBe(0);
    const pending = JSON.parse(fs.readFileSync(path.join(scenarioPath, 'pending.json'), 'utf-8')) as MockData;
    expect(pending.responsePending).toBeUndefined();
    expect(pending.alwaysUseRealApi).toBeUndefined();
    expect(pending.refreshOnNextRequest).toBe(true);
  });
});
