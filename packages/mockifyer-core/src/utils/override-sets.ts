import type {
  MockData,
  MockResponseDateOverride,
  MockResponseFieldOverride,
  StoredRequest,
} from '../types';
import { sha256Hex } from './crypto-digest';
import { generateRequestKey } from './mock-matcher';

/** Built-in override set id used when none is specified (GUI + lane default). */
export const DEFAULT_OVERRIDE_SET_ID = 'default';

/** Per-scenario directory for override-set documents (not mock traffic). */
export const OVERRIDE_SETS_DIR_NAME = 'override-sets';

const OVERRIDE_SET_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/**
 * Field/date overlays for one mock, keyed in an {@link OverrideSetDocument} by request hash.
 */
export interface OverrideSetEntry {
  responseFieldOverrides?: MockResponseFieldOverride[];
  responseDateOverrides?: MockResponseDateOverride[];
  /** Optional dashboard filename hint (not used for matching). */
  filename?: string;
}

/** Named bundle of per-mock overlays for a scenario. */
export interface OverrideSetDocument {
  id: string;
  label?: string;
  updatedAt: string;
  /** Keys are SHA-256 hex of {@link generateRequestKey}. */
  entries: Record<string, OverrideSetEntry>;
}

export interface OverrideSetSummary {
  id: string;
  label?: string;
  updatedAt?: string;
  entryCount: number;
}

/**
 * Normalize / validate an override set id. Empty input → {@link DEFAULT_OVERRIDE_SET_ID}.
 * @throws if the id has invalid characters
 */
export function normalizeOverrideSetId(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === '') {
    return DEFAULT_OVERRIDE_SET_ID;
  }
  const id = String(raw).trim();
  if (!OVERRIDE_SET_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid override set id "${id}". Use letters, numbers, hyphens, and underscores (max 64).`
    );
  }
  return id;
}

/** SHA-256 hex of the canonical request key — stable mock identity for override-set entries. */
export function overrideSetEntryHashForRequest(request: StoredRequest): string {
  return sha256Hex(generateRequestKey(request));
}

/** Hash for a stored mock document. */
export function overrideSetEntryHashForMock(mockData: Pick<MockData, 'request'>): string {
  return overrideSetEntryHashForRequest(mockData.request);
}

function mergeOverridesByPath<T extends { path: string }>(
  base: T[] | undefined,
  overlay: T[] | undefined
): T[] | undefined {
  if (!overlay?.length) {
    return base?.length ? [...base] : undefined;
  }
  if (!base?.length) {
    return [...overlay];
  }
  const byPath = new Map<string, T>();
  for (const item of base) {
    if (item?.path?.trim()) {
      byPath.set(item.path.trim(), item);
    }
  }
  for (const item of overlay) {
    if (item?.path?.trim()) {
      byPath.set(item.path.trim(), item);
    }
  }
  return Array.from(byPath.values());
}

/**
 * Merge an override-set entry onto mock-embedded overrides.
 * Set paths win over embedded paths; other embedded paths are kept (legacy compatibility).
 * Returns a shallow-cloned mock; stored body is not mutated.
 */
export function applyOverrideSetEntryToMock(
  mockData: MockData,
  entry: OverrideSetEntry | null | undefined
): MockData {
  if (!entry) {
    return mockData;
  }
  const responseFieldOverrides = mergeOverridesByPath(
    mockData.responseFieldOverrides,
    entry.responseFieldOverrides
  );
  const responseDateOverrides = mergeOverridesByPath(
    mockData.responseDateOverrides,
    entry.responseDateOverrides
  );
  if (
    responseFieldOverrides === mockData.responseFieldOverrides &&
    responseDateOverrides === mockData.responseDateOverrides
  ) {
    return mockData;
  }
  return {
    ...mockData,
    ...(responseFieldOverrides !== undefined
      ? { responseFieldOverrides }
      : { responseFieldOverrides: undefined }),
    ...(responseDateOverrides !== undefined
      ? { responseDateOverrides }
      : { responseDateOverrides: undefined }),
  };
}

/**
 * Look up the entry for this mock in a set document and merge onto the mock.
 */
export function applyOverrideSetDocumentToMock(
  mockData: MockData,
  document: OverrideSetDocument | null | undefined
): MockData {
  if (!document?.entries) {
    return mockData;
  }
  const hash = overrideSetEntryHashForMock(mockData);
  return applyOverrideSetEntryToMock(mockData, document.entries[hash]);
}

/** Empty document for a new set (typically {@link DEFAULT_OVERRIDE_SET_ID}). */
export function createEmptyOverrideSetDocument(id: string, label?: string): OverrideSetDocument {
  const normalized = normalizeOverrideSetId(id);
  return {
    id: normalized,
    ...(label != null && label.trim() ? { label: label.trim() } : {}),
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

export function summarizeOverrideSetDocument(doc: OverrideSetDocument): OverrideSetSummary {
  return {
    id: doc.id,
    label: doc.label,
    updatedAt: doc.updatedAt,
    entryCount: Object.keys(doc.entries ?? {}).length,
  };
}

/**
 * Upsert (or clear) one mock's overlays inside a set document.
 * Pass `entry: null` to remove the hash key.
 */
export function upsertOverrideSetEntry(
  document: OverrideSetDocument,
  hash: string,
  entry: OverrideSetEntry | null
): OverrideSetDocument {
  const trimmedHash = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(trimmedHash)) {
    throw new Error('override set entry hash must be a 64-char lowercase hex SHA-256 digest');
  }
  const entries = { ...(document.entries ?? {}) };
  if (
    entry == null ||
    ((!entry.responseFieldOverrides || entry.responseFieldOverrides.length === 0) &&
      (!entry.responseDateOverrides || entry.responseDateOverrides.length === 0) &&
      !entry.filename)
  ) {
    delete entries[trimmedHash];
  } else {
    const next: OverrideSetEntry = {};
    if (entry.responseFieldOverrides?.length) {
      next.responseFieldOverrides = entry.responseFieldOverrides;
    }
    if (entry.responseDateOverrides?.length) {
      next.responseDateOverrides = entry.responseDateOverrides;
    }
    if (entry.filename?.trim()) {
      next.filename = entry.filename.trim();
    }
    entries[trimmedHash] = next;
  }
  return {
    ...document,
    updatedAt: new Date().toISOString(),
    entries,
  };
}

/** Parse/validate a persisted override-set JSON document. */
export function parseOverrideSetDocument(raw: unknown, fallbackId?: string): OverrideSetDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Override set document must be an object');
  }
  const o = raw as Record<string, unknown>;
  const id = normalizeOverrideSetId(
    typeof o.id === 'string' && o.id.trim() ? o.id : fallbackId ?? DEFAULT_OVERRIDE_SET_ID
  );
  const entriesRaw = o.entries;
  const entries: Record<string, OverrideSetEntry> = {};
  if (entriesRaw != null) {
    if (typeof entriesRaw !== 'object' || Array.isArray(entriesRaw)) {
      throw new Error('Override set entries must be an object keyed by request hash');
    }
    for (const [hash, value] of Object.entries(entriesRaw as Record<string, unknown>)) {
      if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
        throw new Error(`Invalid override set entry key "${hash}"`);
      }
      if (!value || typeof value !== 'object') {
        throw new Error(`Override set entry for ${hash} must be an object`);
      }
      const e = value as Record<string, unknown>;
      const entry: OverrideSetEntry = {};
      if (e.responseFieldOverrides != null) {
        if (!Array.isArray(e.responseFieldOverrides)) {
          throw new Error(`responseFieldOverrides for ${hash} must be an array`);
        }
        entry.responseFieldOverrides = e.responseFieldOverrides as MockResponseFieldOverride[];
      }
      if (e.responseDateOverrides != null) {
        if (!Array.isArray(e.responseDateOverrides)) {
          throw new Error(`responseDateOverrides for ${hash} must be an array`);
        }
        entry.responseDateOverrides = e.responseDateOverrides as MockResponseDateOverride[];
      }
      if (typeof e.filename === 'string' && e.filename.trim()) {
        entry.filename = e.filename.trim();
      }
      entries[hash.toLowerCase()] = entry;
    }
  }
  return {
    id,
    ...(typeof o.label === 'string' && o.label.trim() ? { label: o.label.trim() } : {}),
    updatedAt:
      typeof o.updatedAt === 'string' && o.updatedAt.trim()
        ? o.updatedAt.trim()
        : new Date().toISOString(),
    entries,
  };
}
