import type {
  PoolEntity,
  PoolIndex,
  PoolResponseItem,
  ScenarioManifest,
} from '../../types/fixture-pool';
import {
  POOL_DIR_NAME,
  POOL_ENTITIES_DIR,
  POOL_INDEX_FILENAME,
  POOL_INDEX_LOCK_FILENAME,
  POOL_RESPONSES_DIR,
  SCENARIO_MANIFEST_FILENAME,
} from '../../types/fixture-pool';
import { emptyPoolIndex, emptyScenarioManifest, validatePoolIndex, validateScenarioManifest } from './validate';

/** Default how long to wait for an exclusive pool-index lock before failing. */
export const POOL_INDEX_LOCK_TIMEOUT_MS = 10_000;
/** Interval between exclusive lock acquisition retries. */
export const POOL_INDEX_LOCK_RETRY_MS = 15;
/** Steal a lock file older than this (crashed holder). */
export const POOL_INDEX_LOCK_STALE_MS = 30_000;

export interface FixturePoolWriteFileOptions {
  encoding: 'utf8';
  /** Pass `'wx'` for exclusive create (used by the pool-index lock). */
  flag?: string;
}

export interface FixturePoolFsAdapter {
  joinPath: (...parts: string[]) => string;
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
  writeFileSync: (
    path: string,
    data: string,
    encodingOrOptions: 'utf8' | FixturePoolWriteFileOptions
  ) => void;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
  /** Required for pool-index locking (releases `pool-index.json.lock`). */
  unlinkSync?: (path: string) => void;
  readdirSync?: (path: string) => string[];
}

/**
 * Resolve pool root: mock-data/pool
 */
export function getPoolRootPath(mockDataPath: string, fs: FixturePoolFsAdapter): string {
  return fs.joinPath(mockDataPath, POOL_DIR_NAME);
}

export function getPoolIndexPath(mockDataPath: string, fs: FixturePoolFsAdapter): string {
  return fs.joinPath(getPoolRootPath(mockDataPath, fs), POOL_INDEX_FILENAME);
}

export function getPoolIndexLockPath(mockDataPath: string, fs: FixturePoolFsAdapter): string {
  return fs.joinPath(getPoolRootPath(mockDataPath, fs), POOL_INDEX_LOCK_FILENAME);
}

export function getEntityPath(mockDataPath: string, id: string, fs: FixturePoolFsAdapter): string {
  return fs.joinPath(getPoolRootPath(mockDataPath, fs), POOL_ENTITIES_DIR, `${id}.json`);
}

export function getResponseFixturePath(
  mockDataPath: string,
  id: string,
  fs: FixturePoolFsAdapter
): string {
  return fs.joinPath(getPoolRootPath(mockDataPath, fs), POOL_RESPONSES_DIR, `${id}.json`);
}

export function getScenarioManifestPath(
  mockDataPath: string,
  scenario: string,
  fs: FixturePoolFsAdapter
): string {
  return fs.joinPath(mockDataPath, scenario, SCENARIO_MANIFEST_FILENAME);
}

export class PoolIndexLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoolIndexLoadError';
  }
}

export class PoolIndexLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoolIndexLockError';
  }
}

/** Thrown when a locked mutation finds a duplicate entity/response id. */
export class PoolIndexConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoolIndexConflictError';
  }
}

function sleepSync(ms: number): void {
  if (ms <= 0) return;
  const sab = new SharedArrayBuffer(4);
  const ia = new Int32Array(sab);
  Atomics.wait(ia, 0, 0, ms);
}

function isExclusiveCreateConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  return code === 'EEXIST' || code === 'EPERM';
}

interface PoolIndexLockPayload {
  pid: number;
  createdAt: string;
}

/**
 * Attempt to remove a stale pool-index lock.
 * @param corruptFirstSeenMs Mutable holder: first time we observed an unreadable lock
 *   (used so corrupt locks are reclaimed after `staleMs`, matching readable stale locks).
 */
function tryStealStaleLock(
  lockPath: string,
  fs: FixturePoolFsAdapter,
  nowMs: number,
  staleMs: number,
  corruptFirstSeenMs: { value: number | null }
): boolean {
  if (!fs.unlinkSync || !fs.existsSync(lockPath)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as Partial<PoolIndexLockPayload>;
    // Readable payload — reset corrupt tracking.
    corruptFirstSeenMs.value = null;
    const createdAtMs = raw.createdAt ? Date.parse(raw.createdAt) : NaN;
    if (!Number.isFinite(createdAtMs) || nowMs - createdAtMs < staleMs) {
      return false;
    }
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    // Corrupt / unreadable lock: reclaim after the same stale window so a crashed
    // writer cannot permanently block all pool mutations.
    if (corruptFirstSeenMs.value === null) {
      corruptFirstSeenMs.value = nowMs;
    }
    if (nowMs - corruptFirstSeenMs.value < staleMs) {
      return false;
    }
    fs.unlinkSync(lockPath);
    corruptFirstSeenMs.value = null;
    return true;
  }
}

/**
 * Acquire an exclusive lock file for pool-index read-modify-write.
 * Uses `wx` create so concurrent processes cannot hold the lock together.
 */
export function acquirePoolIndexLock(
  mockDataPath: string,
  fs: FixturePoolFsAdapter,
  options?: { timeoutMs?: number; retryMs?: number; staleMs?: number }
): string {
  if (!fs.unlinkSync) {
    throw new PoolIndexLockError(
      'FixturePoolFsAdapter.unlinkSync is required to lock pool-index.json'
    );
  }

  const root = getPoolRootPath(mockDataPath, fs);
  fs.mkdirSync(root, { recursive: true });
  const lockPath = getPoolIndexLockPath(mockDataPath, fs);
  const timeoutMs = options?.timeoutMs ?? POOL_INDEX_LOCK_TIMEOUT_MS;
  const retryMs = options?.retryMs ?? POOL_INDEX_LOCK_RETRY_MS;
  const staleMs = options?.staleMs ?? POOL_INDEX_LOCK_STALE_MS;
  const deadline = Date.now() + timeoutMs;
  const corruptFirstSeenMs: { value: number | null } = { value: null };
  let lastStealAttemptMs = 0;

  while (Date.now() <= deadline) {
    const payload: PoolIndexLockPayload = {
      pid: typeof process !== 'undefined' && typeof process.pid === 'number' ? process.pid : 0,
      createdAt: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(lockPath, JSON.stringify(payload), {
        encoding: 'utf8',
        flag: 'wx',
      });
      return lockPath;
    } catch (error) {
      if (!isExclusiveCreateConflict(error)) {
        throw new PoolIndexLockError(
          `Failed to acquire pool index lock at ${lockPath}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      const nowMs = Date.now();
      // Re-check staleness periodically (including corrupt locks aging into staleMs).
      if (nowMs - lastStealAttemptMs >= retryMs) {
        lastStealAttemptMs = nowMs;
        if (tryStealStaleLock(lockPath, fs, nowMs, staleMs, corruptFirstSeenMs)) {
          continue;
        }
      }
      sleepSync(retryMs);
    }
  }

  throw new PoolIndexLockError(
    `Timed out after ${timeoutMs}ms waiting for pool index lock at ${lockPath}`
  );
}

export function releasePoolIndexLock(lockPath: string, fs: FixturePoolFsAdapter): void {
  if (!fs.unlinkSync) return;
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {
    // best-effort release
  }
}

/**
 * Run a critical section while holding the exclusive pool-index lock.
 * Callers that mutate the catalog should {@link loadPoolIndex} inside `fn`
 * so they always start from the latest on-disk snapshot.
 */
export function withPoolIndexLock<T>(
  mockDataPath: string,
  fs: FixturePoolFsAdapter,
  fn: () => T,
  options?: { timeoutMs?: number; retryMs?: number; staleMs?: number }
): T {
  const lockPath = acquirePoolIndexLock(mockDataPath, fs, options);
  try {
    return fn();
  } finally {
    releasePoolIndexLock(lockPath, fs);
  }
}

/**
 * Load the pool index, apply an in-place mutator, and persist — all under the exclusive lock.
 */
export function withPoolIndexUpdate<T>(
  mockDataPath: string,
  fs: FixturePoolFsAdapter,
  mutator: (index: PoolIndex) => T,
  options?: { timeoutMs?: number; retryMs?: number; staleMs?: number }
): T {
  return withPoolIndexLock(
    mockDataPath,
    fs,
    () => {
      const index = loadPoolIndex(mockDataPath, fs);
      const result = mutator(index);
      savePoolIndex(mockDataPath, index, fs);
      return result;
    },
    options
  );
}

export function loadPoolIndex(mockDataPath: string, fs: FixturePoolFsAdapter): PoolIndex {
  const path = getPoolIndexPath(mockDataPath, fs);
  if (!fs.existsSync(path)) return emptyPoolIndex();
  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf8')) as unknown;
    const err = validatePoolIndex(raw);
    if (err) {
      throw new PoolIndexLoadError(`Invalid pool index at ${path}: ${err}`);
    }
    return raw as PoolIndex;
  } catch (error) {
    if (error instanceof PoolIndexLoadError) throw error;
    throw new PoolIndexLoadError(
      `Failed to read pool index at ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function savePoolIndex(mockDataPath: string, index: PoolIndex, fs: FixturePoolFsAdapter): void {
  const root = getPoolRootPath(mockDataPath, fs);
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(fs.joinPath(root, POOL_ENTITIES_DIR), { recursive: true });
  fs.mkdirSync(fs.joinPath(root, POOL_RESPONSES_DIR), { recursive: true });
  const path = getPoolIndexPath(mockDataPath, fs);
  fs.writeFileSync(path, JSON.stringify(index, null, 2), 'utf8');
}

export function loadPoolEntity(
  mockDataPath: string,
  id: string,
  fs: FixturePoolFsAdapter
): PoolEntity | undefined {
  const path = getEntityPath(mockDataPath, id, fs);
  if (!fs.existsSync(path)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8')) as PoolEntity;
  } catch {
    return undefined;
  }
}

export function savePoolEntity(
  mockDataPath: string,
  entity: PoolEntity,
  fs: FixturePoolFsAdapter
): void {
  const root = getPoolRootPath(mockDataPath, fs);
  fs.mkdirSync(fs.joinPath(root, POOL_ENTITIES_DIR), { recursive: true });
  fs.writeFileSync(getEntityPath(mockDataPath, entity.id, fs), JSON.stringify(entity, null, 2), 'utf8');
}

/**
 * Remove an entity from the catalog and delete its file under one exclusive lock.
 * Keeping unlink inside the lock prevents a concurrent recreate of the same id from
 * being deleted by a delete that already released the index lock.
 */
export function deletePoolEntityWithIndex(
  mockDataPath: string,
  id: string,
  fs: FixturePoolFsAdapter,
  updatedAt: string
): void {
  withPoolIndexLock(mockDataPath, fs, () => {
    const index = loadPoolIndex(mockDataPath, fs);
    index.entities = index.entities.filter((e) => e.id !== id);
    index.updatedAt = updatedAt;
    savePoolIndex(mockDataPath, index, fs);
    const filePath = getEntityPath(mockDataPath, id, fs);
    if (fs.existsSync(filePath)) {
      if (!fs.unlinkSync) {
        throw new PoolIndexLockError(
          'FixturePoolFsAdapter.unlinkSync is required to delete pool entity files'
        );
      }
      fs.unlinkSync(filePath);
    }
  });
}

/**
 * Persist an updated entity and catalog entry under one exclusive lock.
 * Returns false when the entity was deleted concurrently (no index entry / no file).
 * Does not resurrect catalog entries for ids that vanished mid-flight.
 */
export function updatePoolEntityWithIndex(
  mockDataPath: string,
  entity: PoolEntity,
  fs: FixturePoolFsAdapter
): boolean {
  return withPoolIndexLock(mockDataPath, fs, () => {
    const index = loadPoolIndex(mockDataPath, fs);
    const entry = index.entities.find((e) => e.id === entity.id);
    if (!entry) {
      return false;
    }
    const existingPath = getEntityPath(mockDataPath, entity.id, fs);
    if (!fs.existsSync(existingPath)) {
      return false;
    }
    savePoolEntity(mockDataPath, entity, fs);
    entry.label = entity.label;
    entry.entityType = entity.entityType;
    entry.tags = entity.tags;
    entry.updatedAt = entity.updatedAt ?? entry.updatedAt;
    index.updatedAt = entity.updatedAt ?? index.updatedAt;
    savePoolIndex(mockDataPath, index, fs);
    return true;
  });
}

export function loadPoolResponseItem(
  mockDataPath: string,
  id: string,
  fs: FixturePoolFsAdapter
): PoolResponseItem | undefined {
  const path = getResponseFixturePath(mockDataPath, id, fs);
  if (!fs.existsSync(path)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8')) as PoolResponseItem;
  } catch {
    return undefined;
  }
}

export function savePoolResponseItem(
  mockDataPath: string,
  item: PoolResponseItem,
  fs: FixturePoolFsAdapter
): void {
  const root = getPoolRootPath(mockDataPath, fs);
  fs.mkdirSync(fs.joinPath(root, POOL_RESPONSES_DIR), { recursive: true });
  fs.writeFileSync(
    getResponseFixturePath(mockDataPath, item.responseItemId, fs),
    JSON.stringify(item, null, 2),
    'utf8'
  );
}

/**
 * Remove a response fixture from the catalog and delete its file under one exclusive lock.
 * See {@link deletePoolEntityWithIndex} for the concurrent recreate race this prevents.
 */
export function deletePoolResponseWithIndex(
  mockDataPath: string,
  id: string,
  fs: FixturePoolFsAdapter,
  updatedAt: string
): void {
  withPoolIndexLock(mockDataPath, fs, () => {
    const index = loadPoolIndex(mockDataPath, fs);
    index.responses = index.responses.filter((r) => r.id !== id);
    index.updatedAt = updatedAt;
    savePoolIndex(mockDataPath, index, fs);
    const filePath = getResponseFixturePath(mockDataPath, id, fs);
    if (fs.existsSync(filePath)) {
      if (!fs.unlinkSync) {
        throw new PoolIndexLockError(
          'FixturePoolFsAdapter.unlinkSync is required to delete pool response files'
        );
      }
      fs.unlinkSync(filePath);
    }
  });
}

export function loadScenarioManifest(
  mockDataPath: string,
  scenario: string,
  fs: FixturePoolFsAdapter
): ScenarioManifest | undefined {
  const path = getScenarioManifestPath(mockDataPath, scenario, fs);
  if (!fs.existsSync(path)) return undefined;
  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf8')) as unknown;
    const err = validateScenarioManifest(raw);
    if (err) {
      console.warn(`[Mockifyer] Invalid scenario manifest at ${path}: ${err}`);
      return undefined;
    }
    return raw as ScenarioManifest;
  } catch (error) {
    console.warn(`[Mockifyer] Failed to read scenario manifest:`, error);
    return undefined;
  }
}

export function saveScenarioManifest(
  mockDataPath: string,
  manifest: ScenarioManifest,
  fs: FixturePoolFsAdapter
): void {
  const scenarioDir = fs.joinPath(mockDataPath, manifest.scenario);
  fs.mkdirSync(scenarioDir, { recursive: true });
  fs.writeFileSync(
    getScenarioManifestPath(mockDataPath, manifest.scenario, fs),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
}

export function ensurePoolLayout(mockDataPath: string, fs: FixturePoolFsAdapter): void {
  const root = getPoolRootPath(mockDataPath, fs);
  fs.mkdirSync(fs.joinPath(root, POOL_ENTITIES_DIR), { recursive: true });
  fs.mkdirSync(fs.joinPath(root, POOL_RESPONSES_DIR), { recursive: true });
  if (!fs.existsSync(getPoolIndexPath(mockDataPath, fs))) {
    savePoolIndex(mockDataPath, emptyPoolIndex(), fs);
  }
}

export { emptyPoolIndex, emptyScenarioManifest };
