import type { CopyArrayItemParams, MockData, MockResponseFieldOverride } from '../types';
import { parseResponseDataPath } from './mock-response-date-overrides';

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

const RESPONSE_DATA_JSON_CONTAINER_ERROR = 'Response data must be a JSON object or array';

/**
 * True when response data is (or is a JSON string of) an object or array.
 * Plain strings, numbers, booleans, and null are not containers.
 */
export function isResponseDataJsonContainer(data: unknown): boolean {
  const normalized = normalizeResponseDataRoot(data);
  return normalized !== null && typeof normalized === 'object';
}

function requireResponseDataJsonContainer(data: unknown): unknown {
  const normalized = normalizeResponseDataRoot(data);
  if (normalized === null || typeof normalized !== 'object') {
    throw new Error(RESPONSE_DATA_JSON_CONTAINER_ERROR);
  }
  return normalized;
}

/** True when the mock has replay-time field overrides configured. */
export function mockHasResponseFieldOverrides(mockData: MockData): boolean {
  return Array.isArray(mockData.responseFieldOverrides) && mockData.responseFieldOverrides.length > 0;
}

/**
 * Applies field overrides to a cloned copy of response data (stored body unchanged).
 * Soft no-op when the root is not a JSON object/array (replay-time safety).
 */
export function applyResponseFieldOverridesToData<T>(
  data: T,
  overrides: MockResponseFieldOverride[]
): T {
  if (!overrides?.length) return data;

  const normalized = normalizeResponseDataRoot(data);
  if (normalized === null || typeof normalized !== 'object') return data;

  const clone = deepCloneJson(normalized);

  for (const override of overrides) {
    if (!override?.path?.trim()) continue;
    const segments = parseResponseDataPath(override.path.trim());
    if (segments.length === 0) continue;
    setAtPath(clone, segments, deepCloneJson(override.value));
  }

  if (typeof data === 'string') {
    return JSON.stringify(clone) as T;
  }
  return clone as T;
}

/**
 * Sets a value at a JSON path in response data for dashboard write paths.
 * Throws when the root is not a JSON object/array so callers cannot silently no-op.
 */
export function setResponseDataValueAtPath(
  data: unknown,
  path: string,
  value: unknown
): unknown {
  const trimmed = typeof path === 'string' ? path.trim() : '';
  if (!trimmed) {
    throw new Error('path is required');
  }
  requireResponseDataJsonContainer(data);
  return applyResponseFieldOverridesToData(data, [{ path: trimmed, value }]);
}

function applyItemOverrides(item: unknown, itemOverrides: Record<string, unknown>): unknown {
  const clone = deepCloneJson(item);
  for (const [key, value] of Object.entries(itemOverrides)) {
    const segments = parseResponseDataPath(key);
    if (segments.length === 0) continue;
    setAtPath(clone, segments, deepCloneJson(value));
  }
  return clone;
}

export interface CopyArrayItemResult {
  data: unknown;
  newItemIndex: number;
  arrayLength: number;
}

/**
 * Clones an array element, merges `itemOverrides`, and inserts the result into the array.
 * Returns updated response data plus insert metadata.
 */
export function copyArrayItemInResponseData(
  data: unknown,
  params: CopyArrayItemParams
): CopyArrayItemResult {
  const normalized = requireResponseDataJsonContainer(data);
  const clone = deepCloneJson(normalized);
  const arraySegments = parseResponseDataPath(params.arrayPath.trim());
  if (arraySegments.length === 0) {
    throw new Error('arrayPath is required');
  }

  const arrayValue = getAtPath(clone, arraySegments);
  if (!Array.isArray(arrayValue)) {
    throw new Error(`Path "${params.arrayPath}" is not an array`);
  }

  const fromIndex = params.fromIndex;
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= arrayValue.length) {
    throw new Error(`fromIndex ${fromIndex} is out of range (length ${arrayValue.length})`);
  }

  let newItem = deepCloneJson(arrayValue[fromIndex]);
  if (params.itemOverrides && Object.keys(params.itemOverrides).length > 0) {
    newItem = applyItemOverrides(newItem, params.itemOverrides);
  }

  const insertAt = params.insertAt ?? 'append';
  let newItemIndex: number;
  if (insertAt === 'append') {
    newItemIndex = arrayValue.length;
    arrayValue.push(newItem);
  } else if (insertAt === 'prepend') {
    newItemIndex = 0;
    arrayValue.unshift(newItem);
  } else if (typeof insertAt === 'number') {
    if (!Number.isInteger(insertAt) || insertAt < 0 || insertAt > arrayValue.length) {
      throw new Error(`insertAt ${insertAt} is out of range`);
    }
    newItemIndex = insertAt;
    arrayValue.splice(insertAt, 0, newItem);
  } else {
    throw new Error("insertAt must be 'append', 'prepend', or a non-negative integer");
  }

  const resultData = typeof data === 'string' ? JSON.stringify(clone) : clone;
  return {
    data: resultData,
    newItemIndex,
    arrayLength: arrayValue.length,
  };
}

/** Validates field override entries for dashboard/API persistence. */
export function validateResponseFieldOverrides(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return 'responseFieldOverrides must be an array or null';
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return 'Each responseFieldOverrides entry must be an object';
    }
    const path = (item as MockResponseFieldOverride).path;
    if (typeof path !== 'string' || !path.trim()) {
      return 'Each responseFieldOverrides entry must have a non-empty path string';
    }
    if (!Object.prototype.hasOwnProperty.call(item, 'value')) {
      return 'Each responseFieldOverrides entry must include a value';
    }
  }
  return null;
}
