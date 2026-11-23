/**
 * End-to-end: real Node HTTP SSE server → mockifyer-fetch record (direct, no proxy)
 * → background save after duration cap → replay with stream pacing.
 */

import http from 'http';
import type { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { setupMockifyer } from '../packages/mockifyer-fetch/src/index';
import type { MockData } from '../packages/mockifyer-core/src/types';

const CHUNK_A = 'event: a\ndata: one\n\n';
const CHUNK_B = 'event: b\ndata: two\n\n';

function collectJsonMocks(dir: string): Array<{ filePath: string; data: MockData }> {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out: Array<{ filePath: string; data: MockData }> = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'domain-path-rules') {
          continue;
        }
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.json')) {
        continue;
      }
      try {
        const parsed = JSON.parse(fs.readFileSync(full, 'utf8')) as MockData;
        if (parsed?.request && parsed?.response) {
          out.push({ filePath: full, data: parsed });
        }
      } catch {
        // ignore non-mock json
      }
    }
  };
  walk(dir);
  return out;
}

async function waitForStreamMock(
  mockDataPath: string,
  opts: { truncated?: boolean; timeoutMs?: number } = {}
): Promise<MockData> {
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const mocks = collectJsonMocks(mockDataPath);
    const hit = mocks.find((m) => {
      const stream = m.data.response?.stream;
      if (!stream || !Array.isArray(stream.chunks) || stream.chunks.length === 0) {
        return false;
      }
      if (opts.truncated === true && stream.truncated !== true) {
        return false;
      }
      return true;
    });
    if (hit) {
      return hit.data;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(
    `Timed out waiting for stream mock under ${mockDataPath} (truncated=${String(opts.truncated)})`
  );
}

async function readResponseText(response: Response): Promise<string> {
  return response.text();
}

function restoreOriginalFetch(): void {
  const g = global as any;
  if (g.__mockifyer_original_fetch) {
    global.fetch = g.__mockifyer_original_fetch;
    delete g.__mockifyer_original_fetch;
  }
}

describe('SSE stream record/replay E2E (direct mode)', () => {
  let server: Server;
  let serverPort: number;
  let testMockDataPath: string;
  let prevDomainPathRulesMode: string | undefined;
  let prevRecordAlwaysLive: string | undefined;
  let prevScenario: string | undefined;
  let openResponses: http.ServerResponse[] = [];

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      if (req.url === '/sse/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(CHUNK_A);
        setTimeout(() => {
          if (!res.writableEnded) {
            res.write(CHUNK_B);
          }
        }, 20);
        // Stay open (quiet SSE) — recording should hit the duration cap.
        openResponses.push(res);
        return;
      }
      if (req.url === '/sse/finite') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(CHUNK_A);
        res.write(CHUNK_B);
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, () => {
      serverPort = (server.address() as { port: number }).port;
      done();
    });
  });

  afterAll((done) => {
    for (const res of openResponses) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
    openResponses = [];
    server.close(done);
  });

  beforeEach(() => {
    prevDomainPathRulesMode = process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE;
    prevRecordAlwaysLive = process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API;
    prevScenario = process.env.MOCKIFYER_SCENARIO;
    process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE = 'off';
    process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';
    process.env.MOCKIFYER_SCENARIO = 'default';

    testMockDataPath = path.join(
      __dirname,
      `../temp-sse-mocks-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(testMockDataPath, { recursive: true });

    restoreOriginalFetch();
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 50));
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true, force: true });
    }
    restoreOriginalFetch();
    if (prevDomainPathRulesMode === undefined) {
      delete process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE;
    } else {
      process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE = prevDomainPathRulesMode;
    }
    if (prevRecordAlwaysLive === undefined) {
      delete process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API;
    } else {
      process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = prevRecordAlwaysLive;
    }
    if (prevScenario === undefined) {
      delete process.env.MOCKIFYER_SCENARIO;
    } else {
      process.env.MOCKIFYER_SCENARIO = prevScenario;
    }
  });

  it(
    'records a finite SSE stream and replays chunk order for immediate and accelerated',
    async () => {
    const url = `http://127.0.0.1:${serverPort}/sse/finite`;
    setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: true,
      recordResponses: true,
      useGlobalFetch: true,
      defaultScenario: 'default',
      streamReplay: 'immediate',
      streamRecordMaxDurationMs: 5_000,
      streamRecordMaxBytes: 1_000_000,
    });

    const live = await fetch(url);
    expect(live.headers.get('content-type')).toMatch(/text\/event-stream/);
    const liveText = await readResponseText(live);
    expect(liveText).toBe(`${CHUNK_A}${CHUNK_B}`);

    const saved = await waitForStreamMock(testMockDataPath, { truncated: false });
    expect(saved.response.data).toBe(`${CHUNK_A}${CHUNK_B}`);
    expect(saved.response.stream?.kind).toBe('sse');
    expect(saved.response.stream?.chunks.map((c) => c.data).join('')).toBe(
      `${CHUNK_A}${CHUNK_B}`
    );

    restoreOriginalFetch();

    const immediateClient = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: true,
      defaultScenario: 'default',
      streamReplay: 'immediate',
    });
    await (immediateClient as { reloadMockData: () => Promise<void> }).reloadMockData();
    const immediateRes = await fetch(url);
    expect(immediateRes.headers.get('x-mockifyer')).toBe('true');
    expect(await immediateRes.text()).toBe(`${CHUNK_A}${CHUNK_B}`);

    restoreOriginalFetch();

    const acceleratedClient = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: true,
      defaultScenario: 'default',
      streamReplay: 'accelerated',
    });
    await (acceleratedClient as { reloadMockData: () => Promise<void> }).reloadMockData();
    const acceleratedRes = await fetch(url);
    expect(acceleratedRes.body).toBeInstanceOf(ReadableStream);
    expect(await acceleratedRes.text()).toBe(`${CHUNK_A}${CHUNK_B}`);
  },
    15_000
  );

  it(
    'saves a truncated recording when the SSE server goes quiet after early chunks',
    async () => {
    const url = `http://127.0.0.1:${serverPort}/sse/events`;
    const durationCapMs = 150;

    setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: true,
      recordResponses: true,
      useGlobalFetch: true,
      defaultScenario: 'default',
      streamReplay: 'immediate',
      streamRecordMaxDurationMs: durationCapMs,
      streamRecordMaxBytes: 1_000_000,
    });

    const live = await fetch(url);
    // Consume (and eventually cancel) the live branch so tee backpressure does not
    // stall the recording branch while the upstream stays open and quiet.
    const liveReader = live.body!.getReader();
    const liveConsume = (async () => {
      const decoder = new TextDecoder();
      let text = '';
      const deadline = Date.now() + durationCapMs + 400;
      while (Date.now() < deadline) {
        const result = await Promise.race([
          liveReader.read(),
          new Promise<{ done: true; value?: undefined }>((resolve) =>
            setTimeout(() => resolve({ done: true }), 50)
          ),
        ]);
        if (result.done) {
          break;
        }
        if (result.value) {
          text += decoder.decode(result.value, { stream: true });
        }
      }
      try {
        await liveReader.cancel('test-done');
      } catch {
        // ignore
      }
      return text;
    })();

    const saved = await waitForStreamMock(testMockDataPath, {
      truncated: true,
      timeoutMs: 4_000,
    });
    const liveText = await liveConsume;

    expect(liveText).toContain('event: a');
    expect(saved.response.stream?.truncated).toBe(true);
    expect(saved.response.stream?.kind).toBe('sse');
    expect(String(saved.response.data)).toContain('event: a');
    expect(saved.response.stream?.chunks.some((c) => c.data.includes('event: a'))).toBe(true);

    restoreOriginalFetch();

    const replay = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: true,
      defaultScenario: 'default',
      streamReplay: 'immediate',
    });
    await (replay as { reloadMockData: () => Promise<void> }).reloadMockData();
    const replayed = await fetch(url);
    expect(replayed.headers.get('x-mockifyer')).toBe('true');
    const replayText = await replayed.text();
    expect(replayText).toBe(String(saved.response.data));
    expect(replayText).toContain('event: a');
  },
    15_000
  );
});
