import fs from 'fs';
import path from 'path';
import {
  applyMockReplayModeSetting,
  DOMAIN_PATH_RULES_FILENAME,
  SCENARIO_META_FILENAME,
  type MockData,
} from '@sgedda/mockifyer-core';
import { getAllJsonFiles } from './json-files';

const DATE_CONFIG_BASENAME = 'date-config.json';

const SKIP_CLONE_REPLAY_RESET = new Set([
  DATE_CONFIG_BASENAME,
  SCENARIO_META_FILENAME,
  DOMAIN_PATH_RULES_FILENAME,
]);

/**
 * Replay mode is per-scenario. Favorites identify a request across scenarios, but
 * "Use saved mock" / Live / Refresh must not follow the star into a newly derived scenario.
 * Cloned recordings keep their bodies and start on live API until opted into replay here.
 */
export function resetReplayModeForDerivedScenario(mockData: MockData): void {
  applyMockReplayModeSetting(mockData, 'passthrough');
}

function isRecordedMockData(value: unknown): value is MockData {
  if (!value || typeof value !== 'object') return false;
  const data = value as { request?: unknown; response?: unknown };
  return Boolean(data.request && data.response);
}

/** Parse a cloned mock JSON document and strip source-scenario replay flags. */
export function rewriteClonedMockJson(raw: string, options?: { pretty?: boolean }): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecordedMockData(parsed)) return null;
    resetReplayModeForDerivedScenario(parsed);
    if (options?.pretty === false) {
      return JSON.stringify(parsed);
    }
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return null;
  }
}

/** After a filesystem scenario copy, clear replay mode on every recorded mock. */
export function resetReplayModesInScenarioFolder(scenarioDir: string): number {
  if (!fs.existsSync(scenarioDir)) return 0;
  let updated = 0;
  for (const filePath of getAllJsonFiles(scenarioDir)) {
    if (SKIP_CLONE_REPLAY_RESET.has(path.basename(filePath))) continue;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const next = rewriteClonedMockJson(raw);
      if (!next || next === raw) continue;
      fs.writeFileSync(filePath, next, 'utf-8');
      updated += 1;
    } catch {
      // leave unreadable/non-mock JSON as copied
    }
  }
  return updated;
}
