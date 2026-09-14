import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import { closeCachedDashboardMockStores } from '../packages/mockifyer-dashboard/src/utils/create-dashboard-mock-store';

const HASH = '97db31e9e128bd9d74eb4004a8e40a27246b338ca6aa12597abb38c9f3f2cc14';
const REDIS_FILENAME = `redis/${HASH}.json`;
const OVERRIDES = [{ path: 'bookings.0.status', value: 'CONFIRMED' }];

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${addr.port}`);
    });
  });
}

describe('GET /api/mocks/*/field-overrides', () => {
  let tmpDir: string;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-field-overrides-'));
    const scenarioDir = path.join(tmpDir, 'different-kind-of-trips');
    fs.mkdirSync(path.join(scenarioDir, 'redis'), { recursive: true });
    fs.writeFileSync(
      path.join(scenarioDir, 'redis', `${HASH}.json`),
      JSON.stringify(
        {
          request: { method: 'GET', url: 'https://example.test/bookings', headers: {} },
          response: { status: 200, data: { bookings: [{ status: 'HOLD' }] }, headers: {} },
          timestamp: '2026-09-14T00:00:00.000Z',
          responseFieldOverrides: OVERRIDES,
        },
        null,
        2
      )
    );

    const app = createServer(tmpDir, tmpDir, { provider: 'filesystem' });
    server = http.createServer(app);
    baseUrl = await listen(server);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await closeCachedDashboardMockStores();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns stored overrides for redis/<hash>.json instead of Invalid filename', async () => {
    const response = await fetch(
      `${baseUrl}/api/mocks/${REDIS_FILENAME}/field-overrides?scenario=${encodeURIComponent(
        'different-kind-of-trips'
      )}`
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.filename).toBe(REDIS_FILENAME);
    expect(body.scenario).toBe('different-kind-of-trips');
    expect(body.responseFieldOverrides).toEqual(OVERRIDES);
  });

  it('returns stored overrides when the dashboard is mounted at /mockifyer', async () => {
    const express = require('../packages/mockifyer-dashboard/node_modules/express');
    const dashboard = createServer(tmpDir, tmpDir, { provider: 'filesystem' });
    const parent = express();
    parent.use('/mockifyer', dashboard);
    const mounted = require('http').createServer(parent);
    const mountedUrl = await listen(mounted);
    try {
      const response = await fetch(
        `${mountedUrl}/mockifyer/api/mocks/${REDIS_FILENAME}/field-overrides?scenario=${encodeURIComponent(
          'different-kind-of-trips'
        )}`
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.filename).toBe(REDIS_FILENAME);
      expect(body.responseFieldOverrides).toEqual(OVERRIDES);
    } finally {
      await new Promise<void>((resolve, reject) => {
        mounted.close((err: Error | undefined) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('returns stored overrides when the filename slash is percent-encoded', async () => {
    const response = await fetch(
      `${baseUrl}/api/mocks/${encodeURIComponent(REDIS_FILENAME)}/field-overrides?scenario=${encodeURIComponent(
        'different-kind-of-trips'
      )}`
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.filename).toBe(REDIS_FILENAME);
    expect(body.responseFieldOverrides).toEqual(OVERRIDES);
  });
});
