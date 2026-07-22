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
  POOL_RESPONSES_DIR,
  SCENARIO_MANIFEST_FILENAME,
} from '../../types/fixture-pool';
import { emptyPoolIndex, emptyScenarioManifest, validatePoolIndex, validateScenarioManifest } from './validate';

export interface FixturePoolFsAdapter {
  joinPath: (...parts: string[]) => string;
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
  writeFileSync: (path: string, data: string, encoding: 'utf8') => void;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
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

export function loadPoolIndex(mockDataPath: string, fs: FixturePoolFsAdapter): PoolIndex {
  const path = getPoolIndexPath(mockDataPath, fs);
  if (!fs.existsSync(path)) return emptyPoolIndex();
  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf8')) as unknown;
    const err = validatePoolIndex(raw);
    if (err) {
      console.warn(`[Mockifyer] Invalid pool index at ${path}: ${err}`);
      return emptyPoolIndex();
    }
    return raw as PoolIndex;
  } catch (error) {
    console.warn(`[Mockifyer] Failed to read pool index:`, error);
    return emptyPoolIndex();
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
