import type { MockData } from '@sgedda/mockifyer-core';

/** Only bother stripping when the recording is large enough that `response.data` dominates parse time. */
export const CATALOG_STRIP_MIN_BYTES = 24 * 1024;

function skipWhitespace(raw: string, index: number): number {
  let i = index;
  while (i < raw.length) {
    const code = raw.charCodeAt(i);
    if (code === 32 || code === 10 || code === 13 || code === 9) {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

function skipJsonString(raw: string, index: number): number {
  let i = index + 1;
  while (i < raw.length) {
    const ch = raw.charAt(i);
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '"') return i + 1;
    i += 1;
  }
  throw new Error('unterminated JSON string');
}

function skipJsonValue(raw: string, index: number): number {
  let i = skipWhitespace(raw, index);
  const ch = raw.charAt(i);
  if (ch === '"') return skipJsonString(raw, i);
  if (ch === '{') {
    i += 1;
    i = skipWhitespace(raw, i);
    if (raw.charAt(i) === '}') return i + 1;
    while (i < raw.length) {
      i = skipWhitespace(raw, i);
      if (raw.charAt(i) !== '"') throw new Error('expected object key');
      i = skipJsonString(raw, i);
      i = skipWhitespace(raw, i);
      if (raw.charAt(i) !== ':') throw new Error('expected colon');
      i = skipJsonValue(raw, i + 1);
      i = skipWhitespace(raw, i);
      if (raw.charAt(i) === ',') {
        i += 1;
        continue;
      }
      if (raw.charAt(i) === '}') return i + 1;
      throw new Error('expected end of object');
    }
    throw new Error('unterminated object');
  }
  if (ch === '[') {
    i += 1;
    i = skipWhitespace(raw, i);
    if (raw.charAt(i) === ']') return i + 1;
    while (i < raw.length) {
      i = skipJsonValue(raw, i);
      i = skipWhitespace(raw, i);
      if (raw.charAt(i) === ',') {
        i += 1;
        continue;
      }
      if (raw.charAt(i) === ']') return i + 1;
      throw new Error('expected end of array');
    }
    throw new Error('unterminated array');
  }
  while (i < raw.length) {
    const next = raw.charAt(i);
    if (
      next === ',' ||
      next === '}' ||
      next === ']' ||
      next === ' ' ||
      next === '\n' ||
      next === '\r' ||
      next === '\t'
    ) {
      break;
    }
    i += 1;
  }
  return i;
}

function readJsonString(raw: string, index: number): { value: string; end: number } {
  const end = skipJsonString(raw, index);
  return { value: JSON.parse(raw.slice(index, end)) as string, end };
}

/**
 * Replace top-level `response.data` / `response.body` with `null` so catalog/stats
 * can JSON.parse without allocating multi-MB GraphQL payloads. Leaves `request.data` intact.
 */
export function stripMockResponsePayload(raw: string): string {
  const replacements: Array<{ start: number; end: number }> = [];
  try {
    let i = skipWhitespace(raw, 0);
    if (raw.charAt(i) !== '{') return raw;
    i += 1;
    while (i < raw.length) {
      i = skipWhitespace(raw, i);
      if (raw.charAt(i) === '}') break;
      if (raw.charAt(i) !== '"') return raw;
      const key = readJsonString(raw, i);
      i = skipWhitespace(raw, key.end);
      if (raw.charAt(i) !== ':') return raw;
      i = skipWhitespace(raw, i + 1);
      if (key.value === 'response' && raw.charAt(i) === '{') {
        let j = i + 1;
        while (j < raw.length) {
          j = skipWhitespace(raw, j);
          if (raw.charAt(j) === '}') break;
          if (raw.charAt(j) !== '"') return raw;
          const responseKey = readJsonString(raw, j);
          j = skipWhitespace(raw, responseKey.end);
          if (raw.charAt(j) !== ':') return raw;
          j = skipWhitespace(raw, j + 1);
          const valueStart = j;
          const valueEnd = skipJsonValue(raw, j);
          if (responseKey.value === 'data' || responseKey.value === 'body') {
            replacements.push({ start: valueStart, end: valueEnd });
          }
          j = skipWhitespace(raw, valueEnd);
          if (raw.charAt(j) === ',') {
            j += 1;
            continue;
          }
          if (raw.charAt(j) === '}') break;
          return raw;
        }
      }
      i = skipJsonValue(raw, i);
      i = skipWhitespace(raw, i);
      if (raw.charAt(i) === ',') {
        i += 1;
        continue;
      }
      if (raw.charAt(i) === '}') break;
      return raw;
    }
  } catch {
    return raw;
  }
  if (replacements.length === 0) return raw;
  let out = '';
  let last = 0;
  for (const replacement of replacements) {
    out += raw.slice(last, replacement.start);
    out += 'null';
    last = replacement.end;
  }
  out += raw.slice(last);
  return out;
}

export interface ParsedCatalogMock {
  mockData: MockData;
  rawByteLength: number;
}

export interface CatalogSidecarEntry {
  mockData: MockData;
  rawByteLength: number;
}

/** Bump when compact catalog fields change so stale Redis HASH entries are refetched. */
export const CATALOG_SIDECAR_VERSION = 2;

export function serializeCatalogSidecarEntry(entry: CatalogSidecarEntry): string {
  return JSON.stringify({
    v: CATALOG_SIDECAR_VERSION,
    rawByteLength: entry.rawByteLength,
    mockData: compactMockDataForCatalog(entry.mockData),
  });
}

export function parseCatalogSidecarEntry(raw: string): CatalogSidecarEntry | null {
  try {
    const parsed = JSON.parse(raw) as { v?: unknown; mockData?: MockData; rawByteLength?: unknown };
    if (!parsed || typeof parsed !== 'object' || !parsed.mockData || typeof parsed.mockData !== 'object') {
      return null;
    }
    if (parsed.v !== CATALOG_SIDECAR_VERSION) return null;
    const rawByteLength =
      typeof parsed.rawByteLength === 'number' && Number.isFinite(parsed.rawByteLength)
        ? parsed.rawByteLength
        : 0;
    return { mockData: parsed.mockData, rawByteLength };
  } catch {
    return null;
  }
}

/**
 * Keep list/stats fields and drop response bodies so the Redis catalog HASH
 * never stores multi-MB GraphQL payloads.
 */
export function compactMockDataForCatalog(mockData: MockData): MockData {
  const request = mockData.request;
  const response = mockData.response;
  const compact: MockData = {
    request: {
      method: request?.method ?? 'GET',
      url: request?.url ?? '',
      headers: {},
      queryParams: request?.queryParams ?? {},
      ...(request?.data !== undefined ? { data: request.data } : {}),
    },
    response: {
      status: response?.status ?? 200,
      headers: {},
      data: null,
    },
    timestamp: mockData.timestamp,
  };
  if (mockData.sessionId) compact.sessionId = mockData.sessionId;
  if (mockData.requestId) compact.requestId = mockData.requestId;
  if (mockData.parentRequestId) compact.parentRequestId = mockData.parentRequestId;
  if (typeof mockData.duration === 'number' && Number.isFinite(mockData.duration) && mockData.duration > 0) {
    compact.duration = mockData.duration;
  }
  const responseTime = (mockData as MockData & { responseTime?: unknown }).responseTime;
  if (typeof responseTime === 'number' && Number.isFinite(responseTime) && responseTime > 0) {
    (compact as MockData & { responseTime: number }).responseTime = responseTime;
  }
  if (mockData.alwaysUseRealApi === true) compact.alwaysUseRealApi = true;
  if (mockData.responsePending === true) compact.responsePending = true;
  if (mockData.refreshOnNextRequest === true) compact.refreshOnNextRequest = true;
  if (mockData.alwaysRefreshFromLive === true) compact.alwaysRefreshFromLive = true;
  if (mockData.responseDateOverrides && mockData.responseDateOverrides.length > 0) {
    compact.responseDateOverrides = mockData.responseDateOverrides;
  }
  if (mockData.responseFieldOverrides && mockData.responseFieldOverrides.length > 0) {
    compact.responseFieldOverrides = mockData.responseFieldOverrides;
  }
  return compact;
}

/**
 * Parse a stored mock for dashboard catalog/stats. Large response bodies are nulled first
 * so GraphQL recordings do not JSON.parse multi-megabyte payloads.
 */
export function parseMockJsonForCatalog(raw: string): ParsedCatalogMock {
  const rawByteLength = Buffer.byteLength(raw);
  const toParse = rawByteLength >= CATALOG_STRIP_MIN_BYTES ? stripMockResponsePayload(raw) : raw;
  try {
    return { mockData: JSON.parse(toParse) as MockData, rawByteLength };
  } catch {
    return { mockData: JSON.parse(raw) as MockData, rawByteLength };
  }
}
