import type { MockResponseDateOverride, MockResponseFieldOverride } from '../types';
import {
  applyResponseDateOverridesToData,
} from './mock-response-date-overrides';
import { applyResponseFieldOverridesToData } from './mock-response-field-overrides';
import { parseResponseDataPath } from './mock-response-date-overrides';
import type {
  AtlasPack,
  AtlasPackItemPin,
  AtlasPackOverlay,
  AtlasPackSelect,
} from '../types/atlas-pack';
import { ATLAS_PACK_ID_PATTERN } from '../types/atlas-pack';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepCloneJson<T>(data: T): T {
  if (data === undefined) return data;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(data)) as T;
}

function normalizeResponseDataRoot(data: unknown): unknown {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

function getAtPath(root: unknown, segments: (string | number)[]): unknown {
  let cur: unknown = root;
  for (const s of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[s as string | number];
  }
  return cur;
}

function setAtPath(root: unknown, segments: (string | number)[], value: unknown): void {
  if (segments.length === 0) return;
  let cur: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    const next = segments[i + 1]!;
    const container = cur as Record<string | number, unknown>;
    if (container[key as string | number] === undefined || container[key as string | number] === null) {
      container[key as string | number] = typeof next === 'number' ? [] : {};
    }
    cur = container[key as string | number];
  }
  const last = segments[segments.length - 1]!;
  (cur as Record<string | number, unknown>)[last as string | number] = value;
}

function pinMap(pins: AtlasPackItemPin[] | undefined): Map<string, AtlasPackItemPin> {
  const map = new Map<string, AtlasPackItemPin>();
  if (!pins) return map;
  for (const pin of pins) {
    map.set(JSON.stringify(pin.id), pin);
  }
  return map;
}

function findItemByField(
  items: unknown[],
  field: string,
  wanted: string | number | boolean
): unknown | undefined {
  return items.find((item) => {
    if (!isPlainObject(item)) return false;
    return Object.is(item[field], wanted);
  });
}

/**
 * Apply field + date overrides to a cloned object (item or subtree).
 */
function applyItemOverlays(
  item: unknown,
  fieldOverrides: MockResponseFieldOverride[] | undefined,
  dateOverrides: MockResponseDateOverride[] | undefined,
  getNow: () => Date
): unknown {
  let next = deepCloneJson(item);
  if (fieldOverrides?.length) {
    next = applyResponseFieldOverridesToData(next, fieldOverrides);
  }
  if (dateOverrides?.length) {
    next = applyResponseDateOverridesToData(next, dateOverrides, getNow);
  }
  return next;
}

/**
 * Merge select + pins: prefer live items, fall back to pins, refresh pin snapshots for live hits.
 */
export function mergeSelectedArrayItems(options: {
  liveArray: unknown[];
  select: AtlasPackSelect;
  pins?: AtlasPackItemPin[];
  fieldOverrides?: MockResponseFieldOverride[];
  dateOverrides?: MockResponseDateOverride[];
  getNow: () => Date;
  /** When true, update pin data for ids found live. */
  refreshPins?: boolean;
}): { items: unknown[]; pins: AtlasPackItemPin[]; usedPinIds: Array<string | number | boolean>; usedLiveIds: Array<string | number | boolean> } {
  const { liveArray, select, fieldOverrides, dateOverrides, getNow, refreshPins = true } = options;
  const pinsById = pinMap(options.pins);
  const nextPins = new Map(pinsById);
  const items: unknown[] = [];
  const usedPinIds: Array<string | number | boolean> = [];
  const usedLiveIds: Array<string | number | boolean> = [];
  const nowIso = getNow().toISOString();

  for (const wanted of select.values) {
    const live = findItemByField(liveArray, select.field, wanted);
    let base: unknown;
    if (live !== undefined) {
      base = live;
      usedLiveIds.push(wanted);
      if (refreshPins) {
        nextPins.set(JSON.stringify(wanted), {
          id: wanted,
          data: deepCloneJson(live),
          updatedAt: nowIso,
        });
      }
    } else {
      const pin = pinsById.get(JSON.stringify(wanted));
      if (pin) {
        base = pin.data;
        usedPinIds.push(wanted);
      } else {
        // Skip missing ids — do not invent rows without a pin.
        continue;
      }
    }
    items.push(applyItemOverlays(base, fieldOverrides, dateOverrides, getNow));
  }

  return {
    items,
    pins: [...nextPins.values()],
    usedPinIds,
    usedLiveIds,
  };
}

/** True when overlay should run for this hop (datasource and/or operation). */
export function atlasPackOverlayMatches(
  overlay: AtlasPackOverlay,
  match: { datasourceId?: string | null; operation?: string | null }
): boolean {
  const ds = match.datasourceId?.trim();
  const op = match.operation?.trim();
  const overlayDs = overlay.datasourceId?.trim();
  const overlayOp = overlay.operation?.trim();

  // Untargeted overlay applies to every hop (root-level demos).
  if (!overlayDs && !overlayOp) return true;

  if (overlayDs && ds && overlayDs === ds) return true;
  if (overlayOp && op && overlayOp === op) return true;
  return false;
}

export interface ApplyAtlasPackResult {
  data: unknown;
  /** Pack with refreshed pins (caller may persist). Undefined when nothing changed. */
  pack?: AtlasPack;
  appliedOverlayCount: number;
  usedPinCount: number;
}

/**
 * Apply all matching overlays from a pack onto response data (cloned).
 */
export function applyAtlasPackToData(
  data: unknown,
  pack: AtlasPack,
  options: {
    datasourceId?: string | null;
    operation?: string | null;
    getNow?: () => Date;
    refreshPins?: boolean;
  } = {}
): ApplyAtlasPackResult {
  const getNow = options.getNow ?? (() => new Date());
  const root = normalizeResponseDataRoot(data);
  if (root === null || typeof root !== 'object') {
    return { data, appliedOverlayCount: 0, usedPinCount: 0 };
  }

  let document = deepCloneJson(root);
  let appliedOverlayCount = 0;
  let usedPinCount = 0;
  let packChanged = false;
  const nextOverlays = pack.overlays.map((overlay) => ({ ...overlay }));

  for (let i = 0; i < nextOverlays.length; i++) {
    const overlay = nextOverlays[i]!;
    if (!atlasPackOverlayMatches(overlay, options)) continue;

    const path = overlay.path?.trim() ?? '';
    const segments = path ? parseResponseDataPath(path) : [];

    if (overlay.select) {
      const target = segments.length === 0 ? document : getAtPath(document, segments);
      const liveArray = Array.isArray(target) ? target : [];
      const merged = mergeSelectedArrayItems({
        liveArray,
        select: overlay.select,
        pins: overlay.pins,
        fieldOverrides: overlay.fieldOverrides,
        dateOverrides: overlay.dateOverrides,
        getNow,
        refreshPins: options.refreshPins !== false,
      });
      usedPinCount += merged.usedPinIds.length;
      if (segments.length === 0) {
        document = merged.items;
      } else {
        setAtPath(document, segments, merged.items);
      }
      if (options.refreshPins !== false) {
        const prevPinsJson = JSON.stringify(overlay.pins ?? []);
        const nextPinsJson = JSON.stringify(merged.pins);
        if (prevPinsJson !== nextPinsJson) {
          nextOverlays[i] = { ...overlay, pins: merged.pins };
          packChanged = true;
        }
      }
      appliedOverlayCount += 1;
      continue;
    }

    // No select: apply field/date overrides at path or root.
    if (segments.length === 0) {
      document = applyItemOverlays(
        document,
        overlay.fieldOverrides,
        overlay.dateOverrides,
        getNow
      ) as typeof document;
    } else {
      const subtree = getAtPath(document, segments);
      if (subtree === undefined) continue;
      const nextSubtree = applyItemOverlays(
        subtree,
        overlay.fieldOverrides,
        overlay.dateOverrides,
        getNow
      );
      setAtPath(document, segments, nextSubtree);
    }
    appliedOverlayCount += 1;
  }

  return {
    data: document,
    appliedOverlayCount,
    usedPinCount,
    pack: packChanged
      ? {
          ...pack,
          overlays: nextOverlays,
          updatedAt: getNow().toISOString(),
        }
      : undefined,
  };
}

/** Validate pack id / shape; returns error message or null. */
export function validateAtlasPack(raw: unknown): string | null {
  if (!isPlainObject(raw)) return 'pack must be an object';
  const id = raw.id;
  if (typeof id !== 'string' || !id.trim()) return 'pack.id is required';
  if (!ATLAS_PACK_ID_PATTERN.test(id)) {
    return `pack.id must match ${ATLAS_PACK_ID_PATTERN}`;
  }
  if (typeof raw.label !== 'string' || !raw.label.trim()) return 'pack.label is required';
  if (!Array.isArray(raw.overlays)) return 'pack.overlays must be an array';

  for (let i = 0; i < raw.overlays.length; i++) {
    const overlay = raw.overlays[i];
    if (!isPlainObject(overlay)) return `overlays[${i}] must be an object`;
    if (overlay.path !== undefined && typeof overlay.path !== 'string') {
      return `overlays[${i}].path must be a string when set`;
    }
    if (overlay.datasourceId !== undefined && typeof overlay.datasourceId !== 'string') {
      return `overlays[${i}].datasourceId must be a string when set`;
    }
    if (overlay.operation !== undefined && typeof overlay.operation !== 'string') {
      return `overlays[${i}].operation must be a string when set`;
    }
    if (overlay.select != null) {
      if (!isPlainObject(overlay.select)) return `overlays[${i}].select must be an object`;
      if (typeof overlay.select.field !== 'string' || !overlay.select.field.trim()) {
        return `overlays[${i}].select.field is required`;
      }
      if (!Array.isArray(overlay.select.values) || overlay.select.values.length === 0) {
        return `overlays[${i}].select.values must be a non-empty array`;
      }
    }
    if (overlay.pins != null) {
      if (!Array.isArray(overlay.pins)) return `overlays[${i}].pins must be an array`;
      for (let j = 0; j < overlay.pins.length; j++) {
        const pin = overlay.pins[j];
        if (!isPlainObject(pin)) return `overlays[${i}].pins[${j}] must be an object`;
        if (!('id' in pin)) return `overlays[${i}].pins[${j}].id is required`;
        if (!('data' in pin)) return `overlays[${i}].pins[${j}].data is required`;
      }
    }
  }
  return null;
}

/** Normalize a validated pack (trim ids, default updatedAt). */
export function normalizeAtlasPack(raw: AtlasPack): AtlasPack {
  return {
    id: raw.id.trim(),
    label: raw.label.trim(),
    updatedAt: raw.updatedAt?.trim() || new Date().toISOString(),
    overlays: (raw.overlays ?? []).map((o) => ({
      ...o,
      datasourceId: o.datasourceId?.trim() || undefined,
      operation: o.operation?.trim() || undefined,
      path: o.path?.trim() || undefined,
    })),
  };
}

/**
 * Best-effort GraphQL operationName from a request body (string or object).
 */
export function extractOperationNameFromRequestBody(body: unknown): string | undefined {
  let value = body;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!isPlainObject(value)) return undefined;
  const name = value.operationName;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return undefined;
}
