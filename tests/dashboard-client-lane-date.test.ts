import * as crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { generateRequestKey, type MockData } from '@sgedda/mockifyer-core';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import {
  closeCachedDashboardMockStores,
  createDashboardMockStore,
} from '../packages/mockifyer-dashboard/src/utils/create-dashboard-mock-store';
import type { MockKvBackend } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';

function httpJson(
  server: http.Server,
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: Record<string, unknown> = {};
          try {
            json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode ?? 0, json });
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

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function memoryKv(): MockKvBackend {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const hashes = new Map<string, Map<string, string>>();
  return {
    get: async (key: string) => strings.get(key) ?? null,
    set: async (key: string, value: string) => {
      strings.set(key, value);
    },
    del: async (...keys: string[]) => {
      for (const key of keys) {
        strings.delete(key);
        sets.delete(key);
        hashes.delete(key);
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
    hget: async (key: string, field: string) => hashes.get(key)?.get(field) ?? null,
    hset: async (key: string, field: string, value: string) => {
      const hash = hashes.get(key) ?? new Map<string, string>();
      hash.set(field, value);
      hashes.set(key, hash);
    },
    scanKeys: async (pattern: string) => {
      const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
      return [...strings.keys()].filter((key) => key.startsWith(prefix));
    },
    close: async () => undefined,
  } as unknown as MockKvBackend;
}

describe('RedisMockStore lane date', () => {
  it('round-trips a lane fixedDate and lists it', async () => {
    const store = new RedisMockStore({ kv: memoryKv(), mockDataPath: '/tmp/mockifyer-unused' });
    await store.setLaneScenario('alice', 'default');
    await store.setLaneDateConfig('alice', {
      dateManipulation: { fixedDate: '2025-06-15T12:00:00.000Z' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const listed = await store.listClientLanes();
    expect(listed).toEqual([
      {
        clientId: 'alice',
        scenario: 'default',
        note: null,
        overrideGroupId: null,
        fixedDate: '2025-06-15T12:00:00.000Z',
      },
    ]);

    await store.setLaneDateConfig('alice', null);
    expect((await store.listClientLanes())[0].fixedDate).toBeNull();
  });

  it('clears the lane date when the scenario assignment is removed', async () => {
    const store = new RedisMockStore({ kv: memoryKv(), mockDataPath: '/tmp/mockifyer-unused' });
    await store.setLaneScenario('alice', 'default');
    await store.setLaneDateConfig('alice', {
      dateManipulation: { fixedDate: '2025-06-15T12:00:00.000Z' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.setLaneScenario('alice', null);
    expect(await store.getLaneDateConfig('alice')).toBeNull();
  });

  it('keeps the lane date when switching scenarios', async () => {
    const store = new RedisMockStore({ kv: memoryKv(), mockDataPath: '/tmp/mockifyer-unused' });
    await store.setLaneScenario('alice', 'default');
    await store.setLaneDateConfig('alice', {
      dateManipulation: { fixedDate: '2025-06-15T12:00:00.000Z' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.setLaneScenario('alice', 'other');
    const listed = await store.listClientLanes();
    expect(listed[0]).toMatchObject({ scenario: 'other', fixedDate: '2025-06-15T12:00:00.000Z' });
  });
});

(canLoadBetterSqlite3() ? describe : describe.skip)('client lane current date', () => {
  const BOOKING_URL = 'https://api.example.com/booking';
  let tmp: string;
  let dbPath: string;
  let server: http.Server;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-lane-date-'));
    const publicDir = path.join(tmp, 'public');
    dbPath = path.join(tmp, 'mockifyer.db');
    fs.mkdirSync(publicDir, { recursive: true });
    const app = createServer(publicDir, dbPath, { provider: 'sqlite' });
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

  it('stores and lists a per-lane fixed date', async () => {
    await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/scenario', { scenario: 'default' });
    const setDate = await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/date', {
      fixedDate: '2025-06-15T12:00:00.000Z',
    });
    expect(setDate.status).toBe(200);

    const listed = await httpJson(server, 'GET', '/api/client-lanes');
    expect(listed.status).toBe(200);
    const lanes = listed.json.lanes as Array<{ clientId: string; fixedDate: string | null }>;
    const alice = lanes.find((l) => l.clientId === 'dev-alice');
    expect(alice?.fixedDate).toBe('2025-06-15T12:00:00.000Z');
  });

  it('rejects an invalid fixedDate', async () => {
    await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/scenario', { scenario: 'default' });
    const invalid = await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/date', {
      fixedDate: 'not-a-date',
    });
    expect(invalid.status).toBe(400);
  });

  it('clears a lane date so scenario Date Config applies again', async () => {
    await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/scenario', { scenario: 'default' });
    await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/date', {
      fixedDate: '2025-06-15T12:00:00.000Z',
    });
    const cleared = await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/date', {
      fixedDate: null,
    });
    expect(cleared.status).toBe(200);

    const listed = await httpJson(server, 'GET', '/api/client-lanes');
    const lanes = listed.json.lanes as Array<{ clientId: string; fixedDate: string | null }>;
    expect(lanes.find((l) => l.clientId === 'dev-alice')?.fixedDate).toBeNull();
  });

  it('proxy-serves date overrides using the lane date instead of the scenario date', async () => {
    await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/scenario', { scenario: 'default' });
    await httpJson(server, 'PUT', '/api/client-lanes/dev-bob/scenario', { scenario: 'default' });
    await httpJson(server, 'POST', '/api/date-config', {
      scenario: 'default',
      fixedDate: '2020-01-01T00:00:00.000Z',
    });
    await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/date', {
      fixedDate: '2025-06-15T12:00:00.000Z',
    });

    const mockData: MockData = {
      request: { method: 'GET', url: BOOKING_URL, headers: {}, queryParams: {} },
      response: {
        status: 200,
        data: { expiresAt: '2019-01-01T00:00:00.000Z' },
        headers: {},
      },
      timestamp: '2026-01-01T00:00:00.000Z',
      responseDateOverrides: [{ path: 'expiresAt' }],
    };
    const hash = sha256Hex(
      generateRequestKey({
        method: 'GET',
        url: BOOKING_URL,
        headers: {},
        data: undefined,
        queryParams: undefined,
      })
    );
    const store = createDashboardMockStore({ provider: 'sqlite' }, dbPath);
    await store.setByHashInScenario(hash, mockData, 'default');

    const alice = await httpJson(server, 'POST', '/api/proxy', {
      url: BOOKING_URL,
      method: 'GET',
      headers: {},
      clientId: 'dev-alice',
      record: false,
      allowUpstream: false,
    });
    expect(alice.status).toBe(200);
    const aliceBody = (alice.json.response as { data: { expiresAt: string } }).data;
    expect(aliceBody.expiresAt).toBe('2025-06-15T12:00:00.000Z');

    const bob = await httpJson(server, 'POST', '/api/proxy', {
      url: BOOKING_URL,
      method: 'GET',
      headers: {},
      clientId: 'dev-bob',
      record: false,
      allowUpstream: false,
    });
    expect(bob.status).toBe(200);
    const bobBody = (bob.json.response as { data: { expiresAt: string } }).data;
    expect(bobBody.expiresAt).toBe('2020-01-01T00:00:00.000Z');
    expect(alice.json.dateManipulation).toEqual({ fixedDate: '2025-06-15T12:00:00.000Z' });
    expect(bob.json.dateManipulation).toEqual({ fixedDate: '2020-01-01T00:00:00.000Z' });
  });

  it('GET /api/date-config?clientId= returns the lane date and lane-mapped scenario', async () => {
    await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/scenario', { scenario: 'default' });
    await httpJson(server, 'POST', '/api/date-config', {
      scenario: 'default',
      fixedDate: '2020-01-01T00:00:00.000Z',
    });
    await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/date', {
      fixedDate: '2025-06-15T12:00:00.000Z',
    });

    const forLane = await httpJson(server, 'GET', '/api/date-config?clientId=dev-alice');
    expect(forLane.status).toBe(200);
    expect(forLane.json.scenario).toBe('default');
    expect(forLane.json.configSource).toBe('lane');
    expect(forLane.json.dateManipulation).toEqual({ fixedDate: '2025-06-15T12:00:00.000Z' });

    const scenarioOnly = await httpJson(server, 'GET', '/api/date-config?scenario=default');
    expect(scenarioOnly.json.configSource).toBe('redis');
    expect(scenarioOnly.json.dateManipulation).toEqual({
      fixedDate: '2020-01-01T00:00:00.000Z',
    });
  });
});
