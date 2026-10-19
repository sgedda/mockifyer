import axios, { type AxiosRequestConfig } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import { runWithMockifyerHopContext } from '@sgedda/mockifyer-core';

const UPSTREAM_URL = 'https://member-api.example.test/myaccount';
const PROXY_BASE_URL = 'http://dashboard.example.test/mockifyer';
const SERVICE_LANE = 'capi-graphql';
const CALLER_LANE = 'app-device-lane';

function mockifyerHeaderNames(config: AxiosRequestConfig | undefined): string[] {
  const headers = (config?.headers ?? {}) as Record<string, unknown>;
  const plain =
    typeof (headers as { toJSON?: () => Record<string, unknown> }).toJSON === 'function'
      ? (headers as { toJSON: () => Record<string, unknown> }).toJSON()
      : headers;
  return Object.keys(plain)
    .map((name) => name.toLowerCase())
    .filter((name) => name.startsWith('x-mockifyer-'));
}

describe('client_id_header on a service with its own proxy lane', () => {
  let mockDataPath: string;
  let upstream: MockAdapter;
  let seen: AxiosRequestConfig | undefined;
  let proxyFetch: jest.SpyInstance;

  function setupService() {
    const axiosInstance = axios.create();
    upstream = new MockAdapter(axiosInstance);
    upstream.onGet(UPSTREAM_URL).reply((config) => {
      seen = config;
      return [200, { ok: true }];
    });
    return setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: false,
      activationMode: 'client_id_header',
      clientId: SERVICE_LANE,
      proxy: { baseUrl: PROXY_BASE_URL },
      axiosInstance,
    });
  }

  beforeEach(() => {
    seen = undefined;
    proxyFetch = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('proxy unavailable in test'));
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-service-lane-'));
    fs.mkdirSync(path.join(mockDataPath, 'default'), { recursive: true });
  });

  afterEach(() => {
    upstream?.restore();
    proxyFetch.mockRestore();
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('leaves a request with no caller header untouched', async () => {
    const client = setupService();

    const response = await client.get(UPSTREAM_URL);

    expect(response.data).toEqual({ ok: true });
    expect(mockifyerHeaderNames(seen)).toEqual([]);
    expect(proxyFetch).not.toHaveBeenCalled();
  });

  it('routes through the dashboard proxy when the inbound request carried the header', async () => {
    const client = setupService();

    await runWithMockifyerHopContext({ inboundClientId: CALLER_LANE }, () =>
      client.get(UPSTREAM_URL).catch(() => undefined)
    );

    expect(seen).toBeUndefined();
    expect(String(proxyFetch.mock.calls[0]?.[0])).toContain(PROXY_BASE_URL);
  });
});
