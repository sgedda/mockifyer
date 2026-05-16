import fs from 'fs';
import path from 'path';
import type { MockData } from '@sgedda/mockifyer-core';
import {
  mockPassesThroughToRealApi,
  getScenarioFolderPath,
  ensureScenarioFolder,
  shouldExcludeUrl,
  checkRequestLimit,
} from '@sgedda/mockifyer-core';
import { RedisMockStore } from './redis-mock-store';
import { getAllJsonFiles } from './json-files';

/**
 * Stable relative path under a scenario folder for a mock mirrored from Redis proxy recording.
 * Matches the pseudo-path used in scenario bundles (`redis/<hash>.json`).
 */
export function mirroredMockRelativePath(hash: string): string {
  return `redis/${hash}.json`;
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
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenarioName);
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
      if (RedisMockStore.hashForMock(mockData) !== hash) {
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
  const requestUrl = mockData?.request?.url || '';
  if (shouldExcludeUrl(requestUrl, undefined)) {
    return;
  }
  const limitCheck = checkRequestLimit(mockDataPath);
  if (limitCheck.limitReached && limitCheck.error) {
    console.warn(`[Mockifyer Dashboard] Redis disk mirror: ${limitCheck.error.message}`);
    return;
  }
  ensureScenarioFolder(mockDataPath, scenarioName);
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenarioName);
  const rel = mirroredMockRelativePath(hash);
  const filePath = path.join(scenarioPath, 'redis', `${hash}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
  console.log(`[Mockifyer Dashboard] Mirrored recorded mock to disk: ${scenarioName}/${rel}`);
}
