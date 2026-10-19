import type { MockData, StoredRequest } from '../types';
import { ENV_VARS } from '../types';

function parseBoolEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

/** Env override for {@link resolveRecordResponses}; undefined when unset. */
export function envRecordResponsesOverride(): boolean | undefined {
  return parseBoolEnv(
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_RECORD_RESPONSES] : undefined
  );
}

/**
 * Whether **dashboard proxy** recordings should include response bodies.
 * Env **`MOCKIFYER_RECORD_RESPONSES`** wins; else explicit `recordResponses` argument; default `false`.
 */
export function resolveRecordResponses(explicit?: boolean): boolean {
  const fromEnv = envRecordResponsesOverride();
  if (fromEnv !== undefined) return fromEnv;
  if (typeof explicit === 'boolean') return explicit;
  return false;
}

/**
 * Whether **local filesystem / hybrid** recordings should include response bodies.
 * Env **`MOCKIFYER_RECORD_RESPONSES`** wins when set.
 * Default **`true`** (historical local-save behavior). Set env to `false` for request-only stubs
 * (`responsePending`) — same shape as the dashboard proxy when bodies are off.
 */
export function resolveLocalRecordResponses(explicit?: boolean): boolean {
  const fromEnv = envRecordResponsesOverride();
  if (fromEnv !== undefined) return fromEnv;
  if (typeof explicit === 'boolean') return explicit;
  return true;
}

/** Placeholder mock: visible in dashboard, always live API until response is captured. */
export function buildRequestOnlyMockData(
  request: StoredRequest,
  options?: { alwaysUseRealApi?: boolean }
): MockData {
  return {
    request,
    response: { status: 0, data: null, headers: {} },
    timestamp: new Date().toISOString(),
    responsePending: true,
    alwaysUseRealApi: options?.alwaysUseRealApi ?? true,
  };
}

export interface LocalRecordingMockMeta {
  timestamp?: string;
  duration?: number;
  sessionId?: string;
  requestId?: string;
  parentRequestId?: string | null;
  parentRequestIds?: string[];
  scenario?: string;
  alwaysUseRealApi?: boolean;
}

/**
 * Build the mock row for a local (non-proxy) recording.
 * When `recordResponses` is false, stores a request-only stub and still lets the live
 * response return to the caller (same idea as dashboard proxy stubs).
 */
export function buildLocalRecordingMockData(options: {
  request: StoredRequest;
  response: MockData['response'];
  recordResponses: boolean;
  meta?: LocalRecordingMockMeta;
}): MockData {
  const meta = options.meta ?? {};
  if (!options.recordResponses) {
    const stub = buildRequestOnlyMockData(options.request, {
      alwaysUseRealApi: meta.alwaysUseRealApi ?? true,
    });
    return {
      ...stub,
      ...(meta.timestamp ? { timestamp: meta.timestamp } : {}),
      ...(meta.duration !== undefined ? { duration: meta.duration } : {}),
      ...(meta.sessionId ? { sessionId: meta.sessionId } : {}),
      ...(meta.requestId ? { requestId: meta.requestId } : {}),
      ...(meta.parentRequestId ? { parentRequestId: meta.parentRequestId } : {}),
      ...(meta.parentRequestIds?.length ? { parentRequestIds: meta.parentRequestIds } : {}),
      ...(meta.scenario ? { scenario: meta.scenario } : {}),
    };
  }

  return {
    request: options.request,
    response: options.response,
    timestamp: meta.timestamp ?? new Date().toISOString(),
    ...(meta.duration !== undefined ? { duration: meta.duration } : {}),
    ...(meta.sessionId ? { sessionId: meta.sessionId } : {}),
    ...(meta.requestId ? { requestId: meta.requestId } : {}),
    ...(meta.parentRequestId ? { parentRequestId: meta.parentRequestId } : {}),
    ...(meta.parentRequestIds?.length ? { parentRequestIds: meta.parentRequestIds } : {}),
    ...(meta.scenario ? { scenario: meta.scenario } : {}),
    ...(meta.alwaysUseRealApi === true ? { alwaysUseRealApi: true } : {}),
  };
}

export function applyCapturedResponse(mockData: MockData, response: MockData['response']): void {
  mockData.response = response;
  delete mockData.responsePending;
}

export function mockHasCapturableResponse(mockData: MockData): boolean {
  return mockData.responsePending !== true;
}
