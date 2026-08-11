import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer as setupAxiosMockifyer } from '@sgedda/mockifyer-axios';
import { setupMockifyer as setupFetchMockifyer } from '@sgedda/mockifyer-fetch';
import {
  MOCKIFYER_TRACE_DATA_KEY,
  MOCKIFYER_TRACE_RESPONSE_KEY,
} from '@sgedda/mockifyer-core';

function makeEnvelope(business: unknown) {
  return {
    [MOCKIFYER_TRACE_DATA_KEY]: business,
    [MOCKIFYER_TRACE_RESPONSE_KEY]: {
      requestId: 'downstream-root',
      hopCount: 0,
      incomplete: false,
      hops: [],
    },
  };
}

function readRecordedMockFiles(mockDataPath: string): any[] {
  const scenarioDir = path.join(mockDataPath, 'default');
  if (!fs.existsSync(scenarioDir)) {
    return [];
  }
  return fs
    .readdirSync(scenarioDir)
    .filter((name) => name.endsWith('.json') && name !== 'date-config.json' && name !== 'domain-path-rules.json')
    .map((name) => JSON.parse(fs.readFileSync(path.join(scenarioDir, name), 'utf8')))
    .filter((obj) => obj && typeof obj === 'object' && obj.request && obj.response);
}

describe('local recordMode strips inline-trace envelopes on save', () => {
  let mockDataPath: string;
  let upstream: MockAdapter | undefined;
  const prevRecordAlwaysLive = process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API;
  const prevDomainPathRulesMode = process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-record-strip-envelope-'));
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
    // Keep fixtures active (not passthrough) so replay can validate stored business data.
    process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';
    // Ungated record/replay — focus this suite on envelope stripping.
    process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE = 'off';
  });

  afterEach(() => {
    upstream?.restore();
    upstream = undefined;
    fs.rmSync(mockDataPath, { recursive: true, force: true });
    if (prevRecordAlwaysLive === undefined) {
      delete process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API;
    } else {
      process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = prevRecordAlwaysLive;
    }
    if (prevDomainPathRulesMode === undefined) {
      delete process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE;
    } else {
      process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE = prevDomainPathRulesMode;
    }
  });

  async function waitForRecordedMock(timeoutMs = 1000): Promise<any[]> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const recorded = readRecordedMockFiles(mockDataPath);
      if (recorded.length > 0) {
        return recorded;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    return readRecordedMockFiles(mockDataPath);
  }

  it('axios saveResponse persists business data when parent is not collecting inline trace', async () => {
    const url = 'https://api.example.test/orders/42';
    const business = { id: 42, status: 'paid' };
    const envelope = makeEnvelope(business);

    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);
    upstream.onGet(url).reply(200, envelope);

    const client = setupAxiosMockifyer({
      mockDataPath,
      recordMode: true,
      failOnMissingMock: false,
      axiosInstance,
    });

    // No ALS hop context — unwrapAndMergeInlineTraceEnvelope leaves the envelope intact.
    const live = await client.get(url);
    expect(live.data).toEqual(envelope);

    // axios saveResponse is fire-and-forget from the response interceptor.
    const recorded = await waitForRecordedMock();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].response.data).toEqual(business);
    expect(recorded[0].response.data).not.toHaveProperty(MOCKIFYER_TRACE_RESPONSE_KEY);

    // Replay must return business payload, not the debug envelope.
    const replaying = setupAxiosMockifyer({
      mockDataPath,
      recordMode: false,
      axiosInstance: axios.create(),
    });
    await (replaying as any).reloadMockData?.();
    const replay = await replaying.get(url);
    expect(replay.data).toEqual(business);
    expect(replay.data).not.toHaveProperty(MOCKIFYER_TRACE_RESPONSE_KEY);
  });

  it('fetch saveResponse persists business data when parent is not collecting inline trace', async () => {
    const url = 'https://api.example.test/catalog/item';
    const business = { sku: 'A-1', stock: 3 };
    const envelope = makeEnvelope(business);

    const originalFetch = global.fetch;
    try {
      delete (global as { __mockifyer_original_fetch?: unknown }).__mockifyer_original_fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => envelope,
        text: async () => JSON.stringify(envelope),
      } as Response);

      const recorder = setupFetchMockifyer({
        mockDataPath,
        recordMode: true,
        useGlobalFetch: false,
      });

      const live = await recorder.get(url);
      expect(live.data).toEqual(envelope);

      const recorded = readRecordedMockFiles(mockDataPath);
      expect(recorded).toHaveLength(1);
      expect(recorded[0].response.data).toEqual(business);
      expect(recorded[0].response.data).not.toHaveProperty(MOCKIFYER_TRACE_RESPONSE_KEY);

      global.fetch = originalFetch;
      delete (global as { __mockifyer_original_fetch?: unknown }).__mockifyer_original_fetch;

      const reader = setupFetchMockifyer({
        mockDataPath,
        recordMode: false,
        useGlobalFetch: false,
      });
      await (reader as any).reloadMockData();
      const replay = await reader.get(url);
      expect(replay.data).toEqual(business);
      expect(replay.data).not.toHaveProperty(MOCKIFYER_TRACE_RESPONSE_KEY);
    } finally {
      global.fetch = originalFetch;
      delete (global as { __mockifyer_original_fetch?: unknown }).__mockifyer_original_fetch;
    }
  });
});
