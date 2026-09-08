import type { MockOverrideGroup } from '../types/override-group';
import {
  findOverrideGroupEntry,
  normalizeMockOverrideGroup,
  overlaysFromGroupEntry,
  validateMockOverrideGroup,
  type ActiveGroupOverlays,
} from './override-group';
import { applyResponseDateOverridesToData } from './mock-response-date-overrides';
import { applyResponseFieldOverridesToData } from './mock-response-field-overrides';

export interface OverrideGroupRuntimeState {
  scenarioPath: string | null;
  activeGroupId: string | null;
  activeGroup: MockOverrideGroup | null;
  groups: Map<string, MockOverrideGroup>;
}

const runtime: OverrideGroupRuntimeState = {
  scenarioPath: null,
  activeGroupId: null,
  activeGroup: null,
  groups: new Map(),
};

/** Reset in-process override group registry (tests). */
export function resetOverrideGroupRuntime(): void {
  runtime.scenarioPath = null;
  runtime.activeGroupId = null;
  runtime.activeGroup = null;
  runtime.groups.clear();
}

export function getOverrideGroupRuntimeScenarioPath(): string | null {
  return runtime.scenarioPath;
}

/** Record which scenario folder this runtime was hydrated from (null clears). */
export function setOverrideGroupRuntimeScenarioPath(scenarioPath: string | null): void {
  runtime.scenarioPath = scenarioPath;
}

export function getActiveOverrideGroupId(): string | null {
  return runtime.activeGroupId;
}

export function getActiveOverrideGroup(): MockOverrideGroup | null {
  return runtime.activeGroup;
}

export function listRegisteredOverrideGroups(): MockOverrideGroup[] {
  return [...runtime.groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Replace all registered groups (does not write disk). */
export function replaceRegisteredOverrideGroups(groups: MockOverrideGroup[]): void {
  runtime.groups.clear();
  for (const raw of groups) {
    const err = validateMockOverrideGroup(raw);
    if (err) throw new Error(`Invalid override group: ${err}`);
    const group = normalizeMockOverrideGroup(raw);
    runtime.groups.set(group.id, group);
  }
}

/** Register / replace groups in memory (does not write disk). */
export function registerOverrideGroups(groups: MockOverrideGroup[]): void {
  for (const raw of groups) {
    const err = validateMockOverrideGroup(raw);
    if (err) throw new Error(`Invalid override group: ${err}`);
    const group = normalizeMockOverrideGroup(raw);
    runtime.groups.set(group.id, group);
  }
}

export function upsertRegisteredOverrideGroup(group: MockOverrideGroup): MockOverrideGroup {
  const err = validateMockOverrideGroup(group);
  if (err) throw new Error(`Invalid override group: ${err}`);
  const normalized = normalizeMockOverrideGroup(group);
  runtime.groups.set(normalized.id, normalized);
  if (runtime.activeGroupId === normalized.id) {
    runtime.activeGroup = normalized;
  }
  return normalized;
}

export function removeRegisteredOverrideGroup(groupId: string): boolean {
  const id = groupId.trim();
  const removed = runtime.groups.delete(id);
  if (runtime.activeGroupId === id) {
    runtime.activeGroupId = null;
    runtime.activeGroup = null;
  }
  return removed;
}

/**
 * Set active group in-process (`null` clears).
 * Group must already be registered unless clearing.
 */
export function setActiveOverrideGroup(groupId: string | null): void {
  if (groupId == null || !String(groupId).trim()) {
    runtime.activeGroupId = null;
    runtime.activeGroup = null;
    return;
  }
  const id = String(groupId).trim();
  const group = runtime.groups.get(id);
  if (!group) {
    throw new Error(`Override group not registered: ${id}`);
  }
  runtime.activeGroupId = id;
  runtime.activeGroup = group;
}

/** Overlays from the active group for a mock filename (empty when none). */
export function getActiveOverrideGroupOverlays(filename: string): ActiveGroupOverlays {
  const group = runtime.activeGroup;
  if (!group || !filename?.trim()) {
    return { responseFieldOverrides: [], responseDateOverrides: [] };
  }
  return overlaysFromGroupEntry(findOverrideGroupEntry(group, filename));
}

export function activeOverrideGroupHasEntry(filename: string): boolean {
  const overlays = getActiveOverrideGroupOverlays(filename);
  return (
    overlays.responseFieldOverrides.length > 0 || overlays.responseDateOverrides.length > 0
  );
}

/**
 * Apply active override-group field/date overlays for `filename` (no-op when none).
 */
export function applyActiveOverrideGroupOverlays(
  data: unknown,
  filename: string | undefined,
  getNow: () => Date
): unknown {
  if (!filename?.trim()) return data;
  const overlays = getActiveOverrideGroupOverlays(filename);
  let result = data;
  if (overlays.responseFieldOverrides.length > 0) {
    result = applyResponseFieldOverridesToData(result, overlays.responseFieldOverrides);
  }
  if (overlays.responseDateOverrides.length > 0) {
    result = applyResponseDateOverridesToData(result, overlays.responseDateOverrides, getNow);
  }
  return result;
}

export type { ActiveGroupOverlays };
