import * as fs from 'fs';
import * as path from 'path';
import {
  collectPoolRefIds,
  getScenarioFolderPath,
  listScenarios,
  SCENARIO_MANIFEST_FILENAME,
  type MockData,
} from '@sgedda/mockifyer-core';

/**
 * Config / manifest files that live in scenario folders but are not mock recordings.
 */
function isNonMockScenarioJsonBasename(basename: string): boolean {
  if (
    basename === 'scenario-config.json' ||
    basename === 'date-config.json' ||
    basename === 'proxy-config.json' ||
    basename === SCENARIO_MANIFEST_FILENAME
  ) {
    return true;
  }
  return basename.startsWith('scenario-config.') || basename.startsWith('date-config.');
}

/** Recursively collect `.json` mock file paths under a scenario folder. */
export function listScenarioMockJsonFiles(scenarioPath: string): string[] {
  if (!fs.existsSync(scenarioPath)) return [];
  const results: string[] = [];

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      if (isNonMockScenarioJsonBasename(entry.name)) continue;
      results.push(fullPath);
    }
  };

  walk(scenarioPath);
  return results;
}

/** True when a mock's response body embeds a `$pool` ref to `responseItemId`. */
export function mockDataReferencesPoolResponse(
  mockData: Pick<MockData, 'response'>,
  responseItemId: string
): boolean {
  return collectPoolRefIds(mockData.response?.data).has(responseItemId);
}

/**
 * Find filesystem scenarios whose mock recordings embed `$pool.id === responseItemId`.
 * This is the v1 activation path; deferred slot manifests are checked separately.
 */
export function findPoolRefReferencingScenariosOnDisk(
  mockDataPath: string,
  responseItemId: string
): string[] {
  const referencing: string[] = [];
  for (const scenario of listScenarios(mockDataPath)) {
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    for (const filePath of listScenarioMockJsonFiles(scenarioPath)) {
      try {
        const mockData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as MockData;
        if (mockDataReferencesPoolResponse(mockData, responseItemId)) {
          referencing.push(scenario);
          break;
        }
      } catch {
        // Skip unreadable / non-mock JSON
      }
    }
  }
  return referencing;
}

/** Merge scenario name lists, de-duplicated and sorted for stable API responses. */
export function mergeReferencingScenarios(...lists: string[][]): string[] {
  return [...new Set(lists.flat())].sort();
}
