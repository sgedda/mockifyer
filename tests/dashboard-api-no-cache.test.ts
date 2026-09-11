import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import {
  DASHBOARD_API_CACHE_CONTROL,
  dashboardApiNoCache,
} from '../packages/mockifyer-dashboard/src/utils/api-no-cache';

const MOCK_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function makeMockFile() {
  return {
    request: {
      method: 'GET',
      url: 'https://api.example.com/bookings',
      headers: {},
      queryParams: {},
    },
    response: {
      status: 200,
      data: { status: 'OPEN' },
      headers: {},
    },
    timestamp: MOCK_TIMESTAMP,
    scenario: 'default',
    responseFieldOverrides: [{ path: 'status', value: 'CLOSED' }],
  };
}

function httpGet(
  server: http.Server,
  urlPath: string,
  headers: http.OutgoingHttpHeaders = {}
): Promise<{ status: number; body: string; etag?: string }> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            etag: typeof res.headers.etag === 'string' ? res.headers.etag : undefined,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('dashboard API cache / 304', () => {
  it('strips conditional GET headers so Express cannot 304', () => {
    const req = {
      headers: {
        'if-none-match': 'W/"abc"',
        'if-modified-since': 'Wed, 21 Oct 2015 07:28:00 GMT',
      },
    };
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    };
    let nextCalled = false;
    dashboardApiNoCache(req as never, res as never, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(headers['Cache-Control']).toBe(DASHBOARD_API_CACHE_CONTROL);
    expect(req.headers['if-none-match']).toBeUndefined();
    expect(req.headers['if-modified-since']).toBeUndefined();
  });

  describe('GET field-overrides', () => {
    let tmp: string;
    let server: http.Server;

    beforeEach(async () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-api-304-'));
      const publicDir = path.join(tmp, 'public');
      const mockDataPath = path.join(tmp, 'mock-data');
      fs.mkdirSync(publicDir, { recursive: true });
      fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
      fs.writeFileSync(
        path.join(mockDataPath, 'scenario-config.json'),
        JSON.stringify({ currentScenario: 'default' })
      );
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

    it('returns 200 with JSON when If-None-Match matches a prior ETag', async () => {
      const pathWithQuery = '/api/mocks/bookings.json/field-overrides?scenario=default';
      const first = await httpGet(server, pathWithQuery);
      expect(first.status).toBe(200);
      const firstJson = JSON.parse(first.body) as { responseFieldOverrides: unknown[] };
      expect(firstJson.responseFieldOverrides).toEqual([{ path: 'status', value: 'CLOSED' }]);

      const second = await httpGet(server, pathWithQuery, {
        'If-None-Match': first.etag || 'W/"stale"',
      });
      expect(second.status).toBe(200);
      expect(JSON.parse(second.body)).toEqual(firstJson);
    });

    it('returns 200 for override-groups list after a matching If-None-Match', async () => {
      const listPath = '/api/override-groups?scenario=default';
      const first = await httpGet(server, listPath);
      expect(first.status).toBe(200);
      JSON.parse(first.body);

      const second = await httpGet(server, listPath, {
        'If-None-Match': first.etag || 'W/"stale"',
      });
      expect(second.status).toBe(200);
      expect(JSON.parse(second.body)).toEqual(JSON.parse(first.body));
    });
  });

  describe('embedded at /mockifyer', () => {
    let tmp: string;
    let server: http.Server;

    beforeEach(async () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-embed-'));
      const publicDir = path.join(tmp, 'public');
      const mockDataPath = path.join(tmp, 'mock-data');
      fs.mkdirSync(publicDir, { recursive: true });
      fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
      fs.writeFileSync(
        path.join(publicDir, 'index.html'),
        '<!doctype html><div id="root"></div><script type="module" src="./assets/index.js"></script>'
      );
      fs.writeFileSync(
        path.join(mockDataPath, 'scenario-config.json'),
        JSON.stringify({ currentScenario: 'default' })
      );
      fs.writeFileSync(
        path.join(mockDataPath, 'default', 'bookings.json'),
        JSON.stringify(makeMockFile(), null, 2)
      );

      const inner = createServer(publicDir, mockDataPath, { provider: 'filesystem' });
      server = await new Promise<http.Server>((resolve) => {
        const s = http.createServer((req, res) => {
          const url = req.url ?? '/';
          if (!url.startsWith('/mockifyer')) {
            res.statusCode = 404;
            res.end('host miss');
            return;
          }
          req.url = url.slice('/mockifyer'.length) || '/';
          inner(req, res);
        });
        s.listen(0, '127.0.0.1', () => resolve(s));
      });
    });

    afterEach(async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('serves Overrides SPA and APIs under /mockifyer', async () => {
      const page = await httpGet(server, '/mockifyer/overrides');
      expect(page.status).toBe(200);
      expect(page.body).toContain('id="root"');

      const cfg = await httpGet(server, '/mockifyer/api/scenario-config');
      expect(cfg.status).toBe(200);
      const cfgJson = JSON.parse(cfg.body) as { currentScenario: string };
      expect(cfgJson.currentScenario).toBe('default');

      const mocks = await httpGet(server, '/mockifyer/api/mocks?scenario=default');
      expect(mocks.status).toBe(200);
      const mocksJson = JSON.parse(mocks.body) as {
        files: Array<{ hasResponseFieldOverrides?: boolean }>;
      };
      expect(mocksJson.files[0]?.hasResponseFieldOverrides).toBe(true);
    });
  });
});
