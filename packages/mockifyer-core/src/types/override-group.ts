import type { MockResponseDateOverride, MockResponseFieldOverride } from '../types';

/** Stable slug for override group ids. */
export const OVERRIDE_GROUP_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Directory name under a scenario folder. */
export const OVERRIDE_GROUPS_DIR_NAME = 'override-groups';

/** Active group pointer filename under a scenario folder. */
export const OVERRIDE_GROUP_CONFIG_FILENAME = 'override-group-config.json';

/**
 * Overrides for one mock file within a group (filename matches scenario-relative mock path).
 */
export interface MockOverrideGroupEntry {
  filename: string;
  responseFieldOverrides?: MockResponseFieldOverride[];
  responseDateOverrides?: MockResponseDateOverride[];
}

/** Named set of overrides within a scenario (switchable story layer). */
export interface MockOverrideGroup {
  id: string;
  label: string;
  updatedAt: string;
  entries: MockOverrideGroupEntry[];
}

/** Which override group is active for a scenario. */
export interface MockOverrideGroupConfig {
  currentGroup: string | null;
  updatedAt?: string;
}
