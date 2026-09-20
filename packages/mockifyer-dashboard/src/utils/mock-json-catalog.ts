import { applyMockReplayModeSetting, type MockData, type MockReplayMode } from '@sgedda/mockifyer-core';

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
  if (mockData.inboundParentStub === true) compact.inboundParentStub = true;
  if (mockData.inboundParentDisplay?.url?.trim()) {
    compact.inboundParentDisplay = {
      method: mockData.inboundParentDisplay.method?.trim()
        ? mockData.inboundParentDisplay.method.trim().toUpperCase()
        : 'POST',
      url: mockData.inboundParentDisplay.url.trim(),
    };
  }
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

export const MOCK_REPLAY_FLAG_KEYS = [
  'alwaysUseRealApi',
  'refreshOnNextRequest',
  'alwaysRefreshFromLive',
  'responsePending',
] as const;

export interface MockReplayFlagSnapshot {
  alwaysUseRealApi: boolean;
  refreshOnNextRequest: boolean;
  alwaysRefreshFromLive: boolean;
  responsePending: boolean;
}

export function snapshotMockReplayFlags(mockData: MockData): MockReplayFlagSnapshot {
  return {
    alwaysUseRealApi: mockData.alwaysUseRealApi === true,
    refreshOnNextRequest: mockData.refreshOnNextRequest === true,
    alwaysRefreshFromLive: mockData.alwaysRefreshFromLive === true,
    responsePending: mockData.responsePending === true,
  };
}

export function mockReplayFlagsEqual(a: MockReplayFlagSnapshot, b: MockReplayFlagSnapshot): boolean {
  return (
    a.alwaysUseRealApi === b.alwaysUseRealApi &&
    a.refreshOnNextRequest === b.refreshOnNextRequest &&
    a.alwaysRefreshFromLive === b.alwaysRefreshFromLive &&
    a.responsePending === b.responsePending
  );
}

interface TopLevelJsonMember {
  key: string;
  start: number;
  valueEnd: number;
  commaAfter: number;
}

function listTopLevelObjectMembers(raw: string): TopLevelJsonMember[] | null {
  try {
    let i = skipWhitespace(raw, 0);
    if (raw.charAt(i) !== '{') return null;
    i += 1;
    const members: TopLevelJsonMember[] = [];
    while (i < raw.length) {
      i = skipWhitespace(raw, i);
      if (raw.charAt(i) === '}') break;
      if (raw.charAt(i) !== '"') return null;
      const start = i;
      const key = readJsonString(raw, i);
      i = skipWhitespace(raw, key.end);
      if (raw.charAt(i) !== ':') return null;
      const valueEnd = skipJsonValue(raw, i + 1);
      i = skipWhitespace(raw, valueEnd);
      let commaAfter = -1;
      if (raw.charAt(i) === ',') {
        commaAfter = i;
        i += 1;
      }
      members.push({ key: key.value, start, valueEnd, commaAfter });
      if (commaAfter < 0) break;
    }
    return members;
  } catch {
    return null;
  }
}

function memberValueStart(raw: string, member: TopLevelJsonMember): number {
  const keyEnd = skipJsonString(raw, member.start);
  let i = skipWhitespace(raw, keyEnd);
  return skipWhitespace(raw, i + 1);
}

function applyReplayFlagsToParsedObject(parsed: MockData, flags: MockReplayFlagSnapshot): void {
  for (const key of MOCK_REPLAY_FLAG_KEYS) {
    if (flags[key]) {
      parsed[key] = true;
    } else {
      delete parsed[key];
    }
  }
}

/**
 * Set or remove top-level replay booleans without JSON.parse of nested GraphQL bodies.
 * `true` writes `"key": true`; `false` removes the key. Returns null if the object cannot be walked.
 */
export function patchTopLevelBooleanFlags(raw: string, flags: MockReplayFlagSnapshot): string | null {
  const members = listTopLevelObjectMembers(raw);
  if (!members) return null;

  const byKey = new Map<string, TopLevelJsonMember>();
  for (const member of members) {
    if (byKey.has(member.key)) continue;
    byKey.set(member.key, member);
  }

  const deleteMembers = new Set<TopLevelJsonMember>();
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  const toInsert: string[] = [];

  for (const key of MOCK_REPLAY_FLAG_KEYS) {
    const want = flags[key];
    const existing = byKey.get(key);
    if (want) {
      if (!existing) {
        toInsert.push(key);
        continue;
      }
      const valueStart = memberValueStart(raw, existing);
      if (raw.slice(valueStart, existing.valueEnd).trim() !== 'true') {
        replacements.push({ start: valueStart, end: existing.valueEnd, text: 'true' });
      }
      continue;
    }
    if (existing) deleteMembers.add(existing);
  }

  for (const member of deleteMembers) {
    replacements.push({ start: member.start, end: member.valueEnd, text: '' });
    if (member.commaAfter >= 0) {
      replacements.push({ start: member.commaAfter, end: member.commaAfter + 1, text: '' });
    }
  }

  const kept = members.filter((member) => !deleteMembers.has(member));
  const lastOriginal = members[members.length - 1];
  const lastKept = kept[kept.length - 1];
  if (lastKept && lastOriginal && lastKept !== lastOriginal && lastKept.commaAfter >= 0) {
    replacements.push({ start: lastKept.commaAfter, end: lastKept.commaAfter + 1, text: '' });
  }

  replacements.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = raw;
  let lastAppliedStart = out.length + 1;
  for (const replacement of replacements) {
    if (replacement.end > lastAppliedStart) continue;
    out = out.slice(0, replacement.start) + replacement.text + out.slice(replacement.end);
    lastAppliedStart = replacement.start;
  }

  if (toInsert.length === 0) return out;

  const open = skipWhitespace(out, 0);
  if (out.charAt(open) !== '{') return null;
  const afterBrace = open + 1;
  const nextNonSpace = skipWhitespace(out, afterBrace);
  const hasMembers = nextNonSpace < out.length && out.charAt(nextNonSpace) !== '}';
  const pretty = out.slice(afterBrace, nextNonSpace).includes('\n');
  const inserted = toInsert
    .map((key, index) => {
      const comma = index < toInsert.length - 1 || hasMembers ? ',' : '';
      return pretty ? `\n  "${key}": true${comma}` : `"${key}":true${comma}`;
    })
    .join('');
  return out.slice(0, afterBrace) + inserted + out.slice(afterBrace);
}

export interface RawMockReplayModePatch {
  raw: string;
  changed: boolean;
  outcome: 'stored' | 'refresh-next' | 'passthrough';
  compact: MockData;
}

/**
 * Flip replay-mode flags in stored mock JSON without re-serializing `request` / `response` bodies.
 */
export function applyReplayModeToRawMock(raw: string, mode: MockReplayMode): RawMockReplayModePatch | null {
  let compact: MockData;
  try {
    compact = parseMockJsonForCatalog(raw).mockData;
  } catch {
    return null;
  }
  const before = snapshotMockReplayFlags(compact);
  applyMockReplayModeSetting(compact, mode);
  const after = snapshotMockReplayFlags(compact);
  const outcome: RawMockReplayModePatch['outcome'] =
    mode === 'passthrough' ? 'passthrough' : compact.refreshOnNextRequest === true ? 'refresh-next' : 'stored';
  if (mockReplayFlagsEqual(before, after)) {
    return { raw, changed: false, outcome, compact };
  }
  const patched = patchTopLevelBooleanFlags(raw, after);
  if (patched != null) {
    return { raw: patched, changed: patched !== raw, outcome, compact };
  }
  try {
    const parsed = JSON.parse(raw) as MockData;
    applyReplayFlagsToParsedObject(parsed, after);
    return { raw: JSON.stringify(parsed), changed: true, outcome, compact };
  } catch {
    return null;
  }
}
