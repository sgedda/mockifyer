import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

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
      if (entry.name === 'domain-path-rules.json') continue;
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

describe('axios setRecordMode after startup', () => {
  let mockDataPath: string;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-axios-record-toggle-'));
  });

  afterEach(() => {
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('saves a local miss on the axios client after record mode is turned on', async () => {
    const axiosInstance = axios.create({
      adapter: adapterReturning({ ok: true }),
    });

    const client = setupMockifyer({
      mockDataPath,
      axiosInstance,
      useGlobalAxios: false,
      recordMode: false,
      recordResponses: true,
      domainPathRulesMode: 'record_all',
      networkLog: { enabled: false },
    });

    await client.get('https://api.example.com/before');
    expect(readSavedMockBodies(mockDataPath)).toEqual([]);

    client.setRecordMode(true);
    await client.get('https://api.example.com/after');

    expect(readSavedMockBodies(mockDataPath)).toEqual([{ ok: true }]);
  });

  it('saves a local miss on global axios after record mode is turned on', async () => {
    const axiosInstance = axios.create({
      adapter: adapterReturning({ ok: true, via: 'global' }),
    });

    const client = setupMockifyer({
      mockDataPath,
      axiosInstance,
      useGlobalAxios: true,
      recordMode: false,
      recordResponses: true,
      domainPathRulesMode: 'record_all',
      networkLog: { enabled: false },
    });

    await axiosInstance.get('https://api.example.com/before');
    expect(readSavedMockBodies(mockDataPath)).toEqual([]);

    client.setRecordMode(true);
    await axiosInstance.get('https://api.example.com/after');

    expect(readSavedMockBodies(mockDataPath)).toEqual([{ ok: true, via: 'global' }]);
  });
});
