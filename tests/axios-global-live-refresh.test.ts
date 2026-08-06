import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

describe('useGlobalAxios + recordMode live-refresh', () => {
  let mockDataPath: string;
  let axiosInstance: AxiosInstance;
  let upstream: MockAdapter;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-global-refresh-'));
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
    axiosInstance = axios.create();
  });

  afterEach(() => {
    upstream?.restore();
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('persists live body and clears refreshOnNextRequest on global axios', async () => {
    const url = 'https://api.example.test/orders/42';
    const filePath = path.join(mockDataPath, 'default', 'GET_orders_42.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          request: { method: 'GET', url, headers: {} },
          response: { status: 200, data: { id: 42, status: 'stale' }, headers: {} },
          timestamp: '2026-01-01T00:00:00.000Z',
          refreshOnNextRequest: true,
        },
        null,
        2
      ),
      'utf-8'
    );

    setupMockifyer({
      mockDataPath,
      recordMode: true,
      useGlobalAxios: true,
      axiosInstance,
      failOnMissingMock: false,
    });

    upstream = new MockAdapter(axiosInstance);
    upstream.onGet(url).reply(200, { id: 42, status: 'fresh' });

    const response = await axiosInstance.get(url);
    expect(response.data).toEqual({ id: 42, status: 'fresh' });

    const updated = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(updated.response.data).toEqual({ id: 42, status: 'fresh' });
    expect(updated.refreshOnNextRequest).toBeUndefined();
  });
});
