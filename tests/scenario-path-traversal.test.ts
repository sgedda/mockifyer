import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import {
  getCurrentScenario,
  getScenarioFolderPath,
  parseScenarioName,
  resetScenario,
  saveScenarioConfig,
  setScenarioLaunchOverride,
} from '@sgedda/mockifyer-core';
import { createMockSyncMiddleware } from '@sgedda/mockifyer-fetch/metro-sync-middleware';

describe('scenario path traversal', () => {
  let tmp: string;
  let mockDataPath: string;
  let originalScenario: string | undefined;

  beforeEach(() => {
    originalScenario = process.env.MOCKIFYER_SCENARIO;
    delete process.env.MOCKIFYER_SCENARIO;
    resetScenario();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenario-trav-'));
    mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(mockDataPath, { recursive: true });
  });

  afterEach(() => {
    setScenarioLaunchOverride(null);
    resetScenario();
    fs.rmSync(tmp, { recursive: true, force: true });
    if (originalScenario === undefined) {
      delete process.env.MOCKIFYER_SCENARIO;
    } else {
      process.env.MOCKIFYER_SCENARIO = originalScenario;
    }
  });

  it('parseScenarioName rejects traversal and reserved names', () => {
    expect(parseScenarioName('..')).toBeNull();
    expect(parseScenarioName('../sibling')).toBeNull();
    expect(parseScenarioName('foo/bar')).toBeNull();
    expect(parseScenarioName('pool')).toBeNull();
    expect(parseScenarioName('default')).toBe('default');
    expect(parseScenarioName('lane-a_1')).toBe('lane-a_1');
  });

  it('ignores traversal in MOCKIFYER_SCENARIO and scenario-config.json', () => {
    process.env.MOCKIFYER_SCENARIO = '..';
    expect(getCurrentScenario(mockDataPath)).toBe('default');

    delete process.env.MOCKIFYER_SCENARIO;
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: '../..' })
    );
    expect(getCurrentScenario(mockDataPath)).toBe('default');
  });

  it('keeps getScenarioFolderPath inside mockDataPath for traversal names', () => {
    const escaped = getScenarioFolderPath(mockDataPath, '..');
    const root = path.resolve(mockDataPath);
    expect(path.resolve(escaped)).toBe(path.join(root, 'default'));
    expect(path.resolve(escaped).startsWith(root + path.sep) || path.resolve(escaped) === root).toBe(
      true
    );
  });

  it('saveScenarioConfig rejects traversal names', () => {
    expect(() => saveScenarioConfig(mockDataPath, '..')).toThrow(/Invalid scenario name/);
    expect(fs.existsSync(path.join(mockDataPath, 'scenario-config.json'))).toBe(false);
  });

  it('setScenarioLaunchOverride rejects traversal names', () => {
    expect(() => setScenarioLaunchOverride('..')).toThrow(/Invalid scenario name/);
  });
});

describe('Metro POST /mockifyer-scenario-config', () => {
  let tmp: string;
  let projectRoot: string;
  let mockDataPath: string;
  let originalScenario: string | undefined;

  beforeEach(() => {
    originalScenario = process.env.MOCKIFYER_SCENARIO;
    delete process.env.MOCKIFYER_SCENARIO;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-metro-scen-'));
    projectRoot = tmp;
    mockDataPath = path.join(projectRoot, 'mock-data');
    fs.mkdirSync(mockDataPath, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    if (originalScenario === undefined) {
      delete process.env.MOCKIFYER_SCENARIO;
    } else {
      process.env.MOCKIFYER_SCENARIO = originalScenario;
    }
  });

  function invokeMiddleware(
    middleware: (req: any, res: any, next: () => void) => void,
    method: string,
    url: string,
    body?: string
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve) => {
      const req = new EventEmitter() as EventEmitter & { method: string; url: string };
      req.method = method;
      req.url = url;
      const chunks: Buffer[] = [];
      const res = {
        statusCode: 200,
        setHeader: () => undefined,
        end: (payload?: string | Buffer) => {
          resolve({
            statusCode: res.statusCode,
            body: payload == null ? Buffer.concat(chunks).toString('utf8') : String(payload),
          });
        },
      };
      middleware(req, res, () => {
        resolve({ statusCode: 404, body: '' });
      });
      if (body != null) {
        req.emit('data', Buffer.from(body));
      }
      req.emit('end');
    });
  }

  it('rejects currentScenario traversal and does not write the config file', async () => {
    const middleware = createMockSyncMiddleware({
      projectRoot,
      mockDataPath: 'mock-data',
    });
    const result = await invokeMiddleware(
      middleware,
      'POST',
      '/mockifyer-scenario-config',
      JSON.stringify({ currentScenario: '..' })
    );
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).success).toBe(false);
    expect(fs.existsSync(path.join(mockDataPath, 'scenario-config.json'))).toBe(false);
  });

  it('accepts a safe scenario name', async () => {
    const middleware = createMockSyncMiddleware({
      projectRoot,
      mockDataPath: 'mock-data',
    });
    const result = await invokeMiddleware(
      middleware,
      'POST',
      '/mockifyer-scenario-config',
      JSON.stringify({ currentScenario: 'checkout-open' })
    );
    expect(result.statusCode).toBe(200);
    const written = JSON.parse(
      fs.readFileSync(path.join(mockDataPath, 'scenario-config.json'), 'utf-8')
    );
    expect(written.currentScenario).toBe('checkout-open');
  });

  it('GET ignores a poisoned traversal currentScenario', async () => {
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: '../..' })
    );
    const middleware = createMockSyncMiddleware({
      projectRoot,
      mockDataPath: 'mock-data',
    });
    const result = await invokeMiddleware(middleware, 'GET', '/mockifyer-scenario-config');
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).currentScenario).toBe('default');
  });
});
