import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

function inlineTraceEnvelope() {
  return {
    data: { id: 1, name: 'ada' },
    mockifyerTrace: {
      requestId: 'downstream-root',
      hopCount: 1,
      incomplete: false,
      hops: [
        {
          requestId: 'downstream-child',
          parentRequestId: 'downstream-root',
          method: 'GET',
          url: 'https://downstream.example/user',
          status: 200,
          source: 'upstream',
          transport: 'axios',
        },
      ],
    },
  };
}

function adapterReturning(body: unknown) {
  return (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    Promise.resolve({
      data: body,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
}

function readSavedMockBodies(root: string): unknown[] {
  const bodies: unknown[] = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.json') || entry.name === 'scenario-config.json') continue;
      const parsed = JSON.parse(fs.readFileSync(full, 'utf8')) as {
        response?: { data?: unknown };
      };
      if (parsed.response && 'data' in parsed.response) {
        bodies.push(parsed.response.data);
      }
    }
  };
  walk(root);
  return bodies;
}

describe('useGlobalAxios inline-trace unwrap', () => {
  let mockDataPath: string;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-trace-'));
  });

  afterEach(() => {
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('returns the business body when global axios receives an inline-trace envelope', async () => {
    const axiosInstance = axios.create({
      adapter: adapterReturning(inlineTraceEnvelope()),
    });

    setupMockifyer({
      mockDataPath,
      useGlobalAxios: true,
      axiosInstance,
      recordMode: false,
      networkLog: { includeTraceHeader: true, enabled: false },
    });

    const response = await axiosInstance.get('https://api.example.com/user');

    expect(response.data).toEqual({ id: 1, name: 'ada' });
  });

  it('leaves ordinary JSON bodies unchanged', async () => {
    const axiosInstance = axios.create({
      adapter: adapterReturning({ id: 1, name: 'ada' }),
    });

    setupMockifyer({
      mockDataPath,
      useGlobalAxios: true,
      axiosInstance,
      recordMode: false,
      networkLog: { includeTraceHeader: true, enabled: false },
    });

    const response = await axiosInstance.get('https://api.example.com/user');

    expect(response.data).toEqual({ id: 1, name: 'ada' });
  });

  it('records the business body instead of the inline-trace envelope', async () => {
    const axiosInstance = axios.create({
      adapter: adapterReturning(inlineTraceEnvelope()),
    });

    setupMockifyer({
      mockDataPath,
      useGlobalAxios: true,
      axiosInstance,
      recordMode: true,
      domainPathRulesMode: 'record_all',
      networkLog: { includeTraceHeader: true, enabled: false },
    });

    const response = await axiosInstance.get('https://api.example.com/user');

    expect(response.data).toEqual({ id: 1, name: 'ada' });
    expect(readSavedMockBodies(mockDataPath)).toEqual([{ id: 1, name: 'ada' }]);
  });
});
