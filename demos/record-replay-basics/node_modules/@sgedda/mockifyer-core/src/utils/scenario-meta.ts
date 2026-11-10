import { getScenarioFolderPath } from './scenario';

// Conditionally import fs and path - will be undefined in React Native
let fs: typeof import('fs') | undefined;
let path: typeof import('path') | undefined;

try {
  fs = require('fs');
  path = require('path');
} catch {
  fs = undefined;
  path = undefined;
}

/** Reserved filename at the root of each scenario folder (not a mock request file). */
export const SCENARIO_META_FILENAME = 'scenario-meta.json';

export interface ScenarioMeta {
  locked?: boolean;
  updatedAt?: string;
}

export function getScenarioMetaPath(mockDataPath: string, scenario: string): string {
  return path
    ? path.join(getScenarioFolderPath(mockDataPath, scenario), SCENARIO_META_FILENAME)
    : `${mockDataPath}/${scenario}/${SCENARIO_META_FILENAME}`;
}

/**
 * Read scenario metadata from disk. Returns null if missing or unreadable.
 */
export function readScenarioMeta(mockDataPath: string, scenario: string): ScenarioMeta | null {
  if (!fs?.existsSync || !fs.readFileSync) return null;
  const p = getScenarioMetaPath(mockDataPath, scenario);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as ScenarioMeta;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function isScenarioLockedFs(mockDataPath: string, scenario: string): boolean {
  const meta = readScenarioMeta(mockDataPath, scenario);
  return meta?.locked === true;
}

/**
 * Persist scenario metadata (creates scenario folder if needed).
 */
export function writeScenarioMeta(mockDataPath: string, scenario: string, meta: ScenarioMeta): void {
  if (!fs?.writeFileSync || !fs.mkdirSync) return;
  const folder = getScenarioFolderPath(mockDataPath, scenario);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  const payload: ScenarioMeta = {
    ...meta,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getScenarioMetaPath(mockDataPath, scenario), JSON.stringify(payload, null, 2), 'utf-8');
}

export function setScenarioLockedFs(mockDataPath: string, scenario: string, locked: boolean): void {
  const prev = readScenarioMeta(mockDataPath, scenario) || {};
  writeScenarioMeta(mockDataPath, scenario, { ...prev, locked });
}

/**
 * If `candidate` differs only by case from an entry in `existingScenarioNames`, return that entry; otherwise null.
 */
export function findCaseInsensitiveScenarioConflict(
  candidate: string,
  existingScenarioNames: string[]
): string | null {
  const lower = candidate.toLowerCase();
  for (const s of existingScenarioNames) {
    if (s.toLowerCase() === lower) return s;
  }
  return null;
}
