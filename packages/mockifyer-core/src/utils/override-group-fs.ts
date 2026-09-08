/**
 * Filesystem helpers for scenario override groups.
 * Layout:
 * - `{scenarioPath}/override-groups/{id}.json` — shared group definitions
 * - `{scenarioPath}/override-group-config.json` — scenario default active group
 * - `{scenarioPath}/override-group-config.{clientId}.json` — per-lane active group
 */

import fs from 'fs';
import path from 'path';
import type { MockOverrideGroup, MockOverrideGroupConfig } from '../types/override-group';
import {
  OVERRIDE_GROUP_CONFIG_FILENAME,
  OVERRIDE_GROUPS_DIR_NAME,
  overrideGroupConfigFilenameForClient,
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
import {
  readOverrideGroupIdFromEnv,
  resolveActiveOverrideGroupId,
  sanitizeOverrideGroupClientId,
} from './override-group-resolve';

export function getOverrideGroupsDir(scenarioPath: string): string {
  return path.join(scenarioPath, OVERRIDE_GROUPS_DIR_NAME);
}

export function getOverrideGroupConfigPath(scenarioPath: string): string {
  return path.join(scenarioPath, OVERRIDE_GROUP_CONFIG_FILENAME);
}

export function getClientOverrideGroupConfigPath(
  scenarioPath: string,
  clientId: string
): string | null {
  const safe = sanitizeOverrideGroupClientId(clientId);
  if (!safe) return null;
  return path.join(scenarioPath, overrideGroupConfigFilenameForClient(safe));
}

function groupFilePath(scenarioPath: string, groupId: string): string {
  return path.join(getOverrideGroupsDir(scenarioPath), `${groupId}.json`);
}

function parseConfigFile(filePath: string): MockOverrideGroupConfig {
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

/** Scenario-default active group pointer. */
export function readOverrideGroupConfig(scenarioPath: string): MockOverrideGroupConfig {
  return parseConfigFile(getOverrideGroupConfigPath(scenarioPath));
}

/**
 * Per-lane active group pointer. Returns null when no lane file exists
 * (distinct from `{ currentGroup: null }` which means "explicitly none").
 */
export function readClientOverrideGroupConfig(
  scenarioPath: string,
  clientId: string
): MockOverrideGroupConfig | null {
  const filePath = getClientOverrideGroupConfigPath(scenarioPath, clientId);
  if (!filePath || !fs.existsSync(filePath)) return null;
  return parseConfigFile(filePath);
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

export function writeClientOverrideGroupConfig(
  scenarioPath: string,
  clientId: string,
  config: MockOverrideGroupConfig
): MockOverrideGroupConfig {
  const filePath = getClientOverrideGroupConfigPath(scenarioPath, clientId);
  if (!filePath) {
    throw new Error('Invalid clientId for override group config');
  }
  fs.mkdirSync(scenarioPath, { recursive: true });
  const next: MockOverrideGroupConfig = {
    currentGroup: config.currentGroup?.trim() || null,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function deleteClientOverrideGroupConfig(scenarioPath: string, clientId: string): boolean {
  const filePath = getClientOverrideGroupConfigPath(scenarioPath, clientId);
  if (!filePath || !fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
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

export interface HydrateOverrideGroupRuntimeOptions {
  clientId?: string | null;
  /** Header / body override for this hydrate. */
  explicitGroupId?: string | null;
  /** Redis (or other) lane selection when not using FS lane files. */
  laneGroupId?: string | null;
}

export interface HydrateOverrideGroupRuntimeResult {
  groups: MockOverrideGroup[];
  /** Scenario default from override-group-config.json */
  defaultGroup: string | null;
  /** Lane file / redis value when present */
  laneGroup: string | null;
  /** Resolved effective group after precedence */
  currentGroup: string | null;
  /** How currentGroup was chosen */
  source: 'explicit' | 'env' | 'lane' | 'default' | 'none';
}

function classifySource(
  resolved: string | null,
  params: {
    explicit: string | null;
    env: string | null;
    lane: string | null;
    defaultGroup: string | null;
  }
): HydrateOverrideGroupRuntimeResult['source'] {
  if (!resolved) return 'none';
  if (params.explicit && resolved === params.explicit) return 'explicit';
  if (params.env && resolved === params.env) return 'env';
  if (params.lane && resolved === params.lane) return 'lane';
  if (params.defaultGroup && resolved === params.defaultGroup) return 'default';
  return 'none';
}

/**
 * Load group definitions and resolve the effective active group for a client/process.
 */
export function hydrateOverrideGroupRuntimeFromScenarioPath(
  scenarioPath: string,
  options?: HydrateOverrideGroupRuntimeOptions
): HydrateOverrideGroupRuntimeResult {
  const groups = listOverrideGroupsFromDisk(scenarioPath);
  const defaultConfig = readOverrideGroupConfig(scenarioPath);
  const clientId =
    typeof options?.clientId === 'string' && options.clientId.trim()
      ? options.clientId.trim()
      : null;

  let laneGroup: string | null = null;
  if (typeof options?.laneGroupId === 'string' || options?.laneGroupId === null) {
    laneGroup =
      options.laneGroupId == null || options.laneGroupId === ''
        ? null
        : String(options.laneGroupId).trim() || null;
  } else if (clientId) {
    const laneConfig = readClientOverrideGroupConfig(scenarioPath, clientId);
    laneGroup = laneConfig?.currentGroup ?? null;
  }

  const explicit = options?.explicitGroupId ?? null;
  const envGroup = readOverrideGroupIdFromEnv();
  const knownIds = groups.map((g) => g.id);
  const currentGroup = resolveActiveOverrideGroupId({
    explicitGroupId: explicit,
    envGroupId: envGroup,
    laneGroupId: laneGroup,
    defaultGroupId: defaultConfig.currentGroup,
    knownGroupIds: knownIds,
  });

  setOverrideGroupRuntimeScenarioPath(scenarioPath);
  replaceRegisteredOverrideGroups(groups, scenarioPath);
  setActiveOverrideGroup(currentGroup, scenarioPath);

  return {
    groups,
    defaultGroup: defaultConfig.currentGroup,
    laneGroup,
    currentGroup,
    source: classifySource(currentGroup, {
      explicit: resolveActiveOverrideGroupId({
        explicitGroupId: explicit,
        knownGroupIds: knownIds,
      }),
      env: resolveActiveOverrideGroupId({
        envGroupId: envGroup,
        knownGroupIds: knownIds,
      }),
      lane: resolveActiveOverrideGroupId({
        laneGroupId: laneGroup,
        knownGroupIds: knownIds,
      }),
      defaultGroup: resolveActiveOverrideGroupId({
        defaultGroupId: defaultConfig.currentGroup,
        knownGroupIds: knownIds,
      }),
    }),
  };
}

/**
 * Load definitions + resolve active group for this scenario/client.
 */
export function ensureOverrideGroupRuntimeForScenarioPath(
  scenarioPath: string,
  options?: HydrateOverrideGroupRuntimeOptions & { force?: boolean }
): HydrateOverrideGroupRuntimeResult {
  return hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath, options);
}

/** Re-read active group document from disk when scenarioPath is known. */
export function refreshActiveOverrideGroupFromDisk(scenarioPath?: string): void {
  const effectiveScenarioPath = scenarioPath ?? getOverrideGroupRuntimeScenarioPath();
  const activeId = getActiveOverrideGroupId(effectiveScenarioPath ?? undefined);
  if (!effectiveScenarioPath || !activeId) return;
  const fresh = readOverrideGroupFromDisk(effectiveScenarioPath, activeId);
  if (!fresh) {
    setActiveOverrideGroup(null, effectiveScenarioPath);
    return;
  }
  upsertRegisteredOverrideGroup(fresh, effectiveScenarioPath);
}

/**
 * Resolve effective group id for a serve/match without mutating runtime active pointer
 * when `laneGroupId` / explicit are provided for a concurrent request.
 */
export function resolveOverrideGroupIdForServe(
  scenarioPath: string,
  options?: HydrateOverrideGroupRuntimeOptions
): string | null {
  const groups = listOverrideGroupsFromDisk(scenarioPath);
  const defaultConfig = readOverrideGroupConfig(scenarioPath);
  const clientId =
    typeof options?.clientId === 'string' && options.clientId.trim()
      ? options.clientId.trim()
      : null;

  let laneGroup: string | null = null;
  if (typeof options?.laneGroupId === 'string' || options?.laneGroupId === null) {
    laneGroup =
      options.laneGroupId == null || options.laneGroupId === ''
        ? null
        : String(options.laneGroupId).trim() || null;
  } else if (clientId) {
    const laneConfig = readClientOverrideGroupConfig(scenarioPath, clientId);
    laneGroup = laneConfig?.currentGroup ?? null;
  }

  return resolveActiveOverrideGroupId({
    explicitGroupId: options?.explicitGroupId ?? null,
    envGroupId: readOverrideGroupIdFromEnv(),
    laneGroupId: laneGroup,
    defaultGroupId: defaultConfig.currentGroup,
    knownGroupIds: groups.map((g) => g.id),
  });
}
