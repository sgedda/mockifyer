import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { generateRequestKey, listScenarios, resolveMockReplayMode, type MockData } from '@sgedda/mockifyer-core';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import {
  closeCachedDashboardMockStores,
  createDashboardMockStore,
} from '../packages/mockifyer-dashboard/src/utils/create-dashboard-mock-store';
import type { MockKvBackend } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';

const MOCK_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function makeMockFile(url = 'https://api.example.com/bookings', scenario = 'default'): MockData {
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
    timestamp: MOCK_TIMESTAMP,
    scenario,
  };
}

function httpRequest(
  server: http.Server,
  urlPath: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    const payload = options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: options.method ?? 'GET',
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function canLoadBetterSqlite3(): boolean {
  try {
    const Database = require('../packages/mockifyer-dashboard/node_modules/better-sqlite3') as new (
      filename: string
    ) => { close: () => void };
    const probe = new Database(':memory:');
    probe.close();
    return true;
  } catch {
    return false;
  }
}

describe('dashboard scenario create from existing (filesystem)', () => {
  let tmp: string;
  let server: http.Server;
  let mockDataPath: string;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenario-create-'));
    const publicDir = path.join(tmp, 'public');
    mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
    fs.writeFileSync(
      path.join(mockDataPath, 'default', 'bookings.json'),
      JSON.stringify(makeMockFile(), null, 2)
    );

    const app = createServer(publicDir, mockDataPath, { provider: 'filesystem' });
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('copies mocks from the source scenario and resets replay to live API', async () => {
    const res = await httpRequest(server, '/api/scenario-config/create', {
      method: 'POST',
      body: { scenario: 'check-in-open', deriveFrom: 'default' },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; currentScenario: string; scenarios: string[] };
    expect(body.success).toBe(true);
    expect(body.currentScenario).toBe('check-in-open');
    expect(body.scenarios).toContain('check-in-open');

    const destFile = path.join(mockDataPath, 'check-in-open', 'bookings.json');
    expect(fs.existsSync(destFile)).toBe(true);
    const cloned = JSON.parse(fs.readFileSync(destFile, 'utf-8')) as MockData;
    expect(cloned.response.data).toEqual({ ok: true });
    expect(resolveMockReplayMode(cloned)).toBe('passthrough');
  });

  it('creates from listed default even when the default folder is missing', async () => {
    fs.rmSync(path.join(mockDataPath, 'default'), { recursive: true, force: true });
    expect(listScenarios(mockDataPath)).toContain('default');

    const res = await httpRequest(server, '/api/scenario-config/create', {
      method: 'POST',
      body: { scenario: 'from-empty-default', deriveFrom: 'default' },
    });
    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(mockDataPath, 'from-empty-default'))).toBe(true);
  });
});

describe('dashboard scenario create from existing (sqlite db path)', () => {
  it('does not throw when mockDataPath is a .db file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-list-scenarios-'));
    try {
      const dbFile = path.join(tmp, 'store.db');
      fs.writeFileSync(dbFile, '');
      expect(listScenarios(dbFile)).toEqual(['default', '_scratch']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('RedisMockStore.cloneScenario', () => {
  it('copies mocks without Redis MULTI (cluster CROSSSLOT-safe)', async () => {
    const strings = new Map<string, string>();
    const sets = new Map<string, Set<string>>();
    const kv = {
      get: async (key: string) => strings.get(key) ?? null,
      set: async (key: string, value: string) => {
        strings.set(key, value);
      },
      del: async (...keys: string[]) => {
        for (const key of keys) {
          strings.delete(key);
          sets.delete(key);
        }
      },
      mget: async (keys: string[]) => keys.map((key) => strings.get(key) ?? null),
      sadd: async (key: string, ...members: string[]) => {
        const set = sets.get(key) ?? new Set<string>();
        for (const member of members) set.add(member);
        sets.set(key, set);
      },
      smembers: async (key: string) => [...(sets.get(key) ?? [])],
      srem: async (key: string, ...members: string[]) => {
        const set = sets.get(key);
        if (!set) return;
        for (const member of members) set.delete(member);
      },
      hset: async () => undefined,
      hsetMany: async () => undefined,
      close: async () => undefined,
    };
    const store = new RedisMockStore({
      kv: kv as unknown as MockKvBackend,
      mockDataPath: '/tmp/mockifyer-unused',
    });
    const mock = makeMockFile();
    const hash = generateRequestKey(mock.request);
    await store.setByHash(hash, mock, 'default');

    const result = await store.cloneScenario('default', 'derived');
    expect(result.mocksCopied).toBe(1);

    const cloned = await store.getByHash(hash, 'derived');
    expect(cloned?.response.data).toEqual({ ok: true });
    expect(resolveMockReplayMode(cloned as MockData)).toBe('passthrough');
  });
});

(canLoadBetterSqlite3() ? describe : describe.skip)(
  'dashboard scenario create from existing (sqlite)',
  () => {
    let tmp: string;
    let server: http.Server;
    let mockDataPath: string;

    beforeEach(async () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenario-create-sqlite-'));
      const publicDir = path.join(tmp, 'public');
      mockDataPath = path.join(tmp, 'mock-data');
      fs.mkdirSync(publicDir, { recursive: true });
      fs.mkdirSync(mockDataPath, { recursive: true });
      const app = createServer(publicDir, mockDataPath, { provider: 'sqlite' });
      server = await new Promise<http.Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
    });

    afterEach(async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await closeCachedDashboardMockStores();
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('derives from default even when Redis/SQLite has no registry entry yet', async () => {
      const res = await httpRequest(server, '/api/scenario-config/create', {
        method: 'POST',
        body: { scenario: 'check-in-open', deriveFrom: 'default' },
      });
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body) as { success: boolean; currentScenario: string };
      expect(body.success).toBe(true);
      expect(body.currentScenario).toBe('check-in-open');
    });

    it('copies sqlite mocks into the new scenario', async () => {
      const mock = makeMockFile();
      const hash = generateRequestKey(mock.request);
      const store = createDashboardMockStore({ provider: 'sqlite' }, mockDataPath);
      await store.setByHash(hash, mock, 'default');

      const res = await httpRequest(server, '/api/scenario-config/create', {
        method: 'POST',
        body: { scenario: 'copied', deriveFrom: 'default' },
      });
      expect(res.status).toBe(200);

      const cloned = await store.getByHash(hash, 'copied');
      expect(cloned).toBeTruthy();
      expect(cloned?.response.data).toEqual({ ok: true });
      expect(resolveMockReplayMode(cloned as MockData)).toBe('passthrough');
    });
  }
);
