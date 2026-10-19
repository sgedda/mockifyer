import * as fs from 'fs';
import * as path from 'path';
import type { CachedMockData } from '../mock-matcher';
import type { StoredRequest } from '../../types';
import type { PoolEntity, PoolIndex, PoolResponseItem, ScenarioManifest } from '../../types/fixture-pool';
import {
  loadPoolEntity,
  loadPoolIndex,
  loadPoolResponseItem,
  loadScenarioManifest,
  type FixturePoolFsAdapter,
} from './fs-store';
import {
  isSlotEntityTypeStrict,
  resolveMockForRequest,
  shouldUseEndpointSlotsInRecordMode,
} from './resolve';

const nodeFsAdapter: FixturePoolFsAdapter = {
  joinPath: (...parts) => path.join(...parts),
  existsSync: (p) => fs.existsSync(p),
  readFileSync: (p, encoding) => fs.readFileSync(p, encoding),
  writeFileSync: (p, data, encodingOrOptions) => fs.writeFileSync(p, data, encodingOrOptions),
  mkdirSync: (p, options) => {
    fs.mkdirSync(p, options);
  },
  unlinkSync: (p) => fs.unlinkSync(p),
  readdirSync: (p) => fs.readdirSync(p),
};

interface PoolRuntimeCache {
  mockDataPath: string;
  scenario: string;
  poolIndexUpdatedAt?: string;
  manifestUpdatedAt?: string;
  poolIndex: PoolIndex;
  manifest?: ScenarioManifest;
  entities: Map<string, PoolEntity>;
  responses: Map<string, PoolResponseItem>;
}

let runtimeCache: PoolRuntimeCache | null = null;

/**
 * Invalidate in-memory pool/manifest cache (call from reloadMockData).
 */
export function invalidateFixturePoolCache(): void {
  runtimeCache = null;
}

function ensureCache(mockDataPath: string, scenario: string): PoolRuntimeCache {
  const poolIndex = loadPoolIndex(mockDataPath, nodeFsAdapter);
  const manifest = loadScenarioManifest(mockDataPath, scenario, nodeFsAdapter);

  if (
    runtimeCache &&
    runtimeCache.mockDataPath === mockDataPath &&
    runtimeCache.scenario === scenario &&
    runtimeCache.poolIndexUpdatedAt === poolIndex.updatedAt &&
    runtimeCache.manifestUpdatedAt === manifest?.updatedAt
  ) {
    return runtimeCache;
  }

  const entities = new Map<string, PoolEntity>();
  const responses = new Map<string, PoolResponseItem>();

  for (const entry of poolIndex.entities) {
    const entity = loadPoolEntity(mockDataPath, entry.id, nodeFsAdapter);
    if (entity) entities.set(entry.id, entity);
  }
  for (const entry of poolIndex.responses) {
    const item = loadPoolResponseItem(mockDataPath, entry.id, nodeFsAdapter);
    if (item) responses.set(entry.id, item);
  }

  runtimeCache = {
    mockDataPath,
    scenario,
    poolIndex,
    manifest,
    poolIndexUpdatedAt: poolIndex.updatedAt,
    manifestUpdatedAt: manifest?.updatedAt,
    entities,
    responses,
  };
  return runtimeCache;
}

export interface TryResolveSlotMockOptions {
  mockDataPath: string;
  scenario: string;
  recordMode?: boolean;
  getNow?: () => Date;
}

/**
 * Node filesystem helper: resolve endpoint-slot mock or return undefined for legacy matching.
 */
export function tryResolveSlotMockFromFilesystem(
  request: StoredRequest,
  options: TryResolveSlotMockOptions
): CachedMockData | undefined {
  if (typeof process !== 'undefined' && process.env?.MOCKIFYER_USE_ENDPOINT_SLOTS === 'false') {
    return undefined;
  }

  const useSlots = shouldUseEndpointSlotsInRecordMode(options.recordMode === true);
  if (!useSlots) return undefined;

  const cache = ensureCache(options.mockDataPath, options.scenario);
  if (!cache.manifest?.slots?.length) return undefined;

  return resolveMockForRequest(
    request,
    {
      scenario: options.scenario,
      mockDataPath: options.mockDataPath,
      manifest: cache.manifest,
      poolIndex: cache.poolIndex,
      // Always read entity/response payloads from disk so hand-edits are not stale
      // when only the index timestamp is unchanged.
      getEntity: (id) => loadPoolEntity(options.mockDataPath, id, nodeFsAdapter),
      getResponseItem: (id) => loadPoolResponseItem(options.mockDataPath, id, nodeFsAdapter),
      getNow: options.getNow,
      useEndpointSlots: true,
      strictEntityType: isSlotEntityTypeStrict(),
    }
  );
}

export { nodeFsAdapter as fixturePoolNodeFsAdapter };

/**
 * Node filesystem loader for serve-time `$pool` refs (promoted response fixtures).
 */
export function createFilesystemPoolResponseLoader(
  mockDataPath: string
): (id: string) => PoolResponseItem | undefined {
  return (id: string) => loadPoolResponseItem(mockDataPath, id, nodeFsAdapter);
}
