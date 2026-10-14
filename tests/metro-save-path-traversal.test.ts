import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createMockSyncMiddleware } from '../packages/mockifyer-fetch/src/metro-sync-middleware';

interface MiddlewareResult {
  status: number;
  body: Record<string, unknown> | null;
}

function invokeMiddleware(
  middleware: (req: unknown, res: unknown, next: () => void) => void,
  method: string,
  url: string,
  jsonBody?: unknown
): Promise<MiddlewareResult> {
  return new Promise((resolve) => {
    const req = new EventEmitter() as EventEmitter & { method: string; url: string };
    req.method = method;
    req.url = url;
    const res = {
      statusCode: 200,
      setHeader(): void {
        /* headers unused */
      },
      end(payload?: string): void {
        resolve({
          status: this.statusCode,
          body: payload ? (JSON.parse(payload) as Record<string, unknown>) : null,
        });
      },
    };
    middleware(req, res, () => resolve({ status: 404, body: null }));
    if (jsonBody !== undefined) {
      req.emit('data', Buffer.from(JSON.stringify(jsonBody)));
    }
    req.emit('end');
  });
}

const safeMock = {
  request: { method: 'GET', url: 'https://api.example.com/health' },
  response: { status: 200, data: { ok: true } },
};

describe('Metro save paths stay inside mock-data', () => {
  let projectRoot: string;
  let mockDataPath: string;
  let prevScenario: string | undefined;
  let middleware: (req: unknown, res: unknown, next: () => void) => void;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metro-save-guard-'));
    mockDataPath = path.join(projectRoot, 'mock-data');
    fs.mkdirSync(mockDataPath, { recursive: true });
    prevScenario = process.env.MOCKIFYER_SCENARIO;
    delete process.env.MOCKIFYER_SCENARIO;
    middleware = createMockSyncMiddleware({
      projectRoot,
      mockDataPath,
      atlasKey: false,
    });
  });

  afterEach(() => {
    if (prevScenario === undefined) delete process.env.MOCKIFYER_SCENARIO;
    else process.env.MOCKIFYER_SCENARIO = prevScenario;
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('writes a proxy mirror under the scenario folder', async () => {
    const result = await invokeMiddleware(middleware, 'POST', '/mockifyer-save', {
      __mockifyerProxyMirror: true,
      scenarioName: 'checkout',
      relativePath: 'redis/abc.json',
      mockData: safeMock,
    });

    expect(result.body).toMatchObject({ success: true, scenario: 'checkout' });
    const written = path.join(mockDataPath, 'checkout', 'redis', 'abc.json');
    expect(fs.existsSync(written)).toBe(true);
    expect(JSON.parse(fs.readFileSync(written, 'utf8')).request.url).toBe(
      'https://api.example.com/health'
    );
  });

  it('rejects a proxy-mirror relativePath that escapes the scenario folder', async () => {
    const result = await invokeMiddleware(middleware, 'POST', '/mockifyer-save', {
      __mockifyerProxyMirror: true,
      scenarioName: 'default',
      relativePath: '../../outside.json',
      mockData: safeMock,
    });

    expect(result.body).toMatchObject({ success: false, error: 'Invalid relativePath' });
    expect(fs.existsSync(path.join(projectRoot, 'outside.json'))).toBe(false);
    expect(fs.existsSync(path.join(mockDataPath, 'default'))).toBe(false);
  });

  it('rejects a proxy-mirror scenarioName that escapes mock-data', async () => {
    const result = await invokeMiddleware(middleware, 'POST', '/mockifyer-save', {
      __mockifyerProxyMirror: true,
      scenarioName: '../outside',
      relativePath: 'redis/abc.json',
      mockData: safeMock,
    });

    expect(result.body).toMatchObject({ success: false, error: 'Invalid scenarioName' });
    expect(fs.existsSync(path.join(projectRoot, 'outside'))).toBe(false);
  });

  it('does not let a poisoned scenario-config redirect ordinary saves outside mock-data', async () => {
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: '../poisoned' })
    );

    const result = await invokeMiddleware(middleware, 'POST', '/mockifyer-save', safeMock);

    expect(result.body).toMatchObject({ success: true, scenario: 'default' });
    expect(fs.existsSync(path.join(projectRoot, 'poisoned'))).toBe(false);
    const saved = fs.readdirSync(path.join(mockDataPath, 'default'), { recursive: true });
    expect(saved.some((name) => String(name).endsWith('.json'))).toBe(true);
  });

  it('rejects scenario-config and domain-path writes that traverse out of mock-data', async () => {
    const scenarioConfig = await invokeMiddleware(
      middleware,
      'POST',
      '/mockifyer-scenario-config',
      { currentScenario: '../../outside' }
    );
    expect(scenarioConfig.status).toBe(400);
    expect(fs.existsSync(path.join(mockDataPath, 'scenario-config.json'))).toBe(false);

    const domainRules = await invokeMiddleware(
      middleware,
      'POST',
      '/mockifyer-domain-path-rules',
      {
        scenario: '../outside-rules',
        upserts: { 'api.example.com': { recordResponses: true } },
      }
    );
    expect(domainRules.status).toBe(400);
    expect(fs.existsSync(path.join(projectRoot, 'outside-rules'))).toBe(false);

    const allowed = await invokeMiddleware(middleware, 'POST', '/mockifyer-domain-path-rules', {
      scenario: 'checkout',
      upserts: { 'api.example.com': { recordResponses: false, autoMock: false } },
    });
    expect(allowed.body).toMatchObject({ success: true, scenario: 'checkout' });
    expect(
      fs.existsSync(path.join(mockDataPath, 'checkout', 'domain-path-rules.json'))
    ).toBe(true);
  });
});
