import fs from 'fs';
import path from 'path';
import {
  applyCapturedResponse,
  applyMockReplayModeSetting,
  getScenarioFolderPath,
  mockHasCapturableResponse,
  type MockData,
} from '@sgedda/mockifyer-core';
import { getAllJsonFiles } from './json-files';
import { endpointMatchesDomainPath } from './domain-tree-match';
import { fetchUpstreamResponse } from './capture-upstream-response';
import { RedisMockStore } from './redis-mock-store';

export interface BulkLiveApiResult {
  ok: true;
  scenario: string;
  domainPath: string;
  useLiveApi: boolean;
  updated: number;
  skippedPending: number;
}

export interface BulkCaptureResponsesResult {
  ok: true;
  scenario: string;
  domainPath: string;
  captured: number;
  skippedAlready: number;
  failed: number;
  errors: Array<{ endpoint: string | null; message: string }>;
}

function mockEndpointForMatch(mockData: MockData): string | null {
  const url = mockData.request?.url;
  if (!url) return null;
  let endpoint = url;
  const qp = mockData.request?.queryParams;
  if (qp && typeof qp === 'object' && Object.keys(qp).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(qp)) {
      if (value != null) params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) endpoint += `?${qs}`;
  }
  return endpoint;
}

function needsResponseCapture(mockData: MockData): boolean {
  return !mockHasCapturableResponse(mockData);
}

export async function bulkSetLiveApiForDomain(opts: {
  provider: 'filesystem' | 'sqlite' | 'redis';
  mockDataPath: string;
  scenario: string;
  domainPath: string;
  useLiveApi: boolean;
  redisUrl?: string;
  keyPrefix?: string;
}): Promise<BulkLiveApiResult> {
  const scenarioName = opts.scenario.trim();
  const prefix = opts.domainPath.trim();
  let updated = 0;
  let skippedPending = 0;

  if (opts.provider === 'redis') {
    const store = new RedisMockStore({
      redisUrl: opts.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
      keyPrefix: opts.keyPrefix,
      mockDataPath: opts.mockDataPath,
    });
    try {
      const items = await store.list(scenarioName);
      for (const { hash, mockData } of items) {
        const endpoint = mockEndpointForMatch(mockData);
        if (!endpointMatchesDomainPath(endpoint, prefix)) continue;
        if (!opts.useLiveApi && mockData.responsePending === true) {
          skippedPending += 1;
          continue;
        }
        applyMockReplayModeSetting(mockData, opts.useLiveApi ? 'passthrough' : 'stored');
        await store.setByHashInScenario(hash, mockData, scenarioName);
        updated += 1;
      }
    } finally {
      await store.close().catch(() => undefined);
    }
  } else {
    const scenarioPath = getScenarioFolderPath(opts.mockDataPath, scenarioName);
    for (const filePath of getAllJsonFiles(scenarioPath)) {
      let mockData: MockData;
      try {
        mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
      } catch {
        continue;
      }
      const endpoint = mockEndpointForMatch(mockData);
      if (!endpointMatchesDomainPath(endpoint, prefix)) continue;
      if (!opts.useLiveApi && mockData.responsePending === true) {
        skippedPending += 1;
        continue;
      }
      applyMockReplayModeSetting(mockData, opts.useLiveApi ? 'passthrough' : 'stored');
      fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2), 'utf-8');
      updated += 1;
    }
  }

  return {
    ok: true,
    scenario: scenarioName,
    domainPath: prefix,
    useLiveApi: opts.useLiveApi,
    updated,
    skippedPending,
  };
}

export async function bulkCaptureResponsesForDomain(opts: {
  provider: 'filesystem' | 'sqlite' | 'redis';
  mockDataPath: string;
  scenario: string;
  domainPath: string;
  clientId?: string;
  redisUrl?: string;
  keyPrefix?: string;
}): Promise<BulkCaptureResponsesResult> {
  const scenarioName = opts.scenario.trim();
  const prefix = opts.domainPath.trim();
  let captured = 0;
  let skippedAlready = 0;
  let failed = 0;
  const errors: BulkCaptureResponsesResult['errors'] = [];

  async function captureOne(mockData: MockData): Promise<boolean> {
    const req = mockData.request;
    if (!req?.url || !req.method) {
      failed += 1;
      errors.push({ endpoint: req?.url ?? null, message: 'Missing request url or method' });
      return false;
    }
    try {
      const { response, durationMs } = await fetchUpstreamResponse(req, {
        clientId: opts.clientId,
      });
      applyCapturedResponse(mockData, response);
      mockData.duration = durationMs;
      mockData.timestamp = new Date().toISOString();
      return true;
    } catch (err: unknown) {
      failed += 1;
      errors.push({
        endpoint: mockEndpointForMatch(mockData),
        message: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  if (opts.provider === 'redis') {
    const store = new RedisMockStore({
      redisUrl: opts.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
      keyPrefix: opts.keyPrefix,
      mockDataPath: opts.mockDataPath,
    });
    try {
      const items = await store.list(scenarioName);
      for (const { hash, mockData } of items) {
        const endpoint = mockEndpointForMatch(mockData);
        if (!endpointMatchesDomainPath(endpoint, prefix)) continue;
        if (!needsResponseCapture(mockData)) {
          skippedAlready += 1;
          continue;
        }
        const ok = await captureOne(mockData);
        if (ok) {
          await store.setByHashInScenario(hash, mockData, scenarioName);
          captured += 1;
        }
      }
    } finally {
      await store.close().catch(() => undefined);
    }
  } else {
    const scenarioPath = getScenarioFolderPath(opts.mockDataPath, scenarioName);
    for (const filePath of getAllJsonFiles(scenarioPath)) {
      let mockData: MockData;
      try {
        mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
      } catch {
        continue;
      }
      const endpoint = mockEndpointForMatch(mockData);
      if (!endpointMatchesDomainPath(endpoint, prefix)) continue;
      if (!needsResponseCapture(mockData)) {
        skippedAlready += 1;
        continue;
      }
      const ok = await captureOne(mockData);
      if (ok) {
        fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2), 'utf-8');
        captured += 1;
      }
    }
  }

  return {
    ok: true,
    scenario: scenarioName,
    domainPath: prefix,
    captured,
    skippedAlready,
    failed,
    errors: errors.slice(0, 20),
  };
}
