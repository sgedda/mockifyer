/**
 * Node filesystem helpers for `domain-path-rules.json`.
 * Not exported from the React Native entry (uses `fs` / `path`).
 */

import type { DomainPathRulesMap } from './domain-path-rules';
import {
  DOMAIN_PATH_RULES_FILENAME,
  parseDomainPathRules,
} from './domain-path-rules';
import { getScenarioFolderPath } from './scenario';

let fs: typeof import('fs') | undefined;
let pathMod: typeof import('path') | undefined;

try {
  fs = require('fs');
  pathMod = require('path');
} catch {
  fs = undefined;
  pathMod = undefined;
}

export { DOMAIN_PATH_RULES_FILENAME };

/** Retry delay while waiting for a sibling `.lock` file. */
const DOMAIN_PATH_RULES_LOCK_RETRY_MS = 10;
/** Give up waiting for another writer. */
const DOMAIN_PATH_RULES_LOCK_TIMEOUT_MS = 8000;
/** Steal a lock file left behind by a crashed process. */
const DOMAIN_PATH_RULES_LOCK_STALE_MS = 2000;
/** Re-read attempts when JSON.parse fails (torn read from a non-atomic writer). */
const DOMAIN_PATH_RULES_READ_RETRY_COUNT = 3;
const DOMAIN_PATH_RULES_READ_RETRY_MS = 10;

const inProcessLockChains = new Map<string, Promise<void>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneDomainPathRulesMap(rules: DomainPathRulesMap): DomainPathRulesMap {
  const out: DomainPathRulesMap = {};
  for (const [key, value] of Object.entries(rules)) {
    out[key] = { ...value };
  }
  return out;
}

/** Absolute path to `domain-path-rules.json` for a scenario. */
export function domainPathRulesFilePath(mockDataPath: string, scenario: string): string | null {
  if (!pathMod) {
    return null;
  }
  return pathMod.join(getScenarioFolderPath(mockDataPath, scenario), DOMAIN_PATH_RULES_FILENAME);
}

function domainPathRulesLockPath(filePath: string): string {
  return `${filePath}.lock`;
}

function releaseExclusiveLockFile(lockPath: string): void {
  if (!fs) {
    return;
  }
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // already released
  }
}

async function acquireExclusiveLockFile(lockPath: string): Promise<void> {
  if (!fs) {
    return;
  }
  const startedAt = Date.now();
  for (;;) {
    try {
      fs.writeFileSync(lockPath, `${process.pid}\n${Date.now()}\n`, { flag: 'wx' });
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw err;
      }
      try {
        const st = fs.statSync(lockPath);
        if (Date.now() - st.mtimeMs > DOMAIN_PATH_RULES_LOCK_STALE_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() - startedAt > DOMAIN_PATH_RULES_LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for domain-path-rules lock: ${lockPath}`);
      }
      await sleep(DOMAIN_PATH_RULES_LOCK_RETRY_MS);
    }
  }
}

/**
 * Serialize in-process waiters, then take a cross-process `.lock` file so
 * dashboard POST / Metro POST / SDK discover persist cannot tear or lose updates.
 */
async function withDomainPathRulesFileLock(lockPath: string, fn: () => Promise<void> | void): Promise<void> {
  const previous = inProcessLockChains.get(lockPath) ?? Promise.resolve();
  let releaseInProcess!: () => void;
  const held = new Promise<void>((resolve) => {
    releaseInProcess = resolve;
  });
  inProcessLockChains.set(
    lockPath,
    previous.then(
      () => held,
      () => held
    )
  );
  try {
    await previous;
    await acquireExclusiveLockFile(lockPath);
    try {
      await fn();
    } finally {
      releaseExclusiveLockFile(lockPath);
    }
  } finally {
    releaseInProcess();
  }
}

/** Load per-scenario domain path rules from `mock-data/<scenario>/domain-path-rules.json`. */
export function readDomainPathRulesFile(mockDataPath: string, scenario: string): DomainPathRulesMap {
  if (!fs || !pathMod) {
    return {};
  }
  const filePath = domainPathRulesFilePath(mockDataPath, scenario);
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return parseDomainPathRules(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function readDomainPathRulesFileForUpdate(
  mockDataPath: string,
  scenario: string
): Promise<DomainPathRulesMap> {
  if (!fs || !pathMod) {
    return {};
  }
  const filePath = domainPathRulesFilePath(mockDataPath, scenario);
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < DOMAIN_PATH_RULES_READ_RETRY_COUNT; attempt += 1) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return parseDomainPathRules(JSON.parse(raw));
    } catch (err) {
      lastError = err;
      if (attempt < DOMAIN_PATH_RULES_READ_RETRY_COUNT - 1) {
        await sleep(DOMAIN_PATH_RULES_READ_RETRY_MS);
      }
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to parse domain-path-rules.json for scenario "${scenario}": ${detail}`);
}

/**
 * Persist domain path rules next to scenario mocks.
 * Writes via temp + rename so concurrent readers never see torn JSON.
 */
export function writeDomainPathRulesFile(
  mockDataPath: string,
  scenario: string,
  rules: DomainPathRulesMap
): void {
  if (!fs || !pathMod) {
    return;
  }
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  fs.mkdirSync(scenarioPath, { recursive: true });
  const filePath = pathMod.join(scenarioPath, DOMAIN_PATH_RULES_FILENAME);
  if (Object.keys(rules).length === 0) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }
  const payload = `${JSON.stringify(rules, null, 2)}\n`;
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, payload, 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup
    }
    throw err;
  }
}

export interface UpdateDomainPathRulesFileResult {
  rules: DomainPathRulesMap;
  changed: boolean;
}

/**
 * Atomically read-modify-write `domain-path-rules.json` for a scenario.
 *
 * Holds a lock across the full RMW so a dashboard flag toggle cannot be
 * overwritten by a concurrent discover persist (and vice versa: new discovery
 * keys are not dropped by a stale full-document write).
 */
export async function updateDomainPathRulesFile(
  mockDataPath: string,
  scenario: string,
  updater: (rules: DomainPathRulesMap) => DomainPathRulesMap
): Promise<UpdateDomainPathRulesFileResult> {
  if (!fs || !pathMod) {
    const rules = updater({});
    return { rules, changed: Object.keys(rules).length > 0 };
  }

  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  fs.mkdirSync(scenarioPath, { recursive: true });
  const filePath = pathMod.join(scenarioPath, DOMAIN_PATH_RULES_FILENAME);
  const lockPath = domainPathRulesLockPath(filePath);

  let result: UpdateDomainPathRulesFileResult = { rules: {}, changed: false };
  await withDomainPathRulesFileLock(lockPath, async () => {
    const current = await readDomainPathRulesFileForUpdate(mockDataPath, scenario);
    // Yield so overlapping callers actually queue on the lock (and so tests
    // exercise the wait path rather than completing the RMW in one tick).
    await Promise.resolve();
    const next = updater(cloneDomainPathRulesMap(current));
    const changed = JSON.stringify(current) !== JSON.stringify(next);
    if (changed) {
      writeDomainPathRulesFile(mockDataPath, scenario, next);
    }
    result = { rules: next, changed };
  });
  return result;
}
