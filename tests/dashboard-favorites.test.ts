import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import { favoriteIdForMock } from '../packages/mockifyer-dashboard/src/utils/favorites-store';

const MOCK_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function makeMockFile(url = 'https://api.example.com/bookings') {
  return {
    request: {
      method: 'GET',
      url,
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

describe('dashboard favorites API', () => {
  let tmp: string;
  let server: http.Server;
  let mockDataPath: string;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-fav-api-'));
    const publicDir = path.join(tmp, 'public');
    mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, 'errors'), { recursive: true });
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: 'default' })
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'default', 'bookings.json'),
      JSON.stringify(makeMockFile(), null, 2)
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'errors', 'bookings-error.json'),
      JSON.stringify(makeMockFile(), null, 2)
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'errors', 'users.json'),
      JSON.stringify(makeMockFile('https://api.example.com/users'), null, 2)
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

  it('stars a request globally and lists it with a stable requestHash', async () => {
    const list = await httpRequest(server, '/api/mocks?scenario=default');
    expect(list.status).toBe(200);
    const listed = JSON.parse(list.body) as {
      files: Array<{ filename: string; requestHash: string }>;
    };
    expect(listed.files[0].requestHash).toBe(favoriteIdForMock(makeMockFile()));

    const added = await httpRequest(server, '/api/favorites', {
      method: 'POST',
      body: { scenario: 'default', filename: 'bookings.json' },
    });
    expect(added.status).toBe(200);
    const addedJson = JSON.parse(added.body) as {
      favorite: { id: string; endpoint: string };
      favorites: Array<{ id: string }>;
    };
    expect(addedJson.favorite.id).toBe(listed.files[0].requestHash);
    expect(addedJson.favorites).toHaveLength(1);

    const errorsList = await httpRequest(server, '/api/mocks?scenario=errors');
    const errorsJson = JSON.parse(errorsList.body) as {
      files: Array<{ filename: string; requestHash: string }>;
    };
    const matching = errorsJson.files.filter((file) => file.requestHash === addedJson.favorite.id);
    expect(matching).toHaveLength(1);
    expect(matching[0].filename).toBe('bookings-error.json');
    expect(errorsJson.files.some((file) => file.filename === 'users.json')).toBe(true);

    const removed = await httpRequest(server, `/api/favorites/${addedJson.favorite.id}`, {
      method: 'DELETE',
    });
    expect(removed.status).toBe(200);
    expect(JSON.parse(removed.body).favorites).toEqual([]);
  });
});
