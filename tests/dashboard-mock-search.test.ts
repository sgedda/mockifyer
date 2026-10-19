import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';

function makeMockFile(url: string, data: unknown) {
  return {
    request: {
      method: 'POST',
      url,
      headers: {},
      queryParams: {},
      data: { query: 'query GetUser { user { id } }' },
    },
    response: {
      status: 200,
      data,
      headers: {},
    },
    timestamp: '2026-01-01T00:00:00.000Z',
    scenario: 'default',
  };
}

function httpRequest(server: http.Server, urlPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'GET',
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
    req.end();
  });
}

describe('GET /api/mocks/search', () => {
  let tmp: string;
  let server: http.Server;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-search-api-'));
    const publicDir = path.join(tmp, 'public');
    const mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, 'default', 'api.example.com', 'graphql'), { recursive: true });
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: 'default' })
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'default', 'api.example.com', 'graphql', 'POST_GetUser.json'),
      JSON.stringify(makeMockFile('https://api.example.com/graphql', { user: { id: 'u-1' } }))
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'default', 'noise.json'),
      JSON.stringify({
        request: {
          method: 'GET',
          url: 'https://api.example.com/other',
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { ping: true },
          headers: {},
        },
        timestamp: '2026-01-01T00:00:00.000Z',
        scenario: 'default',
      })
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

  it('finds mocks by filename without scanning unrelated bodies as the only result', async () => {
    const res = await httpRequest(server, '/api/mocks/search?scenario=default&q=GetUser');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body) as {
      files: Array<{ filename: string; endpoint: string; method: string }>;
      query: string;
    };
    expect(json.query).toBe('GetUser');
    expect(json.files).toHaveLength(1);
    expect(json.files[0].filename).toContain('POST_GetUser.json');
    expect(json.files[0].method).toBe('POST');
    expect(json.files[0].endpoint).toContain('/graphql');
  });

  it('ANDs multiple tokens across request metadata', async () => {
    const res = await httpRequest(
      server,
      `/api/mocks/search?scenario=default&q=${encodeURIComponent('POST graphql')}`
    );
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body) as { files: Array<{ filename: string }> };
    expect(json.files.map((file) => file.filename)).toEqual([
      expect.stringContaining('POST_GetUser.json'),
    ]);
  });
});
