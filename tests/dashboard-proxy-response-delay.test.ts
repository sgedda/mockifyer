import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';

const SCENARIO = 'delay-test';
const URL = 'https://api.example.com/slow';
const DELAY_MS = 300;
const NO_DELAY_BUDGET_MS = 150;

function postJson(
  server: http.Server,
  urlPath: string,
  body: unknown
): Promise<{ status: number; json: any; ms: number }> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    const payload = JSON.stringify(body);
    const started = Date.now();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            json: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            ms: Date.now() - started,
          });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('POST /api/proxy mock hit with responseDelayMs', () => {
  let tmp: string;
  let server: http.Server;

  const proxyHit = () =>
    postJson(server, '/api/proxy', { url: URL, method: 'GET', scenario: SCENARIO, allowUpstream: false });

  async function seedMock(extra: Record<string, unknown>): Promise<void> {
    const probe = await proxyHit();
    const imported = await postJson(server, '/api/scenario-config/import', {
      targetScenario: SCENARIO,
      replaceExistingMocks: true,
      applyDateConfig: false,
      applyProxyConfig: false,
      applyDomainPathRules: false,
      bundle: {
        formatVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        sourceScenario: SCENARIO,
        mocks: [
          {
            relativePath: `redis/${probe.json.hash}.json`,
            data: {
              request: { method: 'GET', url: URL, headers: {}, queryParams: {} },
              response: { status: 200, data: { ok: true }, headers: {} },
              timestamp: '2026-01-01T00:00:00.000Z',
              scenario: SCENARIO,
              ...extra,
            },
          },
        ],
      },
    });
    expect(imported.status).toBe(200);
  }

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-proxy-delay-'));
    const publicDir = path.join(tmp, 'public');
    const mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(mockDataPath, { recursive: true });
    const app = createServer(publicDir, mockDataPath, { provider: 'sqlite' });
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    await postJson(server, '/api/scenario-config/create', { scenario: SCENARIO });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('waits responseDelayMs before serving the hit, with the statusOverride', async () => {
    await seedMock({ statusOverride: 503, responseDelayMs: DELAY_MS });
    const r = await proxyHit();
    expect(r.json.source).toBe('redis');
    expect(r.json.response.status).toBe(503);
    expect(r.ms).toBeGreaterThanOrEqual(DELAY_MS);
  });

  it('serves a hit without responseDelayMs immediately', async () => {
    await seedMock({});
    const r = await proxyHit();
    expect(r.json.source).toBe('redis');
    expect(r.json.response.status).toBe(200);
    expect(r.ms).toBeLessThan(NO_DELAY_BUDGET_MS);
  });
});
