/**
 * Test that failOnMissingMock properly blocks requests when:
 * 1. No mock exists
 * 2. A request-only stub exists (responsePending: true)
 * 3. A passthrough mock exists (alwaysUseRealApi: true)
 * 4. Domain-path rules deny replay (allowlist unmatched)
 *
 * Note: These tests verify the fix for Gap 1 where failOnMissingMock should
 * block requests in all these scenarios, not just when no mock file exists.
 */
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import type { MockData, HTTPClient } from '@sgedda/mockifyer-core';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('failOnMissingMock with request-only stubs', () => {
  let tempDir: string;
  let mockDataPath: string;
  let httpClient: HTTPClient;
  let axiosInstance: any;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-test-'));
    mockDataPath = path.join(tempDir, 'mock-data');
    fs.mkdirSync(mockDataPath, { recursive: true });
    fs.mkdirSync(path.join(mockDataPath, '_scratch'), { recursive: true });
    
    // Create axios instance with mock adapter for upstream
    axiosInstance = axios.create();
    mockAdapter = new MockAdapter(axiosInstance);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (mockAdapter) {
      mockAdapter.restore();
    }
  });

  it('should throw when no mock exists and failOnMissingMock is true', async () => {
    httpClient = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: true,
      useGlobalAxios: false,
      axiosInstance,
    });

    await expect(
      httpClient.get('https://api.example.com/no-mock')
    ).rejects.toThrow('No mock data found for request');
  });

  it('should throw when a request-only stub exists (responsePending: true)', async () => {
    const requestOnlyStub: MockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/stub',
        headers: {},
        data: undefined,
      },
      response: { status: 0, data: null, headers: {} },
      timestamp: new Date().toISOString(),
      responsePending: true,
    };

    const stubPath = path.join(mockDataPath, '_scratch', 'stub.json');
    fs.writeFileSync(stubPath, JSON.stringify(requestOnlyStub, null, 2));

    httpClient = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: true,
      useGlobalAxios: false,
      axiosInstance,
      domainPathRulesMode: 'off',
    });

    await expect(
      httpClient.get('https://api.example.com/stub')
    ).rejects.toThrow('No mock data found for request');
  });

  it('should throw when a passthrough mock exists (alwaysUseRealApi: true)', async () => {
    const passthroughMock: MockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/passthrough',
        headers: {},
        data: undefined,
      },
      response: { status: 200, data: { message: 'test' }, headers: {} },
      timestamp: new Date().toISOString(),
      alwaysUseRealApi: true,
    };

    const mockPath = path.join(mockDataPath, '_scratch', 'passthrough.json');
    fs.writeFileSync(mockPath, JSON.stringify(passthroughMock, null, 2));

    httpClient = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: true,
      useGlobalAxios: false,
      axiosInstance,
      domainPathRulesMode: 'off',
    });

    await expect(
      httpClient.get('https://api.example.com/passthrough')
    ).rejects.toThrow('No mock data found for request');
  });

  it('should NOT throw when a usable mock exists', async () => {
    const usableMock: MockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/usable',
        headers: {},
        data: undefined,
      },
      response: { status: 200, data: { message: 'mocked' }, headers: {} },
      timestamp: new Date().toISOString(),
    };

    const mockPath = path.join(mockDataPath, '_scratch', 'usable.json');
    fs.writeFileSync(mockPath, JSON.stringify(usableMock, null, 2));

    httpClient = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: true,
      useGlobalAxios: false,
      axiosInstance,
      domainPathRulesMode: 'off',
    });

    const response = await httpClient.get('https://api.example.com/usable');
    expect(response.data).toEqual({ message: 'mocked' });
  });

  it('should NOT throw when recordMode is true (live API needed for recording)', async () => {
    // Mock the upstream to return success
    mockAdapter.onGet('https://api.example.com/recording').reply(200, { success: true });

    httpClient = setupMockifyer({
      mockDataPath,
      recordMode: true,
      failOnMissingMock: true, // ignored when recordMode is true
      useGlobalAxios: false,
      axiosInstance,
    });

    // This would normally throw with failOnMissingMock, but recordMode disables it
    const response = await httpClient.get('https://api.example.com/recording');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ success: true });
  });

  it('should throw when domain-path rules deny replay (allowlist mode, no match)', async () => {
    // Create domain-path-rules.json with allowlist mode (default)
    const rulesPath = path.join(mockDataPath, '_scratch', 'domain-path-rules.json');
    const rules = {
      'api.allowed.com': {
        recordResponses: true,
        autoMock: false,
      }
    };
    fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));

    httpClient = setupMockifyer({
      mockDataPath,
      recordMode: false,
      failOnMissingMock: true,
      useGlobalAxios: false,
      axiosInstance,
      domainPathRulesMode: 'allowlist',
    });

    // Request to unmatched domain should throw
    await expect(
      httpClient.get('https://api.unmatched.com/test')
    ).rejects.toThrow('No mock data found for request');
  });
});
