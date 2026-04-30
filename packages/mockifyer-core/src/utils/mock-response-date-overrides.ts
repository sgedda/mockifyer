import { MockData, MockResponseDateOverride } from '../types';

/**
 * Parses a dot-separated path; numeric segments become array indices.
 * Example: "items.0.expiresAt" → ["items", 0, "expiresAt"]
 */
export function parseResponseDataPath(path: string): (string | number)[] {
  if (!path || typeof path !== 'string') {
    return [];
  }
  return path.split('.').map((segment) => {
    const n = Number(segment);
    if (segment !== '' && Number.isInteger(n) && String(n) === segment) {
      return n;
    }
    return segment;
  });
}

function getAtPath(root: unknown, segments: (string | number)[]): unknown {
  let cur: unknown = root;
  for (const s of segments) {
    if (cur === null || cur === undefined) {
      return undefined;
    }
    if (typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string | number, unknown>)[s as string | number];
  }
  return cur;
}

function setAtPath(root: unknown, segments: (string | number)[], value: unknown): void {
  if (segments.length === 0) {
    return;
  }
  let cur: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    const next = segments[i + 1];
    const container = cur as Record<string | number, unknown>;
    if (container[key as string | number] === undefined || container[key as string | number] === null) {
      container[key as string | number] = typeof next === 'number' ? [] : {};
    }
    cur = container[key as string | number];
  }
  const last = segments[segments.length - 1];
  (cur as Record<string | number, unknown>)[last as string | number] = value;
}

function deepCloneJson<T>(data: T): T {
  if (data === undefined) {
    return data;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data);
    } catch {
      // circular or unsupported — fall back
    }
  }
  try {
    return JSON.parse(JSON.stringify(data)) as T;
  } catch {
    return data;
  }
}

function resolveFormat(override: MockResponseDateOverride, original: unknown): 'iso' | 'unix-ms' | 'unix-s' {
  if (override.format) {
    return override.format;
  }
  if (typeof original === 'number' && Number.isFinite(original)) {
    return original > 1e11 ? 'unix-ms' : 'unix-s';
  }
  return 'iso';
}

function formatResolvedDate(date: Date, format: 'iso' | 'unix-ms' | 'unix-s'): string | number {
  switch (format) {
    case 'unix-ms':
      return date.getTime();
    case 'unix-s':
      return Math.floor(date.getTime() / 1000);
    case 'iso':
    default:
      return date.toISOString();
  }
}

/** Total offset in ms from optional shorthand fields. */
export function totalOverrideOffsetMs(override: MockResponseDateOverride): number {
  let ms = override.offsetMs ?? 0;
  if (override.offsetDays !== undefined) {
    ms += override.offsetDays * 24 * 60 * 60 * 1000;
  }
  if (override.offsetHours !== undefined) {
    ms += override.offsetHours * 60 * 60 * 1000;
  }
  if (override.offsetMinutes !== undefined) {
    ms += override.offsetMinutes * 60 * 1000;
  }
  return ms;
}

/**
 * Applies relative date overrides to a cloned copy of response data.
 * Uses `getNow` (typically {@link getCurrentDate}) as the base "current" instant.
 */
export function applyResponseDateOverridesToData<T>(
  data: T,
  overrides: MockResponseDateOverride[],
  getNow: () => Date
): T {
  if (!overrides?.length) {
    return data;
  }

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      const applied = applyResponseDateOverridesToData(parsed, overrides, getNow);
      return JSON.stringify(applied) as T;
    } catch {
      return data;
    }
  }

  if (data === null || typeof data !== 'object') {
    return data;
  }

  const clone = deepCloneJson(data);
  const base = getNow().getTime();

  for (const override of overrides) {
    const segments = parseResponseDataPath(override.path);
    if (segments.length === 0) {
      continue;
    }
    const original = getAtPath(clone, segments);
    const format = resolveFormat(override, original);
    const next = new Date(base + totalOverrideOffsetMs(override));
    const value = formatResolvedDate(next, format);
    setAtPath(clone, segments, value);
  }

  return clone;
}

/**
 * Returns response body for a mock hit: unchanged if no overrides; otherwise a deep-cloned
 * body with date fields rewritten relative to the manipulated current date.
 */
export function prepareMockResponseBody(mockData: MockData, getNow: () => Date): unknown {
  const overrides = mockData.responseDateOverrides;
  if (!overrides?.length) {
    return mockData.response.data;
  }
  return applyResponseDateOverridesToData(mockData.response.data, overrides, getNow);
}
