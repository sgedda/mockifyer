import type {
  MockOverrideGroup,
  MockOverrideGroupConfig,
  MockOverrideGroupEntry,
} from '../types/override-group';
import { OVERRIDE_GROUP_ID_PATTERN } from '../types/override-group';
import type { MockResponseDateOverride, MockResponseFieldOverride } from '../types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Validate group document; returns error message or null. */
export function validateMockOverrideGroup(raw: unknown): string | null {
  if (!isPlainObject(raw)) return 'override group must be an object';
  const id = raw.id;
  if (typeof id !== 'string' || !id.trim()) return 'id is required';
  if (!OVERRIDE_GROUP_ID_PATTERN.test(id.trim())) {
    return `id must match ${OVERRIDE_GROUP_ID_PATTERN}`;
  }
  if (typeof raw.label !== 'string' || !raw.label.trim()) return 'label is required';
  if (!Array.isArray(raw.entries)) return 'entries must be an array';

  for (let i = 0; i < raw.entries.length; i++) {
    const entry = raw.entries[i];
    if (!isPlainObject(entry)) return `entries[${i}] must be an object`;
    if (typeof entry.filename !== 'string' || !entry.filename.trim()) {
      return `entries[${i}].filename is required`;
    }
    if (entry.responseFieldOverrides != null && !Array.isArray(entry.responseFieldOverrides)) {
      return `entries[${i}].responseFieldOverrides must be an array`;
    }
    if (entry.responseDateOverrides != null && !Array.isArray(entry.responseDateOverrides)) {
      return `entries[${i}].responseDateOverrides must be an array`;
    }
  }
  return null;
}

export function normalizeMockOverrideGroup(raw: MockOverrideGroup): MockOverrideGroup {
  return {
    id: raw.id.trim(),
    label: raw.label.trim(),
    updatedAt: raw.updatedAt?.trim() || new Date().toISOString(),
    entries: (raw.entries ?? []).map((e) => ({
      filename: e.filename.trim().replace(/\\/g, '/'),
      responseFieldOverrides: e.responseFieldOverrides,
      responseDateOverrides: e.responseDateOverrides,
    })),
  };
}

export function findOverrideGroupEntry(
  group: MockOverrideGroup,
  filename: string
): MockOverrideGroupEntry | undefined {
  const key = filename.trim().replace(/\\/g, '/');
  return group.entries.find((e) => e.filename === key);
}

export function upsertOverrideGroupEntry(
  group: MockOverrideGroup,
  entry: MockOverrideGroupEntry,
  options?: { removeIfEmpty?: boolean }
): MockOverrideGroup {
  const normalized: MockOverrideGroupEntry = {
    filename: entry.filename.trim().replace(/\\/g, '/'),
    responseFieldOverrides: entry.responseFieldOverrides,
    responseDateOverrides: entry.responseDateOverrides,
  };
  const hasFields = (normalized.responseFieldOverrides?.length ?? 0) > 0;
  const hasDates = (normalized.responseDateOverrides?.length ?? 0) > 0;
  const others = group.entries.filter((e) => e.filename !== normalized.filename);
  const removeIfEmpty = options?.removeIfEmpty !== false;
  const entries =
    !removeIfEmpty || hasFields || hasDates ? [...others, normalized] : others;
  return {
    ...group,
    updatedAt: new Date().toISOString(),
    entries,
  };
}

/** Ensure a filename exists in the group even with empty overlays. */
export function ensureOverrideGroupEntry(
  group: MockOverrideGroup,
  filename: string
): MockOverrideGroup {
  const key = filename.trim().replace(/\\/g, '/');
  if (group.entries.some((e) => e.filename === key)) {
    return group;
  }
  return upsertOverrideGroupEntry(
    group,
    { filename: key, responseFieldOverrides: [], responseDateOverrides: [] },
    { removeIfEmpty: false }
  );
}

export interface ActiveGroupOverlays {
  responseFieldOverrides: MockResponseFieldOverride[];
  responseDateOverrides: MockResponseDateOverride[];
}

export function overlaysFromGroupEntry(
  entry: MockOverrideGroupEntry | undefined
): ActiveGroupOverlays {
  return {
    responseFieldOverrides: entry?.responseFieldOverrides ?? [],
    responseDateOverrides: entry?.responseDateOverrides ?? [],
  };
}

export function emptyOverrideGroupConfig(): MockOverrideGroupConfig {
  return { currentGroup: null };
}
