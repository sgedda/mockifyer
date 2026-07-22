import type { CachedMockData, MockMatchingConfig } from '../mock-matcher';
import type { StoredRequest } from '../../types';
import type {
  PoolEntity,
  PoolIndex,
  PoolResponseItem,
  ScenarioManifest,
} from '../../types/fixture-pool';
import { buildMockFromSlotAssignment } from './build-slot-response';
import { findMatchingSlot } from './match-slot';

export interface ResolveMockForRequestContext {
  scenario: string;
  mockDataPath: string;
  manifest?: ScenarioManifest | null;
  poolIndex?: PoolIndex | null;
  getEntity: (id: string) => PoolEntity | undefined;
  getResponseItem: (id: string) => PoolResponseItem | undefined;
  getNow?: () => Date;
  /**
   * When false, skip slot resolution (e.g. MOCKIFYER_SLOTS_IN_RECORD=false while recording).
   * Default true.
   */
  useEndpointSlots?: boolean;
  /**
   * When true, reject entityType mismatches at serve time.
   * Default true (MOCKIFYER_SLOT_ENTITY_TYPE_STRICT).
   */
  strictEntityType?: boolean;
}

/**
 * Resolve a mock from scenario endpoint slots (entity / compose / response / inline).
 * Returns undefined to fall through to legacy findBestMatchingMock.
 */
export function resolveMockForRequest(
  request: StoredRequest,
  context: ResolveMockForRequestContext,
  _legacyConfig?: MockMatchingConfig
): CachedMockData | undefined {
  if (context.useEndpointSlots === false) return undefined;
  const manifest = context.manifest;
  if (!manifest?.slots?.length) return undefined;
  if (manifest.scenario && manifest.scenario !== context.scenario) {
    // Manifest file may still be used if loaded for the active scenario folder.
  }

  const slot = findMatchingSlot(request, manifest.slots);
  if (!slot) return undefined;

  if (context.strictEntityType !== false && slot.expectsEntityType) {
    const expected = slot.expectsEntityType;
    const assignment = slot.assignment;
    if (assignment.kind === 'entity') {
      const entity = context.getEntity(assignment.entityId);
      if (entity && entity.entityType !== expected) {
        console.warn(
          `[Mockifyer] Slot ${slot.id}: entity ${assignment.entityId} type "${entity.entityType}" != expected "${expected}"`
        );
        return undefined;
      }
    }
    if (assignment.kind === 'compose') {
      for (const item of assignment.items) {
        const entity = context.getEntity(item.entityId);
        if (entity && entity.entityType !== expected) {
          console.warn(
            `[Mockifyer] Slot ${slot.id}: entity ${item.entityId} type "${entity.entityType}" != expected "${expected}"`
          );
          return undefined;
        }
      }
    }
  }

  const built = buildMockFromSlotAssignment(slot.id, slot.assignment, {
    getEntity: context.getEntity,
    getResponseItem: context.getResponseItem,
    getNow: context.getNow,
    slotOverrides: slot.slotOverrides,
    request,
  });

  if ('error' in built) {
    console.warn(`[Mockifyer] Slot ${slot.id} build failed: ${built.error}`);
    return undefined;
  }

  return {
    mockData: built.mockData,
    filename: built.filename,
    filePath: built.filePath,
  };
}

/**
 * Whether endpoint slots should run while recording.
 * Env MOCKIFYER_SLOTS_IN_RECORD: default true; set false to always fall through to live/legacy while recording.
 */
export function shouldUseEndpointSlotsInRecordMode(recordMode: boolean): boolean {
  if (!recordMode) return true;
  if (typeof process === 'undefined' || !process.env) return true;
  const raw = process.env.MOCKIFYER_SLOTS_IN_RECORD;
  if (raw === undefined || raw === '') return true;
  return raw !== 'false' && raw !== '0';
}

/**
 * Whether to reject entityType mismatches at serve time.
 */
export function isSlotEntityTypeStrict(): boolean {
  if (typeof process === 'undefined' || !process.env) return true;
  const raw = process.env.MOCKIFYER_SLOT_ENTITY_TYPE_STRICT;
  if (raw === undefined || raw === '') return true;
  return raw !== 'false' && raw !== '0';
}
