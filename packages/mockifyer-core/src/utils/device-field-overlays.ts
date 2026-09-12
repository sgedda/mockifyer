import type { MockResponseFieldOverride, StoredRequest } from '../types';
import { sha256Hex } from './crypto-digest';
import { generateRequestKey } from './mock-matcher';
import {
  applyResponseFieldOverridesToData,
  validateResponseFieldOverrides,
} from './mock-response-field-overrides';

/**
 * Export/import payload for sharing on-device overlays between testers.
 * Overlays are never written to Redis mock documents.
 */
export interface DeviceFieldOverlaysExport {
  version: 1;
  /** Map of full request hash (sha256 hex of request key) → field overlays. */
  byHash: Record<string, MockResponseFieldOverride[]>;
  /** Optional request-key labels for humans (not required for apply). */
  requestKeys?: Record<string, string>;
}

interface DeviceFieldOverlayEntry {
  overrides: MockResponseFieldOverride[];
  requestKey?: string;
}

/** In-process only — never persisted to Redis/disk mock corpus. */
const overlaysByHash = new Map<string, DeviceFieldOverlayEntry>();

const FULL_HASH_RE = /^[a-f0-9]{64}$/i;

/**
 * Full request hash used as Redis mock id and overlay key (sha256 of {@link generateRequestKey}).
 */
export function requestHashFromRequestKey(requestKey: string): string {
  return sha256Hex(requestKey);
}

/** Resolve a lookup string to the canonical overlay map key (full sha256 hex). */
export function resolveDeviceOverlayHash(requestHashOrKey: string): string {
  const trimmed = requestHashOrKey.trim();
  if (!trimmed) {
    throw new Error('requestHashOrKey is required');
  }
  if (FULL_HASH_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return requestHashFromRequestKey(trimmed);
}

function cloneOverrides(overrides: MockResponseFieldOverride[]): MockResponseFieldOverride[] {
  return overrides.map((o) => ({
    path: o.path,
    value:
      o.value === undefined
        ? o.value
        : typeof structuredClone === 'function'
          ? (() => {
              try {
                return structuredClone(o.value);
              } catch {
                return JSON.parse(JSON.stringify(o.value));
              }
            })()
          : JSON.parse(JSON.stringify(o.value)),
  }));
}

function assertValidOverrides(overrides: MockResponseFieldOverride[]): void {
  const err = validateResponseFieldOverrides(overrides);
  if (err) {
    throw new Error(err);
  }
}

/**
 * Set on-device field overlays for a request hash (full sha256) or raw request key.
 * Replaces any existing overlays for that hash. Does not write to Redis.
 * @returns The canonical request hash used as the store key.
 */
export function setDeviceFieldOverrides(
  requestHashOrKey: string,
  overrides: MockResponseFieldOverride[],
  options?: { requestKey?: string }
): string {
  assertValidOverrides(overrides);
  const hash = resolveDeviceOverlayHash(requestHashOrKey);
  if (!overrides.length) {
    overlaysByHash.delete(hash);
    return hash;
  }
  const existingKey = overlaysByHash.get(hash)?.requestKey;
  const requestKey =
    typeof options?.requestKey === 'string' && options.requestKey.trim()
      ? options.requestKey.trim()
      : !FULL_HASH_RE.test(requestHashOrKey.trim())
        ? requestHashOrKey.trim()
        : existingKey;
  overlaysByHash.set(hash, {
    overrides: cloneOverrides(overrides),
    ...(requestKey ? { requestKey } : {}),
  });
  return hash;
}

/**
 * Set on-device overlays from a {@link StoredRequest} (hash derived via {@link generateRequestKey}).
 */
export function setDeviceFieldOverridesForRequest(
  request: StoredRequest,
  overrides: MockResponseFieldOverride[]
): string {
  const requestKey = generateRequestKey(request);
  return setDeviceFieldOverrides(requestKey, overrides, { requestKey });
}

/** Current overlays for a hash or request key, or `undefined` if none. */
export function getDeviceFieldOverrides(
  requestHashOrKey: string
): MockResponseFieldOverride[] | undefined {
  const hash = resolveDeviceOverlayHash(requestHashOrKey);
  const entry = overlaysByHash.get(hash);
  if (!entry) return undefined;
  return cloneOverrides(entry.overrides);
}

/**
 * Clear one overlay (by hash or request key), or all overlays when omitted.
 */
export function clearDeviceFieldOverrides(requestHashOrKey?: string): void {
  if (requestHashOrKey === undefined || requestHashOrKey === null) {
    overlaysByHash.clear();
    return;
  }
  const trimmed = String(requestHashOrKey).trim();
  if (!trimmed) {
    overlaysByHash.clear();
    return;
  }
  overlaysByHash.delete(resolveDeviceOverlayHash(trimmed));
}

/** True when at least one on-device overlay is registered. */
export function hasDeviceFieldOverlays(): boolean {
  return overlaysByHash.size > 0;
}

/** Snapshot for sharing (JSON-serializable). Does not touch Redis. */
export function exportDeviceFieldOverlays(): DeviceFieldOverlaysExport {
  const byHash: Record<string, MockResponseFieldOverride[]> = {};
  const requestKeys: Record<string, string> = {};
  for (const [hash, entry] of overlaysByHash.entries()) {
    byHash[hash] = cloneOverrides(entry.overrides);
    if (entry.requestKey) {
      requestKeys[hash] = entry.requestKey;
    }
  }
  return {
    version: 1,
    byHash,
    ...(Object.keys(requestKeys).length > 0 ? { requestKeys } : {}),
  };
}

/**
 * Load overlays from an {@link exportDeviceFieldOverlays} payload (e.g. shared by another tester).
 * @param options.merge - when true, merge into existing; otherwise replace all.
 */
export function importDeviceFieldOverlays(
  payload: DeviceFieldOverlaysExport,
  options?: { merge?: boolean }
): void {
  if (!payload || payload.version !== 1 || !payload.byHash || typeof payload.byHash !== 'object') {
    throw new Error('Invalid device field overlays export (expected version: 1 and byHash)');
  }
  if (!options?.merge) {
    overlaysByHash.clear();
  }
  for (const [hashRaw, overrides] of Object.entries(payload.byHash)) {
    if (!FULL_HASH_RE.test(hashRaw)) {
      throw new Error(`Invalid overlay hash key: ${hashRaw}`);
    }
    assertValidOverrides(overrides);
    const hash = hashRaw.toLowerCase();
    if (!overrides.length) {
      overlaysByHash.delete(hash);
      continue;
    }
    const requestKey = payload.requestKeys?.[hashRaw] ?? payload.requestKeys?.[hash];
    overlaysByHash.set(hash, {
      overrides: cloneOverrides(overrides),
      ...(typeof requestKey === 'string' && requestKey.trim()
        ? { requestKey: requestKey.trim() }
        : {}),
    });
  }
}

export interface ApplyDeviceFieldOverlaysLookup {
  /** Full sha256 request hash (preferred; matches Redis / proxy `hash`). */
  requestHash?: string | null;
  /** Raw request key from {@link generateRequestKey}; hashed when hash not provided. */
  requestKey?: string | null;
}

/**
 * Apply in-memory device overlays onto response data (clone). No-op when none match.
 * Device overlays win over persisted mock field/date overlays when applied last.
 */
export function applyDeviceFieldOverlaysToData<T>(
  data: T,
  lookup: string | ApplyDeviceFieldOverlaysLookup | null | undefined
): T {
  if (lookup == null) return data;

  let hash: string | undefined;
  if (typeof lookup === 'string') {
    const t = lookup.trim();
    if (!t) return data;
    hash = resolveDeviceOverlayHash(t);
  } else {
    const fromHash =
      typeof lookup.requestHash === 'string' && lookup.requestHash.trim()
        ? lookup.requestHash.trim()
        : '';
    if (fromHash) {
      hash = FULL_HASH_RE.test(fromHash)
        ? fromHash.toLowerCase()
        : resolveDeviceOverlayHash(fromHash);
    } else if (typeof lookup.requestKey === 'string' && lookup.requestKey.trim()) {
      hash = requestHashFromRequestKey(lookup.requestKey.trim());
    }
  }

  if (!hash) return data;
  const entry = overlaysByHash.get(hash);
  if (!entry?.overrides.length) return data;
  return applyResponseFieldOverridesToData(data, entry.overrides);
}
