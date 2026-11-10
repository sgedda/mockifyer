import { POOL_DIR_NAME } from '../types/fixture-pool';
import { OVERRIDE_GROUP_CONFIG_FILENAME, OVERRIDE_GROUPS_DIR_NAME } from '../types/override-group';
import { OVERRIDE_SETS_DIR_NAME } from './override-sets';

/**
 * Scenario-folder directories that store sidecar JSON, not recorded HTTP mocks.
 * Walkers that collect mock files must skip these.
 */
export const MOCK_RECORDING_SIDECAR_DIR_NAMES: readonly string[] = [
  OVERRIDE_SETS_DIR_NAME,
  OVERRIDE_GROUPS_DIR_NAME,
  POOL_DIR_NAME,
];

export function isMockRecordingSidecarDir(name: string): boolean {
  return (MOCK_RECORDING_SIDECAR_DIR_NAMES as readonly string[]).includes(name);
}

/**
 * Per-scenario JSON pointers that are not mock recordings
 * (`override-group-config.json` and `override-group-config.{clientId}.json`).
 */
export function isOverrideGroupConfigFilename(name: string): boolean {
  if (name === OVERRIDE_GROUP_CONFIG_FILENAME) return true;
  return name.startsWith('override-group-config.') && name.endsWith('.json');
}
