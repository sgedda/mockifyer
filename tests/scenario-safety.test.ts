import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import {
  getCurrentScenario,
  getScenarioFolderPath,
  normalizeMockRelativePath,
  resetScenario,
  ENV_VARS,
  MockData,
} from '@sgedda/mockifyer-core';
import { FilesystemProvider } from '../packages/mockifyer-core/src/providers/filesystem-provider';
import { createMockSyncMiddleware } from '../packages/mockifyer-fetch/src/metro-sync-middleware';

const mockRedisInstances: Array<{
  get: jest.Mock;
  set: jest.Mock;
  sadd: jest.Mock;
  quit: jest.Mock;
}> = [];

const mockRedisConstructor = jest.fn().mockImplementation(() => {
  const client = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    sadd: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  mockRedisInstances.push(client);
  return client;
});

jest.mock('ioredis', () => mockRedisConstructor, { virtual: true });

function makeMock(url = 'https://api.example.com/users'): MockData {
  return {
    request: {
      method: 'GET',
      url,
      headers: {},
      queryParams: {},
    },
    response: {
      status: 200,
      data: { ok: true },
      headers: {},
    },
    timestamp: '2026-05-19T00:00:00.000Z',
  };
}

function invokeMetroPost(middleware: ReturnType<typeof createMockSyncMiddleware>, body: unknown) {
  return new Promise<{ statusCode: number; payload: any }>((resolve) => {
    const req = new PassThrough() as any;
    req.method = 'POST';
    req.url = '/mockifyer-save';

    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      end: jest.fn((raw: string) => {
        resolve({
          statusCode: res.statusCode,
          payload: JSON.parse(raw),
        });
      }),
    };

    middleware(req, res, () => undefined);
    req.end(JSON.stringify(body));
  });
}

describe('scenario and mirror path safety', () => {
  const originalScenario = process.env[ENV_VARS.MOCK_SCENARIO];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-safety-'));
    mockRedisInstances.length = 0;
    mockRedisConstructor.mockClear();
    resetScenario();
    delete process.env[ENV_VARS.MOCK_SCENARIO];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetScenario();
    if (originalScenario === undefined) {
      delete process.env[ENV_VARS.MOCK_SCENARIO];
    } else {
      process.env[ENV_VARS.MOCK_SCENARIO] = originalScenario;
    }
  });

  it('does not use invalid scenario names from env or filesystem paths', () => {
    process.env[ENV_VARS.MOCK_SCENARIO] = '../escape';

    expect(getCurrentScenario(tmpDir)).toBe('default');
    expect(() => getScenarioFolderPath(tmpDir, '../escape')).toThrow('Invalid scenario');
  });

  it('rejects traversal relative paths before filesystem writes', () => {
    const provider = new FilesystemProvider({ path: tmpDir });
    provider.initialize();

    expect(() =>
      provider.save(makeMock(), {
        scenario: 'default',
        relativePath: '../escape.json',
      })
    ).toThrow('Invalid mock relative path');

    expect(fs.existsSync(path.join(tmpDir, '..', 'escape.json'))).toBe(false);
    expect(normalizeMockRelativePath('redis/abc.json')).toBe('redis/abc.json');
  });

  it('rejects traversal proxy mirror envelopes in Metro middleware', async () => {
    const middleware = createMockSyncMiddleware({ projectRoot: tmpDir, mockDataPath: 'mock-data' });
    const result = await invokeMetroPost(middleware, {
      __mockifyerProxyMirror: true,
      scenarioName: 'default',
      relativePath: '../../../escape.json',
      mockData: makeMock(),
    });

    expect(result.statusCode).toBe(200);
    expect(result.payload.success).toBe(false);
    expect(result.payload.error).toContain('Invalid mock relative path');
    expect(fs.existsSync(path.join(tmpDir, 'escape.json'))).toBe(false);
  });

  it('honors SaveMockOptions.scenario in Redis provider writes', async () => {
    const { RedisProvider } = await import('../packages/mockifyer-core/src/providers/redis-provider');
    const provider = new RedisProvider({
      path: 'redis://localhost:6379',
      options: { mockDataPath: tmpDir },
    });

    await provider.save(makeMock(), { scenario: 'checkout' });

    const redis = mockRedisInstances[0];
    expect(redis.set.mock.calls[0][0]).toContain(':mock:checkout:');
    expect(redis.sadd.mock.calls[0][0]).toBe('mockifyer:v1:index:checkout');
  });
});
