import {
  emptyPoolIndex,
  loadPoolIndex,
  type FixturePoolFsAdapter,
  type PoolIndex,
} from '@sgedda/mockifyer-core';

/**
 * Read the fixture-pool catalog without creating directories.
 * GET list handlers must not write — `ensurePoolLayout` on a read-only mock-data
 * tree (or a corrupt `pool-index.json`) was returning 500 and breaking the UI.
 */
export function loadFixturePoolCatalog(
  mockDataPath: string,
  fs: FixturePoolFsAdapter
): { index: PoolIndex; warning?: string } {
  try {
    return { index: loadPoolIndex(mockDataPath, fs) };
  } catch (error) {
    return {
      index: emptyPoolIndex(),
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}
