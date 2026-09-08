/**
 * Filesystem helpers for scenario override groups.
 * Layout: `{scenarioPath}/override-groups/{id}.json` + `override-group-config.json`
 */

import fs from 'fs';
import path from 'path';
import type { MockOverrideGroup, MockOverrideGroupConfig } from '../types/override-group';
import {
  OVERRIDE_GROUP_CONFIG_FILENAME,
  OVERRIDE_GROUPS_DIR_NAME,
} from '../types/override-group';
import {
  normalizeMockOverrideGroup,
  validateMockOverrideGroup,
  emptyOverrideGroupConfig,
} from './override-group';
import {
  replaceRegisteredOverrideGroups,
  setActiveOverrideGroup,
  setOverrideGroupRuntimeScenarioPath,
  getOverrideGroupRuntimeScenarioPath,
  getActiveOverrideGroupId,
  upsertRegisteredOverrideGroup,
} from './override-group-runtime';

export function getOverrideGroupsDir(scenarioPath: string): string {
  return path.join(scenarioPath, OVERRIDE_GROUPS_DIR_NAME);
}

export function getOverrideGroupConfigPath(scenarioPath: string): string {
  return path.join(scenarioPath, OVERRIDE_GROUP_CONFIG_FILENAME);
}

function groupFilePath(scenarioPath: string, groupId: string): string {
  return path.join(getOverrideGroupsDir(scenarioPath), `${groupId}.json`);
}

export function readOverrideGroupConfig(scenarioPath: string): MockOverrideGroupConfig {
  const filePath = getOverrideGroupConfigPath(scenarioPath);
  if (!fs.existsSync(filePath)) return emptyOverrideGroupConfig();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as MockOverrideGroupConfig;
    const current =
      typeof raw.currentGroup === 'string' && raw.currentGroup.trim()
        ? raw.currentGroup.trim()
        : null;
    return { currentGroup: current, updatedAt: raw.updatedAt };
  } catch {
    return emptyOverrideGroupConfig();
  }
}

export function writeOverrideGroupConfig(
  scenarioPath: string,
  config: MockOverrideGroupConfig
): MockOverrideGroupConfig {
  fs.mkdirSync(scenarioPath, { recursive: true });
  const next: MockOverrideGroupConfig = {
    currentGroup: config.currentGroup?.trim() || null,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getOverrideGroupConfigPath(scenarioPath), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function listOverrideGroupsFromDisk(scenarioPath: string): MockOverrideGroup[] {
  const dir = getOverrideGroupsDir(scenarioPath);
  if (!fs.existsSync(dir)) return [];
  const groups: MockOverrideGroup[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as unknown;
      const err = validateMockOverrideGroup(raw);
      if (err) continue;
      groups.push(normalizeMockOverrideGroup(raw as MockOverrideGroup));
    } catch {
      // skip
    }
  }
  return groups.sort((a, b) => a.id.localeCompare(b.id));
}

export function readOverrideGroupFromDisk(
  scenarioPath: string,
  groupId: string
): MockOverrideGroup | null {
  const filePath = groupFilePath(scenarioPath, groupId.trim());
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const err = validateMockOverrideGroup(raw);
    if (err) return null;
    return normalizeMockOverrideGroup(raw as MockOverrideGroup);
  } catch {
    return null;
  }
}

export function writeOverrideGroupToDisk(
  scenarioPath: string,
  group: MockOverrideGroup
): MockOverrideGroup {
  const err = validateMockOverrideGroup(group);
  if (err) throw new Error(err);
  const normalized = normalizeMockOverrideGroup({
    ...group,
    updatedAt: new Date().toISOString(),
  });
  fs.mkdirSync(getOverrideGroupsDir(scenarioPath), { recursive: true });
  fs.writeFileSync(
    groupFilePath(scenarioPath, normalized.id),
    JSON.stringify(normalized, null, 2),
    'utf8'
  );
  return normalized;
}

export function deleteOverrideGroupFromDisk(scenarioPath: string, groupId: string): boolean {
  const filePath = groupFilePath(scenarioPath, groupId.trim());
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Load groups for a scenario folder into memory and activate config.currentGroup.
 */
export function hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath: string): {
  groups: MockOverrideGroup[];
  currentGroup: string | null;
} {
  const groups = listOverrideGroupsFromDisk(scenarioPath);
  const config = readOverrideGroupConfig(scenarioPath);
  setOverrideGroupRuntimeScenarioPath(scenarioPath);
  replaceRegisteredOverrideGroups(groups);
  const current =
    config.currentGroup && groups.some((g) => g.id === config.currentGroup)
      ? config.currentGroup
      : null;
  setActiveOverrideGroup(current);
  return { groups, currentGroup: current };
}

/**
 * Hydrate (or re-hydrate) override groups for a scenario folder.
 * Always reloads from disk so dashboard/MCP active-group edits apply without a process restart.
 */
export function ensureOverrideGroupRuntimeForScenarioPath(
  scenarioPath: string,
  _options?: { force?: boolean }
): void {
  hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);
}

/** Re-read active group from disk when scenarioPath is known (after dashboard writes). */
export function refreshActiveOverrideGroupFromDisk(): void {
  const scenarioPath = getOverrideGroupRuntimeScenarioPath();
  const activeId = getActiveOverrideGroupId();
  if (!scenarioPath || !activeId) return;
  const fresh = readOverrideGroupFromDisk(scenarioPath, activeId);
  if (!fresh) {
    setActiveOverrideGroup(null);
    return;
  }
  upsertRegisteredOverrideGroup(fresh);
}
