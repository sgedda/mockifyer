import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

describe('axios proxy bypass', () => {
  let mockDataPath: string;
  let upstream: MockAdapter;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-proxy-bypass-'));
  });

  afterEach(() => {
    upstream?.restore();
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('does not add lane or device headers to direct upstream requests when activation is off', async () => {
    const url = 'https://api.example.test/private';
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);

    upstream.onGet(url).reply((config) => {
      const headers = axios.AxiosHeaders.from(config.headers as any);
      return [
        200,
        {
          direct: true,
          clientIdHeader: headers.get('x-mockifyer-client-id') ?? null,
          deviceIdHeader: headers.get('x-mockifyer-device-id') ?? null,
        },
      ];
    });

    const client = setupMockifyer({
      mockDataPath,
      recordMode: false,
      axiosInstance,
      activationMode: 'off',
      clientId: 'lane-alpha',
      deviceId: 'device-one',
      proxy: { baseUrl: 'http://dashboard.local' },
    });

    const response = await client.get(url);

    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      direct: true,
      clientIdHeader: null,
      deviceIdHeader: null,
    });
  });
});
