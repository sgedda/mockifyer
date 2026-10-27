import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import { DASHBOARD_CORS_ALLOW_HEADERS } from '../packages/mockifyer-dashboard/src/utils/cors';

function preflight(
  server: http.Server,
  urlPath: string,
  headers: http.OutgoingHttpHeaders
): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method: 'OPTIONS', headers },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('dashboard CORS preflight', () => {
  let tmp: string;
  let server: http.Server;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-cors-'));
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

  it('allows the x-mockifyer-client-id header a browser app sends to /api/proxy', async () => {
    const res = await preflight(server, '/api/proxy', {
      Origin: 'http://127.0.0.1:8090',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-mockifyer-client-id',
    });

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    const allowed = String(res.headers['access-control-allow-headers'])
      .toLowerCase()
      .split(/\s*,\s*/);
    expect(allowed).toEqual(
      expect.arrayContaining([
        'content-type',
        'x-mockifyer-client-id',
        'x-mockifyer-device-id',
        'x-mockifyer-request-id',
        'x-mockifyer-parent-request-id',
        'x-mockifyer-include-trace',
        'x-mockifyer-override-group',
      ])
    );
  });

  it('does not echo arbitrary requested headers', async () => {
    const res = await preflight(server, '/api/date-config', {
      Origin: 'http://127.0.0.1:8090',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'x-not-a-mockifyer-header',
    });

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-headers']).toBe(DASHBOARD_CORS_ALLOW_HEADERS);
  });
});
