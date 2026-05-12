import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { createServer } from '../packages/mockifyer-dashboard/src/server';

async function withDashboard(
  fn: (baseUrl: string, paths: { tempDir: string; mockDataPath: string; outsideFile: string }) => Promise<void>
): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-dashboard-'));
  const publicDir = path.join(tempDir, 'public');
  const mockDataPath = path.join(tempDir, 'mock-data');
  const scenarioDir = path.join(mockDataPath, 'default');
  const outsideFile = path.join(tempDir, 'outside.json');

  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(scenarioDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<html></html>');
  fs.writeFileSync(
    outsideFile,
    JSON.stringify({
      request: { url: '/outside', method: 'GET' },
      response: { status: 200, data: { secret: 'outside-secret' }, headers: {} },
    }),
    'utf-8'
  );

  const app = createServer(publicDir, mockDataPath);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`, { tempDir, mockDataPath, outsideFile });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('dashboard mock routes scenario validation', () => {
  test('rejects scenario traversal before reading files outside mockDataPath', async () => {
    await withDashboard(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/mocks/outside.json?scenario=..`);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringContaining('Invalid scenario name'),
      });
    });
  });

  test('rejects scenario traversal before searching files outside mockDataPath', async () => {
    await withDashboard(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/mocks/search?q=outside-secret&scenario=..`);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringContaining('Invalid scenario name'),
      });
    });
  });

  test('rejects scenario traversal before mutating files outside mockDataPath', async () => {
    await withDashboard(async (baseUrl, { outsideFile }) => {
      const original = fs.readFileSync(outsideFile, 'utf-8');

      const updateResponse = await fetch(`${baseUrl}/api/mocks/outside.json?scenario=..`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseData: { secret: 'overwritten' } }),
      });
      const deleteResponse = await fetch(`${baseUrl}/api/mocks/outside.json?scenario=..`, {
        method: 'DELETE',
      });

      expect(updateResponse.status).toBe(400);
      expect(deleteResponse.status).toBe(400);
      expect(fs.existsSync(outsideFile)).toBe(true);
      expect(fs.readFileSync(outsideFile, 'utf-8')).toBe(original);
    });
  });
});
