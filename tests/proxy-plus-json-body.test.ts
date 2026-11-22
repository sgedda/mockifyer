import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';

const SCENARIO = 'plus-json';

function postJson(
  server: http.Server,
  urlPath: string,
  body: unknown
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const { port } = server.address() as AddressInfo;
    const payload = JSON.stringify(body);
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
          });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('POST /api/proxy +json upstream bodies', () => {
  let tmp: string;
  let dashboard: http.Server;
  let upstream: http.Server;
  let upstreamUrl: string;

  beforeEach(async () => {
    upstream = http.createServer((req, res) => {
      const body = JSON.stringify({ items: [{ id: 'a' }] });
      const type =
        req.url === '/plain'
          ? 'text/plain; charset=utf-8'
          : 'application/vnd.api+json; charset=utf-8';
      res.writeHead(200, { 'content-type': type });
      res.end(body);
    });
    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = upstream.address() as AddressInfo;
    upstreamUrl = `http://127.0.0.1:${port}/items`;

    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-proxy-plus-json-'));
    const publicDir = path.join(tmp, 'public');
    const mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(mockDataPath, { recursive: true });
    const app = createServer(publicDir, mockDataPath, { provider: 'sqlite' });
    dashboard = await new Promise<http.Server>((resolve) => {
      const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
    const created = await postJson(dashboard, '/api/scenario-config/create', { scenario: SCENARIO });
    expect(created.status).toBe(200);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      dashboard.close((err) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      upstream.close((err) => (err ? reject(err) : resolve()));
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns and records a +json body as an object', async () => {
    const proxied = await postJson(dashboard, '/api/proxy', {
      url: upstreamUrl,
      method: 'GET',
      scenario: SCENARIO,
      record: true,
      recordResponses: true,
      allowUpstream: true,
    });

    expect(proxied.status).toBe(200);
    expect(proxied.json.response.data).toEqual({ items: [{ id: 'a' }] });
    expect(proxied.json.storedMock.response.data).toEqual({ items: [{ id: 'a' }] });
  });

  it('keeps a text/plain body as text', async () => {
    const proxied = await postJson(dashboard, '/api/proxy', {
      url: upstreamUrl.replace(/\/items$/, '/plain'),
      method: 'GET',
      scenario: SCENARIO,
      record: false,
      allowUpstream: true,
    });

    expect(proxied.status).toBe(200);
    expect(proxied.json.response.data).toBe('{"items":[{"id":"a"}]}');
  });
});
