import fs from 'fs';
import path from 'path';
import {
  applyCapturedResponse,
  applyMockReplayModeSetting,
  getScenarioFolderPath,
  mockHasCapturableResponse,
  type MockData,
  type MockReplayMode,
} from '@sgedda/mockifyer-core';
import { getAllJsonFiles } from './json-files';
import { endpointMatchesDomainPath } from './domain-tree-match';
import { fetchUpstreamResponse } from './capture-upstream-response';
import { createDashboardMockStore, toDashboardRedisStoreConfig, type DashboardRedisConfig } from './create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from './dashboard-provider';

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
  redisCluster?: boolean;
}): Promise<BulkLiveApiResult> {
  const scenarioName = opts.scenario.trim();
  const prefix = opts.domainPath.trim();
  let updated = 0;
  let skippedPending = 0;

  if (isCentralizedDashboardProvider(opts.provider)) {
    const store = createDashboardMockStore(
      toDashboardRedisStoreConfig(opts as DashboardRedisConfig),
      opts.mockDataPath
    );
    try {
      const items = await store.list(scenarioName);
      for (const { hash, mockData } of items) {
        const endpoint = mockEndpointForMatch(mockData);
        if (!endpointMatchesDomainPath(endpoint, prefix)) continue;
        if (!opts.useLiveApi && mockData.responsePending === true) {
          skippedPending += 1;
          continue;
        }
        if (opts.useLiveApi) {
          mockData.alwaysUseRealApi = true;
        } else {
          delete mockData.alwaysUseRealApi;
        }
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
      if (opts.useLiveApi) {
        mockData.alwaysUseRealApi = true;
      } else {
        delete mockData.alwaysUseRealApi;
      }
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
  redisCluster?: boolean;
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

  if (isCentralizedDashboardProvider(opts.provider)) {
    const store = createDashboardMockStore(
      toDashboardRedisStoreConfig(opts as DashboardRedisConfig),
      opts.mockDataPath
    );
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

export const BULK_REPLAY_MODE_MAX_FILES = 5000;

export interface BulkReplayModeResult {
  ok: true;
  scenario: string;
  updatedStored: number;
  updatedLive: number;
  queuedRefreshNext: number;
  skippedPending: number;
  missing: number;
}

function parseRedisHashFromFilename(relativeName: string): string | null {
  if (!relativeName.startsWith('redis/')) return null;
  if (!relativeName.endsWith('.json')) return null;
  const hash = relativeName.slice('redis/'.length, -'.json'.length);
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
  return hash;
}

function resolveScenarioMockFilePath(scenarioPath: string, relativeName: string): string | null {
  if (!relativeName.endsWith('.json') || relativeName.includes('\0')) return null;
  const resolved = path.resolve(scenarioPath, relativeName);
  const root = path.resolve(scenarioPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function uniqueTrimmedFilenames(list: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list ?? []) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

type ReplayModeApplyOutcome = 'stored' | 'refresh-next' | 'passthrough';

/**
 * Applies replay mode. `stored` on a request-only stub becomes refresh-next so the next
 * matching request captures a body, then later requests replay that saved mock.
 */
function applyReplayModeToMock(mockData: MockData, mode: MockReplayMode): ReplayModeApplyOutcome {
  applyMockReplayModeSetting(mockData, mode);
  if (mode === 'passthrough') {
    return 'passthrough';
  }
  if (mockData.refreshOnNextRequest === true) {
    return 'refresh-next';
  }
  return 'stored';
}

interface ReplayModeApplyCounts {
  updatedStored: number;
  updatedLive: number;
  queuedRefreshNext: number;
}

function tallyReplayOutcome(outcome: ReplayModeApplyOutcome, counts: ReplayModeApplyCounts): void {
  if (outcome === 'passthrough') {
    counts.updatedLive += 1;
    return;
  }
  if (outcome === 'refresh-next') {
    counts.queuedRefreshNext += 1;
    return;
  }
  counts.updatedStored += 1;
}

/**
 * Set replay mode on specific mock files (`stored` = use mock, `passthrough` = live API).
 * Pending stubs requested as `stored` are queued as refresh-next (capture on next request, then replay).
 */
export async function bulkSetReplayModeForFilenames(opts: {
  provider: 'filesystem' | 'sqlite' | 'redis';
  mockDataPath: string;
  scenario: string;
  stored?: string[];
  passthrough?: string[];
  redisUrl?: string;
  keyPrefix?: string;
  redisCluster?: boolean;
}): Promise<BulkReplayModeResult> {
  const scenarioName = opts.scenario.trim();
  const stored = uniqueTrimmedFilenames(opts.stored);
  const storedSet = new Set(stored);
  const passthrough = uniqueTrimmedFilenames(opts.passthrough).filter((name) => !storedSet.has(name));
  const total = stored.length + passthrough.length;
  if (total > BULK_REPLAY_MODE_MAX_FILES) {
    throw new Error(`Too many files (max ${BULK_REPLAY_MODE_MAX_FILES})`);
  }

  const counts: ReplayModeApplyCounts = {
    updatedStored: 0,
    updatedLive: 0,
    queuedRefreshNext: 0,
  };
  let missing = 0;

  const jobs: Array<{ filename: string; mode: MockReplayMode }> = [
    ...passthrough.map((filename) => ({ filename, mode: 'passthrough' as const })),
    ...stored.map((filename) => ({ filename, mode: 'stored' as const })),
  ];

  if (isCentralizedDashboardProvider(opts.provider)) {
    const store = createDashboardMockStore(
      toDashboardRedisStoreConfig(opts as DashboardRedisConfig),
      opts.mockDataPath
    );
    try {
      for (const job of jobs) {
        const hash = parseRedisHashFromFilename(job.filename);
        if (!hash) {
          missing += 1;
          continue;
        }
        const mockData = await store.getByHash(hash, scenarioName);
        if (!mockData) {
          missing += 1;
          continue;
        }
        const outcome = applyReplayModeToMock(mockData, job.mode);
        await store.setByHashInScenario(hash, mockData, scenarioName);
        tallyReplayOutcome(outcome, counts);
      }
    } finally {
      await store.close().catch(() => undefined);
    }
  } else {
    const scenarioPath = getScenarioFolderPath(opts.mockDataPath, scenarioName);
    for (const job of jobs) {
      const filePath = resolveScenarioMockFilePath(scenarioPath, job.filename);
      if (!filePath || !fs.existsSync(filePath)) {
        missing += 1;
        continue;
      }
      let mockData: MockData;
      try {
        mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
      } catch {
        missing += 1;
        continue;
      }
      const outcome = applyReplayModeToMock(mockData, job.mode);
      fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2), 'utf-8');
      tallyReplayOutcome(outcome, counts);
    }
  }

  return {
    ok: true,
    scenario: scenarioName,
    updatedStored: counts.updatedStored,
    updatedLive: counts.updatedLive,
    queuedRefreshNext: counts.queuedRefreshNext,
    skippedPending: 0,
    missing,
  };
}
