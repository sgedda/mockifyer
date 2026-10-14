import axios, { AxiosInstance } from 'axios';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

describe('useGlobalAxios + recordMode live-refresh', () => {
  let mockDataPath: string;
  let axiosInstance: AxiosInstance;
  let server: http.Server;
  let serverPort: number;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-global-refresh-'));
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
    axiosInstance = axios.create();
  });

  afterEach((done) => {
    if (server) {
      server.close(() => done());
    } else {
      done();
    }
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('persists live body and clears refreshOnNextRequest on global axios', async () => {
    const filePath = path.join(mockDataPath, 'default', 'GET_orders_42.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          request: { method: 'GET', url: '', headers: {} },
          response: { status: 200, data: { id: 42, status: 'stale' }, headers: {} },
          timestamp: '2026-01-01T00:00:00.000Z',
          refreshOnNextRequest: true,
        },
        null,
        2
      ),
      'utf-8'
    );

    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 42, status: 'fresh' }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });

    const url = `http://localhost:${serverPort}/orders/42`;
    
    // Update mock file with actual URL
    const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    mockData.request.url = url;
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2), 'utf-8');

    setupMockifyer({
      mockDataPath,
      recordMode: true,
      useGlobalAxios: true,
      axiosInstance,
      failOnMissingMock: false,
    });

    const response = await axiosInstance.get(url);
    expect(response.data).toEqual({ id: 42, status: 'fresh' });

    const updated = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(updated.response.data).toEqual({ id: 42, status: 'fresh' });
    expect(updated.refreshOnNextRequest).toBeUndefined();
  });
});
