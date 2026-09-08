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

const runtimeByScenario: Map<string, OverrideGroupRuntimeState> = new Map();

function getOrCreateRuntimeState(scenarioPath: string): OverrideGroupRuntimeState {
  let state = runtimeByScenario.get(scenarioPath);
  if (!state) {
    state = {
      scenarioPath,
      activeGroupId: null,
      activeGroup: null,
      groups: new Map(),
    };
    runtimeByScenario.set(scenarioPath, state);
  }
  return state;
}

/** Reset in-process override group registry (tests). */
export function resetOverrideGroupRuntime(): void {
  runtimeByScenario.clear();
}

export function getOverrideGroupRuntimeScenarioPath(): string | null {
  if (runtimeByScenario.size === 0) return null;
  const first = runtimeByScenario.values().next().value as OverrideGroupRuntimeState | undefined;
  return first?.scenarioPath ?? null;
}

/** Record which scenario folder this runtime was hydrated from (null clears). */
export function setOverrideGroupRuntimeScenarioPath(scenarioPath: string | null): void {
  if (scenarioPath) {
    getOrCreateRuntimeState(scenarioPath);
  }
}

export function getActiveOverrideGroupId(scenarioPath?: string): string | null {
  if (!scenarioPath) {
    const first = runtimeByScenario.values().next().value as OverrideGroupRuntimeState | undefined;
    return first?.activeGroupId ?? null;
  }
  const state = runtimeByScenario.get(scenarioPath);
  return state?.activeGroupId ?? null;
}

export function getActiveOverrideGroup(scenarioPath?: string): MockOverrideGroup | null {
  if (!scenarioPath) {
    const first = runtimeByScenario.values().next().value as OverrideGroupRuntimeState | undefined;
    return first?.activeGroup ?? null;
  }
  const state = runtimeByScenario.get(scenarioPath);
  return state?.activeGroup ?? null;
}

export function listRegisteredOverrideGroups(scenarioPath?: string): MockOverrideGroup[] {
  if (!scenarioPath) {
    const first = runtimeByScenario.values().next().value as OverrideGroupRuntimeState | undefined;
    if (!first) return [];
    return [...first.groups.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  const state = runtimeByScenario.get(scenarioPath);
  if (!state) return [];
  return [...state.groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Replace all registered groups (does not write disk). */
export function replaceRegisteredOverrideGroups(groups: MockOverrideGroup[], scenarioPath: string): void {
  const state = getOrCreateRuntimeState(scenarioPath);
  state.groups.clear();
  for (const raw of groups) {
    const err = validateMockOverrideGroup(raw);
    if (err) throw new Error(`Invalid override group: ${err}`);
    const group = normalizeMockOverrideGroup(raw);
    state.groups.set(group.id, group);
  }
}

/** Register / replace groups in memory (does not write disk). */
export function registerOverrideGroups(groups: MockOverrideGroup[], scenarioPath: string): void {
  const state = getOrCreateRuntimeState(scenarioPath);
  for (const raw of groups) {
    const err = validateMockOverrideGroup(raw);
    if (err) throw new Error(`Invalid override group: ${err}`);
    const group = normalizeMockOverrideGroup(raw);
    state.groups.set(group.id, group);
  }
}

export function upsertRegisteredOverrideGroup(group: MockOverrideGroup, scenarioPath: string): MockOverrideGroup {
  const err = validateMockOverrideGroup(group);
  if (err) throw new Error(`Invalid override group: ${err}`);
  const normalized = normalizeMockOverrideGroup(group);
  const state = getOrCreateRuntimeState(scenarioPath);
  state.groups.set(normalized.id, normalized);
  if (state.activeGroupId === normalized.id) {
    state.activeGroup = normalized;
  }
  return normalized;
}

export function removeRegisteredOverrideGroup(groupId: string, scenarioPath: string): boolean {
  const id = groupId.trim();
  const state = runtimeByScenario.get(scenarioPath);
  if (!state) return false;
  const removed = state.groups.delete(id);
  if (state.activeGroupId === id) {
    state.activeGroupId = null;
    state.activeGroup = null;
  }
  return removed;
}

/**
 * Set active group in-process (`null` clears).
 * Group must already be registered unless clearing.
 */
export function setActiveOverrideGroup(groupId: string | null, scenarioPath: string): void {
  const state = getOrCreateRuntimeState(scenarioPath);
  if (groupId == null || !String(groupId).trim()) {
    state.activeGroupId = null;
    state.activeGroup = null;
    return;
  }
  const id = String(groupId).trim();
  const group = state.groups.get(id);
  if (!group) {
    throw new Error(`Override group not registered: ${id}`);
  }
  state.activeGroupId = id;
  state.activeGroup = group;
}

/** Overlays from the active group for a mock filename (empty when none). */
export function getActiveOverrideGroupOverlays(filename: string, scenarioPath?: string): ActiveGroupOverlays {
  const group = getActiveOverrideGroup(scenarioPath);
  if (!group || !filename?.trim()) {
    return { responseFieldOverrides: [], responseDateOverrides: [] };
  }
  return overlaysFromGroupEntry(findOverrideGroupEntry(group, filename));
}

export function activeOverrideGroupHasEntry(filename: string, scenarioPath?: string): boolean {
  const overlays = getActiveOverrideGroupOverlays(filename, scenarioPath);
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
  getNow: () => Date,
  scenarioPath?: string
): unknown {
  if (!filename?.trim()) return data;
  const overlays = getActiveOverrideGroupOverlays(filename, scenarioPath);
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
