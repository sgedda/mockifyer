import fs from 'fs';
import os from 'os';
import path from 'path';
import { createMockSyncMiddleware } from '../packages/mockifyer-fetch/src/metro-sync-middleware';

const SAMPLE_MOCK = {
  request: { method: 'GET', url: 'https://api.example.com/users', headers: {}, queryParams: {} },
  response: { status: 200, data: { ok: true }, headers: {} },
};

interface MiddlewareResult {
  statusCode: number;
  body: Record<string, unknown>;
}

function invokeMiddleware(
  mw: (req: unknown, res: unknown, next: () => void) => void,
  options: { method: string; url: string; body?: unknown }
): Promise<MiddlewareResult> {
  return new Promise((resolve) => {
    const listeners: Record<string, Array<(arg?: Buffer) => void>> = { data: [], end: [] };
    const req = {
      method: options.method,
      url: options.url,
      on(event: string, cb: (arg?: Buffer) => void) {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(cb);
      },
    };
    let statusCode = 200;
    const res = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(value: number) {
        statusCode = value;
      },
      setHeader() {
        /* unused */
      },
      end(data: string) {
        resolve({ statusCode, body: JSON.parse(data) as Record<string, unknown> });
      },
    };
    mw(req, res, () => {
      resolve({ statusCode: 404, body: { next: true } });
    });
    if (options.body !== undefined) {
      const raw = JSON.stringify(options.body);
      queueMicrotask(() => {
        for (const cb of listeners.data) {
          cb(Buffer.from(raw));
        }
        for (const cb of listeners.end) {
          cb();
        }
      });
    }
  });
}

describe('Metro sync path traversal', () => {
  let tmpDir: string;
  let mockDataPath: string;
  let mw: ReturnType<typeof createMockSyncMiddleware>;
  const previousScenario = process.env.MOCKIFYER_SCENARIO;

  beforeEach(() => {
    delete process.env.MOCKIFYER_SCENARIO;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-metro-'));
    mockDataPath = path.join(tmpDir, 'mock-data');
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
    mw = createMockSyncMiddleware({ projectRoot: tmpDir, mockDataPath: 'mock-data' });
  });

  afterEach(() => {
    if (previousScenario === undefined) {
      delete process.env.MOCKIFYER_SCENARIO;
    } else {
      process.env.MOCKIFYER_SCENARIO = previousScenario;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects proxy-mirror relativePath that escapes the scenario folder', async () => {
    const sentinel = path.join(tmpDir, 'package.json');
    fs.writeFileSync(sentinel, '{"name":"keep-me"}');

    const result = await invokeMiddleware(mw, {
      method: 'POST',
      url: '/mockifyer-save',
      body: {
        __mockifyerProxyMirror: true,
        scenarioName: 'default',
        relativePath: '../../package.json',
        mockData: SAMPLE_MOCK,
      },
    });

    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
    expect(fs.readFileSync(sentinel, 'utf-8')).toBe('{"name":"keep-me"}');
  });

  it('rejects proxy-mirror scenarioName that escapes mock-data', async () => {
    const sentinel = path.join(tmpDir, 'package.json');
    fs.writeFileSync(sentinel, '{"name":"keep-me"}');

    const result = await invokeMiddleware(mw, {
      method: 'POST',
      url: '/mockifyer-save',
      body: {
        __mockifyerProxyMirror: true,
        scenarioName: '..',
        relativePath: 'package.json',
        mockData: SAMPLE_MOCK,
      },
    });

    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
    expect(fs.readFileSync(sentinel, 'utf-8')).toBe('{"name":"keep-me"}');
  });

  it('still writes a legitimate redis/<hash>.json proxy-mirror file', async () => {
    const hash = 'a'.repeat(64);
    const result = await invokeMiddleware(mw, {
      method: 'POST',
      url: '/mockifyer-save',
      body: {
        __mockifyerProxyMirror: true,
        scenarioName: 'default',
        relativePath: `redis/${hash}.json`,
        mockData: SAMPLE_MOCK,
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    const written = path.join(mockDataPath, 'default', 'redis', `${hash}.json`);
    expect(fs.existsSync(written)).toBe(true);
    expect(JSON.parse(fs.readFileSync(written, 'utf-8')).request.url).toBe(
      'https://api.example.com/users'
    );
  });

  it('rejects domain-path-rules POST scenario that escapes mock-data', async () => {
    const escaped = path.join(tmpDir, 'domain-path-rules.json');

    const result = await invokeMiddleware(mw, {
      method: 'POST',
      url: '/mockifyer-domain-path-rules',
      body: {
        scenario: '..',
        upserts: { 'evil.example.com': { recordResponses: true } },
      },
    });

    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
    expect(fs.existsSync(escaped)).toBe(false);
  });

  it('rejects domain-path-rules GET scenario that escapes mock-data', async () => {
    const result = await invokeMiddleware(mw, {
      method: 'GET',
      url: '/mockifyer-domain-path-rules?scenario=..',
    });

    expect(result.statusCode).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it('merges domain-path-rules POST into the named scenario folder', async () => {
    const result = await invokeMiddleware(mw, {
      method: 'POST',
      url: '/mockifyer-domain-path-rules',
      body: {
        scenario: 'default',
        upserts: { 'api.example.com': { recordResponses: true } },
      },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.success).toBe(true);
    const rulesPath = path.join(mockDataPath, 'default', 'domain-path-rules.json');
    expect(fs.existsSync(rulesPath)).toBe(true);
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8')) as {
      'api.example.com': { recordResponses: boolean };
    };
    expect(rules['api.example.com'].recordResponses).toBe(true);
  });
});
