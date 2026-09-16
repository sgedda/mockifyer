import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import { closeCachedDashboardMockStores } from '../packages/mockifyer-dashboard/src/utils/create-dashboard-mock-store';

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

describe('dashboard override groups API', () => {
  describe('filesystem', () => {
    let tmp: string;
    let server: http.Server;

    beforeEach(async () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-og-fs-'));
      const publicDir = path.join(tmp, 'public');
      const mockDataPath = path.join(tmp, 'mock-data');
      fs.mkdirSync(publicDir, { recursive: true });
      fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
      fs.writeFileSync(
        path.join(mockDataPath, 'scenario-config.json'),
        JSON.stringify({ currentScenario: 'default' })
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

    it('creates a group, sets scenario default, then clears default', async () => {
      const created = await httpJson(server, 'PUT', '/api/override-groups/check-in-open?scenario=default', {
        id: 'check-in-open',
        label: 'Check-in open',
        entries: [],
      });
      expect(created.status).toBe(200);
      expect((created.json.group as { id: string }).id).toBe('check-in-open');

      const activated = await httpJson(server, 'PUT', '/api/override-groups/config?scenario=default', {
        currentGroup: 'check-in-open',
        scope: 'default',
      });
      expect(activated.status).toBe(200);
      expect(activated.json.defaultGroup).toBe('check-in-open');

      const cleared = await httpJson(server, 'PUT', '/api/override-groups/config?scenario=default', {
        currentGroup: null,
        scope: 'default',
      });
      expect(cleared.status).toBe(200);
      expect(cleared.json.defaultGroup).toBeNull();
    });

    it('lets two clientIds pick different groups without changing each other', async () => {
      await httpJson(server, 'PUT', '/api/override-groups/check-in-open?scenario=default', {
        id: 'check-in-open',
        label: 'Open',
        entries: [],
      });
      await httpJson(server, 'PUT', '/api/override-groups/award-trip?scenario=default', {
        id: 'award-trip',
        label: 'Award',
        entries: [],
      });

      const aliceSet = await httpJson(
        server,
        'PUT',
        '/api/override-groups/config?scenario=default&clientId=dev-alice',
        { currentGroup: 'award-trip', scope: 'lane', clientId: 'dev-alice' }
      );
      expect(aliceSet.status).toBe(200);
      expect(aliceSet.json.laneGroup).toBe('award-trip');

      const bobSet = await httpJson(
        server,
        'PUT',
        '/api/override-groups/config?scenario=default&clientId=dev-bob',
        { currentGroup: 'check-in-open', scope: 'lane', clientId: 'dev-bob' }
      );
      expect(bobSet.status).toBe(200);
      expect(bobSet.json.laneGroup).toBe('check-in-open');

      const alice = await httpJson(
        server,
        'GET',
        '/api/override-groups?scenario=default&clientId=dev-alice'
      );
      const bob = await httpJson(
        server,
        'GET',
        '/api/override-groups?scenario=default&clientId=dev-bob'
      );
      expect(alice.json.laneGroup).toBe('award-trip');
      expect(alice.json.currentGroup).toBe('award-trip');
      expect(bob.json.laneGroup).toBe('check-in-open');
      expect(bob.json.currentGroup).toBe('check-in-open');
    });
  });

  (canLoadBetterSqlite3() ? describe : describe.skip)('sqlite (.db path)', () => {
    let tmp: string;
    let server: http.Server;

    beforeEach(async () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-og-sqlite-'));
      const publicDir = path.join(tmp, 'public');
      const dbPath = path.join(tmp, 'mockifyer.db');
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

    it('creates and activates groups when mockDataPath is a .db file', async () => {
      const created = await httpJson(server, 'PUT', '/api/override-groups/award-trip?scenario=default', {
        id: 'award-trip',
        label: 'Award trip',
        entries: [],
      });
      expect(created.status).toBe(200);
      expect(created.json.success).toBe(true);

      const activated = await httpJson(server, 'PUT', '/api/override-groups/config?scenario=default', {
        currentGroup: 'award-trip',
        scope: 'default',
      });
      expect(activated.status).toBe(200);
      expect(activated.json.defaultGroup).toBe('award-trip');

      const listed = await httpJson(server, 'GET', '/api/override-groups?scenario=default');
      expect(listed.status).toBe(200);
      expect(listed.json.defaultGroup).toBe('award-trip');
      expect((listed.json.groups as Array<{ id: string }>).map((g) => g.id)).toContain('award-trip');
    });

    it('lets two client lanes pick different groups without changing each other', async () => {
      await httpJson(server, 'PUT', '/api/override-groups/check-in-open?scenario=default', {
        id: 'check-in-open',
        label: 'Open',
        entries: [],
      });
      await httpJson(server, 'PUT', '/api/override-groups/award-trip?scenario=default', {
        id: 'award-trip',
        label: 'Award',
        entries: [],
      });

      await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/scenario', { scenario: 'default' });
      await httpJson(server, 'PUT', '/api/client-lanes/dev-bob/scenario', { scenario: 'default' });

      const aliceSet = await httpJson(server, 'PUT', '/api/client-lanes/dev-alice/override-group', {
        overrideGroupId: 'award-trip',
      });
      expect(aliceSet.status).toBe(200);

      const bobSet = await httpJson(server, 'PUT', '/api/client-lanes/dev-bob/override-group', {
        overrideGroupId: 'check-in-open',
      });
      expect(bobSet.status).toBe(200);

      const alice = await httpJson(
        server,
        'GET',
        '/api/override-groups?scenario=default&clientId=dev-alice'
      );
      const bob = await httpJson(
        server,
        'GET',
        '/api/override-groups?scenario=default&clientId=dev-bob'
      );
      expect(alice.json.laneGroup).toBe('award-trip');
      expect(alice.json.currentGroup).toBe('award-trip');
      expect(bob.json.laneGroup).toBe('check-in-open');
      expect(bob.json.currentGroup).toBe('check-in-open');
    });
  });
});
