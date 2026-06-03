import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import { generateRequestKey, type MockData } from '@sgedda/mockifyer-core';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import { createDashboardMockStore } from '../packages/mockifyer-dashboard/src/utils/create-dashboard-mock-store';
import { SqliteMockKvBackend } from '../packages/mockifyer-dashboard/src/utils/sqlite-mock-kv-backend';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function postJson(port: number, route: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: route,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: raw ? JSON.parse(raw) : null,
          });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('dashboard proxy locked scenarios', () => {
  const testRoot = path.join(__dirname, './test-dashboard-proxy-lock');
  const publicDir = path.join(testRoot, 'public');
  const mockDataPath = path.join(testRoot, 'mock-data');
  const originalFetch = global.fetch;

  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<html></html>', 'utf-8');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it('creates missing SQLite parent directories before opening the database', async () => {
    const dbPath = path.join(testRoot, 'missing', 'nested', 'mockifyer-dashboard.db');
    const backend = new SqliteMockKvBackend(dbPath);

    await backend.ping();
    await backend.close();

    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('does not persist live-capture refreshes when the scenario is locked', async () => {
    const scenario = 'locked-scenario';
    const url = 'https://api.example.com/items';
    const request = { method: 'GET', url, headers: {}, data: undefined, queryParams: undefined };
    const hash = sha256Hex(generateRequestKey(request as any));
    const originalMock: MockData = {
      request,
      response: { status: 200, data: { version: 'old' }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
      refreshOnNextRequest: true,
    };

    const seedStore = createDashboardMockStore({ provider: 'sqlite' }, mockDataPath);
    await seedStore.setByHashInScenario(hash, originalMock, scenario);
    await seedStore.setScenarioLocked(scenario, true);
    await seedStore.close();

    global.fetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async () =>
      new Response(JSON.stringify({ version: 'fresh' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const app = createServer(publicDir, mockDataPath, { provider: 'sqlite' });
    const server = app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await postJson(port, '/api/proxy', {
        url,
        method: 'GET',
        headers: {},
        scenario,
      });

      expect(response.status).toBe(200);
      expect(response.body.response.data).toEqual({ version: 'fresh' });
      expect(response.body.refreshedStoredMock).toBeUndefined();
      expect(response.body.recordedToStore).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => (error ? reject(error) : resolve()));
      });
    }

    const verifyStore = createDashboardMockStore({ provider: 'sqlite' }, mockDataPath);
    const stored = await verifyStore.getByHash(hash, scenario);
    await verifyStore.close();

    expect(stored?.response.data).toEqual({ version: 'old' });
    expect(stored?.refreshOnNextRequest).toBe(true);
  });
});
