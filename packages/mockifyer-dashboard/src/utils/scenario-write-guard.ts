import { isScenarioLockedFs } from '@sgedda/mockifyer-core';
import type { RedisMockStore } from './redis-mock-store';

/** HTTP 423: scenario lock — mock writes are forbidden while locked. */
export const SCENARIO_MOCK_LOCKED_MESSAGE =
  'Scenario is locked; mock data cannot be edited.';

/**
 * Whether a mock/store write should be rejected because the scenario is locked.
 */
export function isScenarioWriteBlocked(locked: boolean): boolean {
  return locked === true;
}

export function isFilesystemScenarioWriteBlocked(
  mockDataPath: string,
  scenario: string
): boolean {
  return isScenarioWriteBlocked(isScenarioLockedFs(mockDataPath, scenario));
}

export async function isRedisScenarioWriteBlocked(
  store: Pick<RedisMockStore, 'isScenarioLocked'>,
  scenario: string
): Promise<boolean> {
  return isScenarioWriteBlocked(await store.isScenarioLocked(scenario));
}
