/**
 * Load/save scenario override groups from Redis/SQLite when centralized,
 * with filesystem as fallback (and best-effort disk mirror).
 */
import {
  deleteOverrideGroupFromDisk,
  listOverrideGroupsFromDisk,
  mergeOverrideGroups,
  readOverrideGroupConfig,
  readOverrideGroupFromDisk,
  writeOverrideGroupConfig,
  writeOverrideGroupToDisk,
  type MockOverrideGroup,
  type MockOverrideGroupConfig,
} from '@sgedda/mockifyer-core';
import type { RedisMockStore } from './redis-mock-store';

function warnDisk(action: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[OverrideGroups] ${action} skipped: ${message}`);
}

export function tryWriteOverrideGroupToDisk(scenarioPath: string, group: MockOverrideGroup): void {
  try {
    writeOverrideGroupToDisk(scenarioPath, group);
  } catch (error) {
    warnDisk('disk write', error);
  }
}

export function tryWriteOverrideGroupConfigToDisk(
  scenarioPath: string,
  config: MockOverrideGroupConfig
): void {
  try {
    writeOverrideGroupConfig(scenarioPath, config);
  } catch (error) {
    warnDisk('disk config write', error);
  }
}

export function tryDeleteOverrideGroupFromDisk(scenarioPath: string, groupId: string): boolean {
  try {
    return deleteOverrideGroupFromDisk(scenarioPath, groupId);
  } catch (error) {
    warnDisk('disk delete', error);
    return false;
  }
}

export async function loadMergedOverrideGroupState(
  store: RedisMockStore | null,
  scenario: string,
  scenarioPath: string
): Promise<{ groups: MockOverrideGroup[]; defaultGroup: string | null; updatedAt: string | null }> {
  const diskGroups = listOverrideGroupsFromDisk(scenarioPath);
  const diskConfig = readOverrideGroupConfig(scenarioPath);
  if (!store) {
    return {
      groups: diskGroups,
      defaultGroup: diskConfig.currentGroup,
      updatedAt: diskConfig.updatedAt ?? null,
    };
  }
  const storeGroups = await store.listOverrideGroups(scenario);
  const storeConfig = await store.getOverrideGroupConfig(scenario);
  return {
    groups: mergeOverrideGroups(storeGroups, diskGroups),
    defaultGroup: storeConfig ? storeConfig.currentGroup : diskConfig.currentGroup,
    updatedAt: storeConfig?.updatedAt ?? diskConfig.updatedAt ?? null,
  };
}

export async function readMergedOverrideGroup(
  store: RedisMockStore | null,
  scenario: string,
  scenarioPath: string,
  groupId: string
): Promise<MockOverrideGroup | null> {
  if (store) {
    const fromStore = await store.getOverrideGroup(scenario, groupId);
    if (fromStore) return fromStore;
  }
  return readOverrideGroupFromDisk(scenarioPath, groupId);
}

export async function saveOverrideGroup(params: {
  store: RedisMockStore | null;
  scenario: string;
  scenarioPath: string;
  group: MockOverrideGroup;
}): Promise<MockOverrideGroup> {
  if (params.store) {
    const saved = await params.store.putOverrideGroup(params.scenario, params.group);
    tryWriteOverrideGroupToDisk(params.scenarioPath, saved);
    return saved;
  }
  return writeOverrideGroupToDisk(params.scenarioPath, params.group);
}

export async function saveOverrideGroupConfig(params: {
  store: RedisMockStore | null;
  scenario: string;
  scenarioPath: string;
  config: MockOverrideGroupConfig;
}): Promise<MockOverrideGroupConfig> {
  if (params.store) {
    const saved = await params.store.setOverrideGroupConfig(params.scenario, params.config);
    tryWriteOverrideGroupConfigToDisk(params.scenarioPath, saved);
    return saved;
  }
  return writeOverrideGroupConfig(params.scenarioPath, params.config);
}

export async function removeOverrideGroup(params: {
  store: RedisMockStore | null;
  scenario: string;
  scenarioPath: string;
  groupId: string;
}): Promise<boolean> {
  let deleted = false;
  if (params.store) {
    deleted = await params.store.deleteOverrideGroup(params.scenario, params.groupId);
  }
  if (tryDeleteOverrideGroupFromDisk(params.scenarioPath, params.groupId)) {
    deleted = true;
  }
  if (!params.store) {
    const config = readOverrideGroupConfig(params.scenarioPath);
    if (config.currentGroup === params.groupId) {
      writeOverrideGroupConfig(params.scenarioPath, { currentGroup: null });
    }
  } else {
    const diskConfig = readOverrideGroupConfig(params.scenarioPath);
    if (diskConfig.currentGroup === params.groupId) {
      tryWriteOverrideGroupConfigToDisk(params.scenarioPath, { currentGroup: null });
    }
  }
  return deleted;
}
