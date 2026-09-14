import { MockResponseDateOverride } from '../types';

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function setAtPath(root: unknown, segments: (string | number)[], value: unknown): void {
  if (segments.length === 0) {
    return;
  }
  let cur: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    if (cur === null || typeof cur !== 'object') {
      return;
    }
    const container = cur as Record<string | number, unknown>;
    const child = container[key as string | number];
    // Never fabricate missing GraphQL/JSON parents (those stubs lack `__typename`).
    if (child === undefined || child === null || typeof child !== 'object') {
      return;
    }
    cur = child;
  }
  if (cur === null || typeof cur !== 'object') {
    return;
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

const MS_PER_MINUTE = 60 * 1000;
const UNIX_MS_THRESHOLD = 1e11;
const UNIX_S_MIN = 1e9;
const UNIX_MS_MAX = 1e14;
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})([T ])(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|z|[+-]\d{2}:?\d{2})?$/;
const OFFSET_PATTERN = /^([+-])(\d{2}):?(\d{2})$/;

export interface IsoDateTimeShape {
  kind: 'datetime';
  separator: 'T' | ' ';
  hasSeconds: boolean;
  fractionDigits: number;
  zone: string;
  offsetMinutes: number;
}

export interface IsoDateOnlyShape {
  kind: 'date-only';
}

export type IsoDateShape = IsoDateOnlyShape | IsoDateTimeShape;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseOffsetMinutes(zone: string): number | null {
  if (zone === 'Z' || zone === 'z') {
    return 0;
  }
  const match = zone.match(OFFSET_PATTERN);
  if (!match) {
    return null;
  }
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Detects the wire shape of an ISO-like date string so overrides can rewrite the
 * instant without changing date-only / naive / offset / UTC encoding.
 */
export function parseIsoDateStringShape(original: string): IsoDateShape | null {
  const text = original.trim();
  if (ISO_DATE_ONLY_PATTERN.test(text)) {
    return { kind: 'date-only' };
  }
  const match = text.match(ISO_DATETIME_PATTERN);
  if (!match) {
    return null;
  }
  const zone = match[6] ?? '';
  const offsetMinutes = zone ? parseOffsetMinutes(zone) : 0;
  if (offsetMinutes === null) {
    return null;
  }
  return {
    kind: 'datetime',
    separator: match[2] as 'T' | ' ',
    hasSeconds: match[4] !== undefined,
    fractionDigits: match[5]?.length ?? 0,
    zone,
    offsetMinutes,
  };
}

function formatUtcWallClock(
  date: Date,
  hasSeconds: boolean,
  fractionDigits: number
): { ymd: string; hms: string } {
  const ymd = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  let hms = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
  if (hasSeconds) {
    hms += `:${pad2(date.getUTCSeconds())}`;
    if (fractionDigits > 0) {
      const fraction = String(date.getUTCMilliseconds()).padStart(3, '0').slice(0, fractionDigits);
      hms += `.${fraction.padEnd(fractionDigits, '0')}`;
    }
  }
  return { ymd, hms };
}

/**
 * Formats `date` using the same ISO-like shape as `original`.
 *
 * Naive strings (no zone) are treated as UTC-without-Z so replay is stable across
 * host timezones — matching dashboard date-field detection, which appends `Z` to parse.
 * Offset strings keep the original zone and convert the instant into that wall clock.
 *
 * Returns null when `original` is not an ISO-like date string.
 */
export function formatDatePreservingOriginal(date: Date, original: string): string | null {
  const shape = parseIsoDateStringShape(original);
  if (!shape) {
    return null;
  }
  if (shape.kind === 'date-only') {
    return formatUtcWallClock(date, false, 0).ymd;
  }
  const wall = shape.zone && shape.zone !== 'Z' && shape.zone !== 'z'
    ? new Date(date.getTime() + shape.offsetMinutes * MS_PER_MINUTE)
    : date;
  const { ymd, hms } = formatUtcWallClock(wall, shape.hasSeconds, shape.fractionDigits);
  return `${ymd}${shape.separator}${hms}${shape.zone}`;
}

function resolveFormat(override: MockResponseDateOverride, original: unknown): 'iso' | 'unix-ms' | 'unix-s' {
  if (override.format) {
    return override.format;
  }
  if (typeof original === 'number' && Number.isFinite(original)) {
    return original > UNIX_MS_THRESHOLD ? 'unix-ms' : 'unix-s';
  }
  return 'iso';
}

function formatResolvedDate(
  date: Date,
  format: 'iso' | 'unix-ms' | 'unix-s',
  original: unknown
): string | number {
  switch (format) {
    case 'unix-ms':
      return date.getTime();
    case 'unix-s':
      return Math.floor(date.getTime() / 1000);
    case 'iso':
    default:
      if (typeof original === 'string') {
        return formatDatePreservingOriginal(date, original) ?? date.toISOString();
      }
      return date.toISOString();
  }
}

function isLikelyUnixTimestamp(n: number): boolean {
  return (n > UNIX_MS_THRESHOLD && n < UNIX_MS_MAX) || (n > UNIX_S_MIN && n <= UNIX_MS_THRESHOLD);
}

/**
 * Rewrites a date-like leaf, preserving naive vs `Z` / offset ISO shapes.
 * Non-date strings and non-timestamp numbers are left unchanged.
 */
function rewriteDateLikeLeaf(
  value: unknown,
  instant: Date,
  explicitFormat?: MockResponseDateOverride['format']
): unknown {
  if (typeof value === 'string') {
    if (!parseIsoDateStringShape(value)) {
      return value;
    }
    if (explicitFormat === 'unix-ms' || explicitFormat === 'unix-s') {
      return formatResolvedDate(instant, explicitFormat, value);
    }
    return formatDatePreservingOriginal(instant, value) ?? value;
  }
  if (typeof value === 'number' && Number.isFinite(value) && isLikelyUnixTimestamp(value)) {
    if (explicitFormat === 'iso') {
      return formatResolvedDate(instant, 'iso', value);
    }
    const format = explicitFormat ?? resolveFormat({ path: '_' }, value);
    return formatResolvedDate(instant, format, value);
  }
  return value;
}

/**
 * Walks objects/arrays and rewrites date-like values in place so GraphQL
 * `__typename` and sibling fields are not replaced by a bare ISO string.
 */
export function rewriteDateLikeTree(
  value: unknown,
  instant: Date,
  explicitFormat?: MockResponseDateOverride['format']
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteDateLikeTree(item, instant, explicitFormat));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = rewriteDateLikeTree(child, instant, explicitFormat);
    }
    return out;
  }
  return rewriteDateLikeLeaf(value, instant, explicitFormat);
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
 *
 * Uses `getNow` (typically {@link getCurrentDate}) as the base "current" instant.
 * ISO-like original strings keep their wire shape (date-only, naive, offset, or `Z`);
 * explicit `unix-ms` / `unix-s` still win. Non-date strings at a leaf path fall back
 * to `toISOString()`. Object/array paths rewrite date-like children in place so GraphQL
 * `__typename` is preserved. Missing or null paths are skipped — we never invent
 * `{ flightUtc: "<iso>" }` stubs that Apollo cannot cache.
 *
 * NOTE: `base: 'response'` (a legacy/deprecated value that may still appear in older
 * recordings) is treated identically to `base: 'now'`. This avoids drift caused by
 * stale recorded timestamps — for example, mocks that were recorded while a fixed
 * date was active would otherwise keep producing dates anchored at the *recorded*
 * fixed date long after the fixed date is cleared. We always anchor at the
 * manipulated current date (or real time when no manipulation is configured).
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

  for (const override of overrides) {
    const segments = parseResponseDataPath(override.path);
    if (segments.length === 0) {
      continue;
    }
    const original = getAtPath(clone, segments);
    if (original === undefined || original === null) {
      continue;
    }
    const instant = new Date(getNow().getTime() + totalOverrideOffsetMs(override));
    if (isPlainObject(original) || Array.isArray(original)) {
      setAtPath(clone, segments, rewriteDateLikeTree(original, instant, override.format));
      continue;
    }
    const format = resolveFormat(override, original);
    setAtPath(clone, segments, formatResolvedDate(instant, format, original));
  }

  return clone;
}
