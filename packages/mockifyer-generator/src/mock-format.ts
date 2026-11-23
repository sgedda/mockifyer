/**
 * Minimal Mockifyer mock-file shapes (copied from mockifyer-core types)
 * so this package stays free of a core dependency / Node APIs.
 *
 * Source of truth: `packages/mockifyer-core/src/types.ts`
 * (`StoredRequest`, `StoredResponse`, `StoredResponseStream`, `MockData`).
 */

export type StreamKind = 'sse' | 'bytes';

export interface StoredStreamChunk {
  offsetMs: number;
  data: string;
}

export interface StoredResponseStream {
  kind: StreamKind;
  chunks: StoredStreamChunk[];
  firstChunkDelayMs?: number;
  truncated?: boolean;
}

export interface StoredRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: unknown;
  queryParams?: Record<string, string>;
}

export interface StoredResponse {
  status: number;
  data: unknown;
  headers: Record<string, string>;
  stream?: StoredResponseStream;
}

/**
 * Mockifyer on-disk / Redis mock document, plus generator metadata.
 * Extra fields beyond core `MockData` are intentional (`generated`).
 */
export interface GeneratedMockData {
  request: StoredRequest;
  response: StoredResponse;
  timestamp: string;
  duration?: number;
  scenario?: string;
  sessionId?: string;
  requestId?: string;
  parentRequestId?: string;
  parentRequestIds?: string[];
  responseDelayMs?: number;
  statusOverride?: number;
  alwaysUseRealApi?: boolean;
  /**
   * True when this mock was produced by `@sgedda/mockifyer-generator`
   * (vs recorded from a live API).
   */
  generated: true;
}

const DEFAULT_GENERATED_URL = 'https://example.invalid/generated';

/**
 * True when `value` looks like a Mockifyer mock document (`request` + `response`).
 */
export function isMockDataLike(value: unknown): value is Omit<GeneratedMockData, 'generated'> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const request = obj.request;
  const response = obj.response;
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    return false;
  }
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    return false;
  }
  const req = request as Record<string, unknown>;
  const res = response as Record<string, unknown>;
  return typeof req.method === 'string' && typeof req.url === 'string' && typeof res.status === 'number';
}

/**
 * Normalize a sample (full mock document or bare JSON body) into GeneratedMockData.
 * Timestamp is deterministic when `seedKey` is provided.
 */
export function normalizeToMockData(
  sample: unknown,
  options: { seedKey?: string; scenario?: string } = {}
): GeneratedMockData {
  const timestamp = deterministicTimestamp(options.seedKey ?? '0');

  if (isMockDataLike(sample)) {
    const requestHeaders = { ...(sample.request.headers ?? {}) };
    const responseHeaders = { ...(sample.response.headers ?? {}) };
    const stream = sample.response.stream
      ? {
          kind: sample.response.stream.kind,
          chunks: sample.response.stream.chunks.map((c) => ({
            offsetMs: c.offsetMs,
            data: c.data,
          })),
          ...(sample.response.stream.firstChunkDelayMs !== undefined
            ? { firstChunkDelayMs: sample.response.stream.firstChunkDelayMs }
            : {}),
          ...(sample.response.stream.truncated === true ? { truncated: true } : {}),
        }
      : undefined;

    return {
      request: {
        method: sample.request.method,
        url: sample.request.url,
        headers: requestHeaders,
        ...(sample.request.data !== undefined ? { data: deepClone(sample.request.data) } : {}),
        ...(sample.request.queryParams
          ? { queryParams: { ...sample.request.queryParams } }
          : {}),
      },
      response: {
        status: sample.response.status,
        data: deepClone(sample.response.data),
        headers: responseHeaders,
        ...(stream ? { stream } : {}),
      },
      timestamp: typeof sample.timestamp === 'string' ? sample.timestamp : timestamp,
      ...(typeof sample.duration === 'number' ? { duration: sample.duration } : {}),
      ...(options.scenario || sample.scenario
        ? { scenario: options.scenario ?? sample.scenario }
        : {}),
      ...(typeof sample.sessionId === 'string' ? { sessionId: sample.sessionId } : {}),
      ...(typeof sample.requestId === 'string' ? { requestId: sample.requestId } : {}),
      ...(typeof sample.parentRequestId === 'string'
        ? { parentRequestId: sample.parentRequestId }
        : {}),
      ...(Array.isArray(sample.parentRequestIds)
        ? { parentRequestIds: [...sample.parentRequestIds] }
        : {}),
      ...(typeof sample.responseDelayMs === 'number'
        ? { responseDelayMs: sample.responseDelayMs }
        : {}),
      ...(typeof sample.statusOverride === 'number'
        ? { statusOverride: sample.statusOverride }
        : {}),
      generated: true,
    };
  }

  return {
    request: {
      method: 'GET',
      url: DEFAULT_GENERATED_URL,
      headers: {},
    },
    response: {
      status: 200,
      data: deepClone(sample),
      headers: { 'content-type': 'application/json' },
    },
    timestamp,
    duration: 0,
    ...(options.scenario ? { scenario: options.scenario } : {}),
    generated: true,
  };
}

/** Pretty-print a mock document (browser-safe; no fs). */
export function serializeMock(mock: GeneratedMockData): string {
  return `${JSON.stringify(mock, null, 2)}\n`;
}

/**
 * Map named variants → scenario-keyed mock documents for download / Node write.
 */
export function toScenarioMap(
  named: ReadonlyArray<{ name: string; mock: GeneratedMockData }>,
  baseScenario = 'generated'
): Record<string, GeneratedMockData> {
  const out: Record<string, GeneratedMockData> = {};
  for (const item of named) {
    const scenario = `${baseScenario}-${item.name}`;
    out[scenario] = { ...item.mock, scenario, generated: true };
  }
  return out;
}

export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Stable ISO timestamp derived from a seed string (deterministic across runs). */
function deterministicTimestamp(seedKey: string): string {
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    h ^= seedKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Epoch + ~0–10 years of ms, deterministic
  const ms = 1_700_000_000_000 + (h >>> 0) % 315_360_000_000;
  return new Date(ms).toISOString();
}
