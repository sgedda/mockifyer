import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { MockData } from '@sgedda/mockifyer-core';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected server to listen on a TCP address');
  }

  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function close(server: http.Server | undefined): Promise<void> {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('dashboard proxy live refresh recording', () => {
  let tempDir: string;
  let upstreamServer: http.Server | undefined;
  let dashboardServer: http.Server | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-proxy-live-refresh-'));
  });

  afterEach(async () => {
    await close(dashboardServer);
    await close(upstreamServer);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('does not overwrite an existing live-refresh mock with a request-only recording', async () => {
    const scenario = 'live-refresh';
    const keyPrefix = `test:${Date.now()}`;
    const mockDataPath = path.join(tempDir, 'mock-data');
    const publicDir = path.join(tempDir, 'public');
    fs.mkdirSync(mockDataPath, { recursive: true });
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<html></html>');

    upstreamServer = http.createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, version: 2 }));
    });
    const upstreamUrl = `${await listen(upstreamServer)}/items`;

    const initialMock: MockData = {
      request: {
        method: 'GET',
        url: upstreamUrl,
        headers: {},
        queryParams: undefined,
      },
      response: {
        status: 200,
        data: { ok: true, version: 1 },
        headers: {},
      },
      timestamp: '2020-01-01T00:00:00.000Z',
      alwaysRefreshFromLive: true,
      responseDateOverrides: [{ path: 'expiresAt' }],
    };
    const hash = RedisMockStore.hashForMock(initialMock);
    const sqlitePath = path.join(mockDataPath, 'mockifyer-dashboard.db');
    const seedStore = new RedisMockStore({ mockDataPath, sqlitePath, keyPrefix });
    await seedStore.setByHashInScenario(hash, initialMock, scenario);
    await seedStore.close();

    const app = createServer(publicDir, mockDataPath, { provider: 'sqlite', keyPrefix });
    dashboardServer = http.createServer(app);
    const dashboardUrl = await listen(dashboardServer);

    const response = await fetch(`${dashboardUrl}/api/proxy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: upstreamUrl,
        method: 'GET',
        scenario,
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.refreshedStoredMock).toBe(true);
    expect(body.recordedToStore).toBe(true);
    expect(body.storedMock.responsePending).toBeUndefined();
    expect(body.storedMock.alwaysRefreshFromLive).toBe(true);

    const verifyStore = new RedisMockStore({ mockDataPath, sqlitePath, keyPrefix });
    const persisted = await verifyStore.getByHashInScenario(hash, scenario);
    await verifyStore.close();

    expect(persisted).not.toBeNull();
    expect(persisted?.responsePending).toBeUndefined();
    expect(persisted?.alwaysUseRealApi).toBeUndefined();
    expect(persisted?.alwaysRefreshFromLive).toBe(true);
    expect(persisted?.response.data).toEqual({ ok: true, version: 2 });
    expect(persisted?.responseDateOverrides).toEqual([{ path: 'expiresAt' }]);
  });
});
