import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';

const GLOBAL_SCENARIO = 'heatwave';
const LANE_SCENARIO = 'lane-only';
const CLIENT_ID = 'no-lane-client';
const URL = 'https://api.example.com/weather';

function request(
  server: http.Server,
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
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
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('strict lane mode: opt-in global fallback for clients without a lane (#484)', () => {
  let tmp: string;
  let server: http.Server;

  /** What a strict-lane client (the default for proxy runtimes) sends for a lane-less client id. */
  const proxyAsClient = () =>
    request(server, 'POST', '/api/proxy', {
      url: URL,
      method: 'GET',
      clientId: CLIENT_ID,
      strictLaneScenario: true,
      allowUpstream: false,
    });

  async function seedMock(scenario: string, temperature: number): Promise<void> {
    const probe = await request(server, 'POST', '/api/proxy', {
      url: URL,
      method: 'GET',
      scenario,
      allowUpstream: false,
    });
    const imported = await request(server, 'POST', '/api/scenario-config/import', {
      targetScenario: scenario,
      applyDateConfig: false,
      applyProxyConfig: false,
      applyDomainPathRules: false,
      bundle: {
        formatVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        sourceScenario: scenario,
        mocks: [
          {
            relativePath: `redis/${probe.json.hash}.json`,
            data: {
              request: { method: 'GET', url: URL, headers: {}, queryParams: {} },
              response: { status: 200, data: { temperature }, headers: {} },
              timestamp: '2026-01-01T00:00:00.000Z',
              scenario,
            },
          },
        ],
      },
    });
    expect(imported.status).toBe(200);
  }

  beforeEach(async () => {
    delete process.env.MOCKIFYER_LANE_GLOBAL_FALLBACK;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-lane-fallback-'));
    const publicDir = path.join(tmp, 'public');
    const mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(mockDataPath, { recursive: true });
    const app = createServer(publicDir, mockDataPath, { provider: 'sqlite' });
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    for (const scenario of [LANE_SCENARIO, GLOBAL_SCENARIO]) {
      await request(server, 'POST', '/api/scenario-config/create', { scenario });
    }
    await seedMock(GLOBAL_SCENARIO, 44);
    await seedMock(LANE_SCENARIO, 11);
    await request(server, 'POST', '/api/scenario-config/set', { scenario: GLOBAL_SCENARIO });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('is off by default: a client id without a lane does not use the global scenario', async () => {
    expect((await request(server, 'GET', '/api/client-lanes')).json.laneGlobalFallback).toBe(false);
    const r = await proxyAsClient();
    expect(r.status).toBe(412);
    expect(r.json.source).toBe('blocked_strict_lane');
  });

  it('when enabled, a client id without a lane is served from the global scenario', async () => {
    const put = await request(server, 'PUT', '/api/client-lanes/settings/global-fallback', { enabled: true });
    expect(put.json).toEqual({ success: true, laneGlobalFallback: true });

    const r = await proxyAsClient();
    expect(r.status).toBe(200);
    expect(r.json.scenarioResolution).toMatchObject({ scenario: GLOBAL_SCENARIO, resolutionSource: 'global_fallback' });
    expect(r.json.response.data).toEqual({ temperature: 44 });
  });

  it('a lane still wins over the fallback', async () => {
    await request(server, 'PUT', '/api/client-lanes/settings/global-fallback', { enabled: true });
    await request(server, 'PUT', `/api/client-lanes/${CLIENT_ID}/scenario`, { scenario: LANE_SCENARIO });

    const r = await proxyAsClient();
    expect(r.json.scenarioResolution).toMatchObject({ scenario: LANE_SCENARIO, resolutionSource: 'lane_redis' });
    expect(r.json.response.data).toEqual({ temperature: 11 });
  });

  it('MOCKIFYER_LANE_GLOBAL_FALLBACK sets the default and the stored setting overrides it', async () => {
    process.env.MOCKIFYER_LANE_GLOBAL_FALLBACK = 'true';
    try {
      const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-lane-fallback-env-'));
      const app = createServer(path.join(fresh, 'public'), fresh, { provider: 'sqlite' });
      const envServer = await new Promise<http.Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      try {
        expect((await request(envServer, 'GET', '/api/client-lanes')).json.laneGlobalFallback).toBe(true);
        await request(envServer, 'PUT', '/api/client-lanes/settings/global-fallback', { enabled: false });
        expect((await request(envServer, 'GET', '/api/client-lanes')).json.laneGlobalFallback).toBe(false);
      } finally {
        await new Promise<void>((resolve) => envServer.close(() => resolve()));
        fs.rmSync(fresh, { recursive: true, force: true });
      }
    } finally {
      delete process.env.MOCKIFYER_LANE_GLOBAL_FALLBACK;
    }
  });

  it('rejects a non-boolean setting', async () => {
    const r = await request(server, 'PUT', '/api/client-lanes/settings/global-fallback', { enabled: 'yes' });
    expect(r.status).toBe(400);
  });
});
