import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { createServer } from '../packages/mockifyer-dashboard/src/server';

async function listen(app: http.RequestListener): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('HTTP server did not bind to a TCP port');
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

describe('dashboard server API guards', () => {
  let tmpDir: string;
  let publicDir: string;
  let server: Awaited<ReturnType<typeof listen>> | null;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-dashboard-'));
    publicDir = path.join(tmpDir, 'public');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html>');
    server = null;
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('allows Mockifyer proxy headers in CORS preflight responses', async () => {
    const app = createServer(publicDir, tmpDir, { provider: 'redis', redisUrl: 'redis://127.0.0.1:6379' });
    server = await listen(app);

    const response = await fetch(`${server.baseUrl}/api/proxy`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5174',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers':
          'content-type,x-mockifyer-client-id,x-mockifyer-device-id,x-mockifyer-request-id,x-mockifyer-parent-request-id',
      },
    });

    expect(response.status).toBe(200);
    const allowedHeaders = response.headers.get('access-control-allow-headers')?.toLowerCase() ?? '';
    expect(allowedHeaders).toContain('x-mockifyer-client-id');
    expect(allowedHeaders).toContain('x-mockifyer-device-id');
    expect(allowedHeaders).toContain('x-mockifyer-request-id');
    expect(allowedHeaders).toContain('x-mockifyer-parent-request-id');
  });

  it('rejects unsafe client-lane scenario assignments before opening the store', async () => {
    const app = createServer(publicDir, tmpDir, { provider: 'redis', redisUrl: 'redis://127.0.0.1:6379' });
    server = await listen(app);

    const response = await fetch(`${server.baseUrl}/api/client-lanes/lane-a/scenario`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario: '../../outside' }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Invalid scenario name');
    expect(fs.existsSync(path.resolve(tmpDir, '..', 'outside'))).toBe(false);
  });
});
