import fs from 'fs';
import path from 'path';
import {
  applyMockReplayModeSetting,
  getScenarioFolderPath,
  type MockData,
  type MockReplayMode,
} from '@sgedda/mockifyer-core';
import { getAllJsonFiles } from './json-files';
import { endpointMatchesDomainPath } from './domain-tree-match';
import { createDashboardMockStore, toDashboardRedisStoreConfig, type DashboardRedisConfig } from './create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from './dashboard-provider';
import {
  applyReplayModeToRawMock,
  mockReplayFlagsEqual,
  parseMockJsonForCatalog,
  snapshotMockReplayFlags,
} from './mock-json-catalog';
import type { RedisMockStore } from './redis-mock-store';

export interface BulkLiveApiResult {
  ok: true;
  scenario: string;
  domainPath: string;
  useLiveApi: boolean;
  updated: number;
  skippedPending: number;
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

const BULK_STORE_WRITE_CONCURRENCY = 16;

type ReplayModeApplyOutcome = 'stored' | 'refresh-next' | 'passthrough';

function catalogNeedsReplayModeChange(mockData: MockData, mode: MockReplayMode): boolean {
  const probe: MockData = { ...mockData };
  const before = snapshotMockReplayFlags(mockData);
  applyMockReplayModeSetting(probe, mode);
  return !mockReplayFlagsEqual(before, snapshotMockReplayFlags(probe));
}

async function persistRawReplayModeOnStore(
  store: RedisMockStore,
  hash: string,
  scenarioName: string,
  mode: MockReplayMode
): Promise<ReplayModeApplyOutcome | 'unchanged' | 'missing'> {
  const raw = await store.getRawByHashInScenario(hash, scenarioName);
  if (!raw) return 'missing';
  const patched = applyReplayModeToRawMock(raw, mode);
  if (!patched) return 'missing';
  if (!patched.changed) return 'unchanged';
  await store.replaceRawMockInScenario(hash, scenarioName, patched.raw, patched.compact, {
    invalidateCatalog: false,
  });
  return patched.outcome;
}

function persistRawReplayModeOnFile(
  filePath: string,
  mode: MockReplayMode
): ReplayModeApplyOutcome | 'unchanged' | 'missing' {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return 'missing';
  }
  const patched = applyReplayModeToRawMock(raw, mode);
  if (!patched) return 'missing';
  if (!patched.changed) return 'unchanged';
  fs.writeFileSync(filePath, patched.raw, 'utf-8');
  return patched.outcome;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, concurrency);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
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
  const desiredMode: MockReplayMode = opts.useLiveApi ? 'passthrough' : 'stored';
  let updated = 0;
  const skippedPending = 0;

  if (isCentralizedDashboardProvider(opts.provider)) {
    const store = createDashboardMockStore(
      toDashboardRedisStoreConfig(opts as DashboardRedisConfig),
      opts.mockDataPath
    );
    try {
      const catalogItems = await store.listCatalog(scenarioName);
      const matching = catalogItems.filter((item) => {
        const endpoint = mockEndpointForMatch(item.mockData);
        if (!endpointMatchesDomainPath(endpoint, prefix)) return false;
        return catalogNeedsReplayModeChange(item.mockData, desiredMode);
      });
      await mapPool(matching, BULK_STORE_WRITE_CONCURRENCY, async ({ hash }) => {
        const outcome = await persistRawReplayModeOnStore(store, hash, scenarioName, desiredMode);
        if (outcome === 'missing' || outcome === 'unchanged') return;
        updated += 1;
      });
      store.clearCatalogCache(scenarioName);
    } finally {
      await store.close().catch(() => undefined);
    }
  } else {
    const scenarioPath = getScenarioFolderPath(opts.mockDataPath, scenarioName);
    for (const filePath of getAllJsonFiles(scenarioPath)) {
      let raw: string;
      try {
        raw = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }
      let mockData: MockData;
      try {
        mockData = parseMockJsonForCatalog(raw).mockData;
      } catch {
        continue;
      }
      const endpoint = mockEndpointForMatch(mockData);
      if (!endpointMatchesDomainPath(endpoint, prefix)) continue;
      if (!catalogNeedsReplayModeChange(mockData, desiredMode)) continue;
      const patched = applyReplayModeToRawMock(raw, desiredMode);
      if (!patched || !patched.changed) continue;
      fs.writeFileSync(filePath, patched.raw, 'utf-8');
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
      const catalogItems = await store.listCatalog(scenarioName);
      const catalogByHash = new Map(catalogItems.map((item) => [item.hash, item.mockData]));
      await mapPool(jobs, BULK_STORE_WRITE_CONCURRENCY, async (job) => {
        const hash = parseRedisHashFromFilename(job.filename);
        if (!hash) {
          missing += 1;
          return;
        }
        const catalogMock = catalogByHash.get(hash);
        if (catalogMock && !catalogNeedsReplayModeChange(catalogMock, job.mode)) return;
        const outcome = await persistRawReplayModeOnStore(store, hash, scenarioName, job.mode);
        if (outcome === 'missing') {
          missing += 1;
          return;
        }
        if (outcome === 'unchanged') return;
        tallyReplayOutcome(outcome, counts);
      });
      store.clearCatalogCache(scenarioName);
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
      const outcome = persistRawReplayModeOnFile(filePath, job.mode);
      if (outcome === 'missing') {
        missing += 1;
        continue;
      }
      if (outcome === 'unchanged') continue;
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
