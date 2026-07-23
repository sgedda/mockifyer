import type {
  PoolRef,
  PoolRefMode,
  PoolRefNode,
  PoolRefSelect,
  PoolResponseItem,
} from '../../types/fixture-pool';
import { POOL_ID_PATTERN } from '../../types/fixture-pool';
import { ENV_VARS } from '../../types';
import { parseResponseDataPath } from '../mock-response-date-overrides';
import { cloneJsonValue, getValueAtJsonPath } from './extract';

export type LoadPoolResponseFn = (id: string) => PoolResponseItem | undefined | null;

export class PoolRefResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoolRefResolveError';
  }
}

/** True when `$pool` resolution is enabled (default). Set `MOCKIFYER_POOL_REFS=false` to skip. */
export function arePoolRefsEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {}
): boolean {
  const raw = env[ENV_VARS.MOCK_POOL_REFS];
  if (raw === undefined || raw === '') return true;
  const normalized = String(raw).trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * True when `value` is a v1 `$pool` node (object whose only own key is `$pool`).
 */
export function isPoolRefNode(value: unknown): value is PoolRefNode {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== '$pool') return false;
  return isPlainObject(value.$pool);
}

/** Validate a {@link PoolRef}; returns an error message or `null` when valid. */
export function validatePoolRef(raw: unknown): string | null {
  if (!isPlainObject(raw)) return '$pool must be an object';
  const id = raw.id;
  if (typeof id !== 'string' || !id.trim()) return '$pool.id is required';
  if (!POOL_ID_PATTERN.test(id)) {
    return `$pool.id must match ${POOL_ID_PATTERN}`;
  }

  if (raw.mode !== undefined && raw.mode !== 'document' && raw.mode !== 'value') {
    return '$pool.mode must be "document" or "value"';
  }

  if (raw.path !== undefined && typeof raw.path !== 'string') {
    return '$pool.path must be a string when set';
  }

  const hasSelect = raw.select !== undefined && raw.select !== null;
  const hasIndices = raw.indices !== undefined && raw.indices !== null;

  if (hasSelect && hasIndices) {
    return '$pool.select and $pool.indices are mutually exclusive';
  }

  if (hasSelect) {
    if (!isPlainObject(raw.select)) return '$pool.select must be an object';
    const select = raw.select as unknown as PoolRefSelect;
    const field = select.field;
    const values = select.values;
    if (typeof field !== 'string' || !field.trim()) {
      return '$pool.select.field is required';
    }
    if (!Array.isArray(values) || values.length === 0) {
      return '$pool.select.values must be a non-empty array';
    }
    for (const v of values) {
      const t = typeof v;
      if (t !== 'string' && t !== 'number' && t !== 'boolean') {
        return '$pool.select.values must be string | number | boolean';
      }
    }
  }

  if (hasIndices) {
    if (!Array.isArray(raw.indices) || (raw.indices as unknown[]).length === 0) {
      return '$pool.indices must be a non-empty array';
    }
    for (const i of raw.indices as unknown[]) {
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0) {
        return '$pool.indices must be non-negative integers';
      }
    }
  }

  return null;
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

function setValueAtJsonPath(root: unknown, jsonPath: string, value: unknown): void {
  const segments = parseResponseDataPath(jsonPath.trim());
  if (segments.length === 0) {
    throw new PoolRefResolveError('Cannot set value at empty path');
  }
  let cur: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    const next = segments[i + 1]!;
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      throw new PoolRefResolveError(`Cannot set path "${jsonPath}": parent is not an object`);
    }
    const container = cur as Record<string | number, unknown>;
    if (container[key as string | number] === undefined || container[key as string | number] === null) {
      container[key as string | number] = typeof next === 'number' ? [] : {};
    }
    cur = container[key as string | number];
  }
  if (cur === null || cur === undefined || typeof cur !== 'object') {
    throw new PoolRefResolveError(`Cannot set path "${jsonPath}": parent is not an object`);
  }
  const last = segments[segments.length - 1]!;
  (cur as Record<string | number, unknown>)[last as string | number] = value;
}

function applyArraySelection(
  target: unknown,
  ref: PoolRef,
  contextLabel: string
): unknown {
  const hasSelect = ref.select !== undefined && ref.select !== null;
  const hasIndices = ref.indices !== undefined && ref.indices !== null;

  if (!hasSelect && !hasIndices) {
    return target;
  }

  if (!Array.isArray(target)) {
    throw new PoolRefResolveError(
      `${contextLabel}: select/indices require an array target (got ${target === null ? 'null' : typeof target})`
    );
  }

  if (hasSelect && hasIndices) {
    throw new PoolRefResolveError(`${contextLabel}: select and indices are mutually exclusive`);
  }

  if (hasIndices) {
    const picked: unknown[] = [];
    for (const index of ref.indices!) {
      if (index < 0 || index >= target.length) {
        throw new PoolRefResolveError(
          `${contextLabel}: index ${index} out of range (length ${target.length})`
        );
      }
      picked.push(cloneJsonValue(target[index]));
    }
    return picked;
  }

  const field = ref.select!.field;
  const values = ref.select!.values;
  const picked: unknown[] = [];
  for (const wanted of values) {
    const match = target.find((item) => {
      if (!isPlainObject(item)) return false;
      return Object.is(item[field], wanted);
    });
    if (match === undefined) {
      throw new PoolRefResolveError(
        `${contextLabel}: no array item with ${field}=${JSON.stringify(wanted)}`
      );
    }
    picked.push(cloneJsonValue(match));
  }
  return picked;
}

function unwrapForValueMode(selected: unknown, ref: PoolRef): unknown {
  const singleSelect =
    (ref.select?.values.length === 1 && ref.indices === undefined) ||
    (ref.indices?.length === 1 && ref.select === undefined);
  if (singleSelect && Array.isArray(selected) && selected.length === 1) {
    return selected[0];
  }
  return selected;
}

/**
 * Resolve one {@link PoolRef} against a loaded pool response body.
 */
export function resolvePoolRefAgainstData(ref: PoolRef, poolData: unknown): unknown {
  const validationError = validatePoolRef(ref);
  if (validationError) {
    throw new PoolRefResolveError(validationError);
  }

  const mode: PoolRefMode = ref.mode ?? 'document';
  const root = normalizeResponseDataRoot(poolData);
  const path = ref.path?.trim() ?? '';
  const label = `$pool id="${ref.id}"`;

  if (mode === 'value') {
    const subtree = path ? getValueAtJsonPath(root, path) : root;
    if (path && subtree === undefined) {
      throw new PoolRefResolveError(`${label}: no value at path "${path}"`);
    }
    const selected = applyArraySelection(subtree, ref, label);
    return unwrapForValueMode(selected, ref);
  }

  // document mode
  const document = cloneJsonValue(root);
  const hasFilter =
    (ref.select !== undefined && ref.select !== null) ||
    (ref.indices !== undefined && ref.indices !== null);

  if (!path && !hasFilter) {
    return document;
  }

  if (!path && hasFilter) {
    const selected = applyArraySelection(document, ref, label);
    // Filtering the root array in document mode returns the filtered array (the document is the array).
    return selected;
  }

  const atPath = getValueAtJsonPath(document, path);
  if (atPath === undefined) {
    throw new PoolRefResolveError(`${label}: no value at path "${path}"`);
  }

  if (!hasFilter) {
    return document;
  }

  const filtered = applyArraySelection(atPath, ref, label);
  setValueAtJsonPath(document, path, filtered);
  return document;
}

/**
 * Resolve a single `$pool` node using a loader.
 */
export function resolvePoolRefNode(
  node: PoolRefNode,
  loadPoolResponse: LoadPoolResponseFn
): unknown {
  const ref = node.$pool;
  const validationError = validatePoolRef(ref);
  if (validationError) {
    throw new PoolRefResolveError(validationError);
  }

  const item = loadPoolResponse(ref.id);
  if (!item) {
    throw new PoolRefResolveError(`Pool response fixture not found: ${ref.id}`);
  }

  return resolvePoolRefAgainstData(ref, item.response?.data);
}

/**
 * Deep-walk `data` and replace every `$pool` node (leaf-first via recursion into
 * non-ref objects/arrays before checking siblings).
 */
export function resolvePoolRefsInData(
  data: unknown,
  loadPoolResponse: LoadPoolResponseFn
): unknown {
  if (isPoolRefNode(data)) {
    return resolvePoolRefNode(data, loadPoolResponse);
  }

  if (Array.isArray(data)) {
    return data.map((item) => resolvePoolRefsInData(item, loadPoolResponse));
  }

  if (isPlainObject(data)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      out[key] = resolvePoolRefsInData(value, loadPoolResponse);
    }
    return out;
  }

  return data;
}

/** True when `data` contains at least one `$pool` ref node. */
export function containsPoolRefs(data: unknown): boolean {
  if (isPoolRefNode(data)) return true;
  if (Array.isArray(data)) return data.some(containsPoolRefs);
  if (isPlainObject(data)) {
    return Object.values(data).some(containsPoolRefs);
  }
  return false;
}
