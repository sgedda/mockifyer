import type { CopyArrayItemParams, MockData, MockResponseFieldOverride } from '../types';
import { parseResponseDataPath } from './mock-response-date-overrides';

function isUnsafePrototypeSegment(segment: string | number): boolean {
  return (
    typeof segment === 'string' &&
    (segment === '__proto__' || segment === 'prototype' || segment === 'constructor')
  );
}

function hasOwnKey(container: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(container, key);
}

function getObjectChild(container: Record<string, unknown>, key: string): unknown {
  return hasOwnKey(container, key) ? container[key] : undefined;
}

function getContainerChild(
  container: unknown,
  key: string | number
): unknown {
  if (Array.isArray(container)) {
    if (typeof key !== 'number' || !Number.isInteger(key) || key < 0) return undefined;
    return container[key];
  }
  if (container === null || typeof container !== 'object') {
    return undefined;
  }
  const stringKey = typeof key === 'number' ? String(key) : key;
  if (typeof stringKey !== 'string') return undefined;
  return getObjectChild(container as Record<string, unknown>, stringKey);
}

function setContainerChild(container: unknown, key: string | number, value: unknown): boolean {
  if (Array.isArray(container)) {
    if (typeof key !== 'number' || !Number.isInteger(key) || key < 0) return false;
    container[key] = value;
    return true;
  }
  if (container === null || typeof container !== 'object') {
    return false;
  }
  const stringKey = typeof key === 'number' ? String(key) : key;
  if (typeof stringKey !== 'string') return false;
  (container as Record<string, unknown>)[stringKey] = value;
  return true;
}

function getAtPath(root: unknown, segments: (string | number)[]): unknown {
  let cur: unknown = root;
  for (const s of segments) {
    if (isUnsafePrototypeSegment(s)) return undefined;
    cur = getContainerChild(cur, s);
    if (cur === null || cur === undefined) return undefined;
  }
  return cur;
}

function setAtPath(root: unknown, segments: (string | number)[], value: unknown): void {
  if (segments.length === 0) return;
  let cur: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    if (isUnsafePrototypeSegment(key)) return;
    const next = segments[i + 1]!;
    const child = getContainerChild(cur, key);
    if (child === undefined || child === null) {
      if (!setContainerChild(cur, key, typeof next === 'number' ? [] : {})) return;
      cur = getContainerChild(cur, key);
      continue;
    }
    cur = child;
  }
  const last = segments[segments.length - 1]!;
  if (isUnsafePrototypeSegment(last)) return;
  if (last === '__proto__' || last === 'prototype' || last === 'constructor') return;
  setContainerChild(cur, last, value);
}

/**
 * Deletes the value at `segments` (array splice or object key delete). Soft no-op when missing/invalid.
 */
export function removeAtPath(root: unknown, segments: (string | number)[]): void {
  if (segments.length === 0 || root === null || typeof root !== 'object') return;

  let parent: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    if (isUnsafePrototypeSegment(segments[i]!)) return;
    parent = getContainerChild(parent, segments[i]!);
    if (parent === null || parent === undefined) return;
  }

  if (parent === null || typeof parent !== 'object') return;

  const last = segments[segments.length - 1]!;
  if (isUnsafePrototypeSegment(last)) return;
  if (last === '__proto__' || last === 'prototype' || last === 'constructor') return;
  if (Array.isArray(parent)) {
    if (typeof last !== 'number' || !Number.isInteger(last) || last < 0 || last >= parent.length) {
      return;
    }
    parent.splice(last, 1);
    return;
  }
  if (!isPlainObject(parent)) {
    return;
  }
  const stringLast = typeof last === 'number' ? String(last) : last;
  if (typeof stringLast !== 'string' || !Object.prototype.hasOwnProperty.call(parent, stringLast)) {
    return;
  }

  delete (parent as Record<string, unknown>)[stringLast];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Combine an existing path value with an override under `extend` mode.
 * Arrays append (concat when `value` is an array); plain objects shallow-merge; otherwise replace.
 */
export function extendResponseFieldValue(existing: unknown, value: unknown): unknown {
  if (Array.isArray(existing)) {
    const cloned = deepCloneJson(existing);
    if (Array.isArray(value)) {
      cloned.push(...deepCloneJson(value));
    } else {
      cloned.push(deepCloneJson(value));
    }
    return cloned;
  }

  if (isPlainObject(existing) && isPlainObject(value)) {
    return { ...deepCloneJson(existing), ...deepCloneJson(value) };
  }

  return deepCloneJson(value);
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

    if (override.mode === 'remove') {
      removeAtPath(clone, segments);
      continue;
    }

    const existingValue = getAtPath(clone, segments);
    const nextValue =
      override.mode === 'extend'
        ? existingValue === undefined
          ? deepCloneJson(override.value)
          : extendResponseFieldValue(existingValue, override.value)
        : deepCloneJson(override.value);
    setAtPath(clone, segments, nextValue);
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

const VALID_FIELD_OVERRIDE_MODES = new Set(['replace', 'extend', 'remove']);

/** Validates field override entries for dashboard/API persistence. */
export function validateResponseFieldOverrides(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return 'responseFieldOverrides must be an array or null';
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return 'Each responseFieldOverrides entry must be an object';
    }
    const entry = item as MockResponseFieldOverride;
    const path = entry.path;
    if (typeof path !== 'string' || !path.trim()) {
      return 'Each responseFieldOverrides entry must have a non-empty path string';
    }
    if (parseResponseDataPath(path.trim()).some((segment) => isUnsafePrototypeSegment(segment))) {
      return 'Each responseFieldOverrides entry path must not contain __proto__, prototype, or constructor';
    }
    if (entry.mode !== undefined && !VALID_FIELD_OVERRIDE_MODES.has(entry.mode)) {
      return 'Each responseFieldOverrides entry mode must be "replace", "extend", or "remove"';
    }
    if (entry.mode !== 'remove' && !Object.prototype.hasOwnProperty.call(item, 'value')) {
      return 'Each responseFieldOverrides entry must include a value (unless mode is "remove")';
    }
  }
  return null;
}
