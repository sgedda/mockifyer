import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';

const MOCK_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function makeMockFile(url = 'https://api.example.com/bookings', scenario = 'default') {
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

describe('dashboard scenario delete API', () => {
  let tmp: string;
  let server: http.Server;
  let mockDataPath: string;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenario-delete-'));
    const publicDir = path.join(tmp, 'public');
    mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, 'staging'), { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, 'locked-one'), { recursive: true });
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: 'staging' })
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'default', 'keep.json'),
      JSON.stringify(makeMockFile(), null, 2)
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'staging', 'users.json'),
      JSON.stringify(makeMockFile('https://api.example.com/users', 'staging'), null, 2)
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'staging', 'date-config.json'),
      JSON.stringify({ dateManipulation: { offset: 60 }, updatedAt: MOCK_TIMESTAMP }, null, 2)
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'locked-one', 'scenario-meta.json'),
      JSON.stringify({ locked: true, updatedAt: MOCK_TIMESTAMP }, null, 2)
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

  it('deletes the active scenario and switches to default', async () => {
    const res = await httpRequest(server, '/api/scenario-config/delete', {
      method: 'POST',
      body: { scenario: 'staging' },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as {
      success: boolean;
      currentScenario: string;
      scenarios: string[];
      mocksRemoved: number;
      message: string;
    };
    expect(body.success).toBe(true);
    expect(body.currentScenario).toBe('default');
    expect(body.mocksRemoved).toBe(1);
    expect(body.scenarios).not.toContain('staging');
    expect(body.scenarios).toContain('default');
    expect(fs.existsSync(path.join(mockDataPath, 'staging'))).toBe(false);
    expect(fs.existsSync(path.join(mockDataPath, 'default', 'keep.json'))).toBe(true);
    const config = JSON.parse(fs.readFileSync(path.join(mockDataPath, 'scenario-config.json'), 'utf-8')) as {
      currentScenario: string;
    };
    expect(config.currentScenario).toBe('default');
  });

  it('rejects deleting default, scratch, missing, and locked scenarios', async () => {
    const defaultRes = await httpRequest(server, '/api/scenario-config/delete', {
      method: 'POST',
      body: { scenario: 'default' },
    });
    expect(defaultRes.status).toBe(400);
    expect(JSON.parse(defaultRes.body).error).toMatch(/default scenario/i);

    const scratchRes = await httpRequest(server, '/api/scenario-config/delete', {
      method: 'POST',
      body: { scenario: '_scratch' },
    });
    expect(scratchRes.status).toBe(400);
    expect(JSON.parse(scratchRes.body).error).toMatch(/temporary unscoped/i);

    const missingRes = await httpRequest(server, '/api/scenario-config/delete', {
      method: 'POST',
      body: { scenario: 'does-not-exist' },
    });
    expect(missingRes.status).toBe(404);

    const lockedRes = await httpRequest(server, '/api/scenario-config/delete', {
      method: 'POST',
      body: { scenario: 'locked-one' },
    });
    expect(lockedRes.status).toBe(423);
    expect(fs.existsSync(path.join(mockDataPath, 'locked-one'))).toBe(true);
  });
});
