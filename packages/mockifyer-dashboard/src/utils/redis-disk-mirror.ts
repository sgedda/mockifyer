import fs from 'fs';
import path from 'path';
import type { MockData } from '@sgedda/mockifyer-core';
import {
  mockPassesThroughToRealApi,
  ensureScenarioFolder,
  shouldExcludeUrl,
  checkRequestLimit,
} from '@sgedda/mockifyer-core';
import { RedisMockStore } from './redis-mock-store';
import { getAllJsonFiles } from './json-files';
import { requireSafeScenarioName } from './scenario-name';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Stable relative path under a scenario folder for a mock mirrored from Redis proxy recording.
 * Matches the pseudo-path used in scenario bundles (`redis/<hash>.json`).
 */
export function mirroredMockRelativePath(hash: string): string {
  return `redis/${hash}.json`;
}

function requireSha256Hash(hash: string): string {
  const id = String(hash || '').trim();
  if (!SHA256_HEX_PATTERN.test(id)) {
    throw new Error('Invalid mock hash');
  }
  return id;
}

function getSafeScenarioPath(mockDataPath: string, scenarioName: string): string {
  const safeScenarioName = requireSafeScenarioName(scenarioName, 'scenarioName');
  const root = path.resolve(mockDataPath);
  const scenarioPath = path.resolve(root, safeScenarioName);
  const relative = path.relative(root, scenarioPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Scenario path escapes mock data root: ${safeScenarioName}`);
  }
  return scenarioPath;
}

/**
 * Find a mock on disk for the given scenario whose canonical hash matches {@link RedisMockStore.hashForMock}.
 * Walks all `.json` files under `mockDataPath/<scenario>/` recursively (same as filesystem provider matching).
 */
export function findMockOnDiskByRequestHash(
  mockDataPath: string,
  scenarioName: string,
  hash: string
): MockData | null {
  const safeHash = requireSha256Hash(hash);
  const scenarioPath = getSafeScenarioPath(mockDataPath, scenarioName);
  if (!fs.existsSync(scenarioPath)) {
    return null;
  }
  for (const filePath of getAllJsonFiles(scenarioPath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const mockData = JSON.parse(raw) as MockData;
      if (!mockData?.request || typeof mockData.request !== 'object') {
        continue;
      }
      if (mockPassesThroughToRealApi(mockData)) {
        continue;
      }
      if (RedisMockStore.hashForMock(mockData) !== safeHash) {
        continue;
      }
      return mockData;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Persist a recorded mock to disk under `mockDataPath/<scenario>/redis/<hash>.json` for version control.
 * Overwrites if the same hash is recorded again. Respects {@link checkRequestLimit} and URL exclusion.
 */
export function mirrorRecordedMockToDisk(params: {
  mockDataPath: string;
  scenarioName: string;
  hash: string;
  mockData: MockData;
}): void {
  const { mockDataPath, scenarioName, hash, mockData } = params;
  const safeHash = requireSha256Hash(hash);
  const requestUrl = mockData?.request?.url || '';
  if (shouldExcludeUrl(requestUrl, undefined)) {
    return;
  }
  const limitCheck = checkRequestLimit(mockDataPath);
  if (limitCheck.limitReached && limitCheck.error) {
    console.warn(`[Mockifyer Dashboard] Redis disk mirror: ${limitCheck.error.message}`);
    return;
  }
  const safeScenarioName = requireSafeScenarioName(scenarioName, 'scenarioName');
  ensureScenarioFolder(mockDataPath, safeScenarioName);
  const scenarioPath = getSafeScenarioPath(mockDataPath, safeScenarioName);
  const rel = mirroredMockRelativePath(safeHash);
  const filePath = path.join(scenarioPath, 'redis', `${safeHash}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
  console.log(`[Mockifyer Dashboard] Mirrored recorded mock to disk: ${safeScenarioName}/${rel}`);
}
