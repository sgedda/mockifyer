import type { MockData, StoredRequest } from '../types';
import { ENV_VARS } from '../types';
import type { RecordResponsesPattern } from './record-responses-matcher';
import {
  resolveRecordResponsesConfig,
  shouldRecordResponseForUrl,
} from './record-responses-matcher';

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
 * 
 * @deprecated Use {@link resolveRecordResponsesForUrl} for URL-aware resolution with pattern support.
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
 * Default **`false`** (request-only stubs, same as the dashboard proxy). Set env or
 * `recordResponses: true` for full bodies.
 * 
 * @deprecated Use {@link resolveLocalRecordResponsesForUrl} for URL-aware resolution with pattern support.
 */
export function resolveLocalRecordResponses(explicit?: boolean): boolean {
  const fromEnv = envRecordResponsesOverride();
  if (fromEnv !== undefined) return fromEnv;
  if (typeof explicit === 'boolean') return explicit;
  return false;
}

/**
 * Resolve whether a specific URL should have its response body recorded (proxy or local).
 * Supports selective recording via pattern matching.
 * 
 * @param url - The request URL
 * @param configValue - The `recordResponses` config value (boolean or pattern array)
 * @param baseUrl - Optional base URL for resolving relative URLs
 * @returns `true` if full response body should be recorded for this URL
 */
export function resolveRecordResponsesForUrl(
  url: string,
  configValue: boolean | Array<RecordResponsesPattern> | undefined,
  baseUrl?: string
): boolean {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  return shouldRecordResponseForUrl(url, configValue, env, baseUrl);
}

/**
 * Resolve whether a specific URL should have its response body recorded locally.
 * Same as {@link resolveRecordResponsesForUrl} but named for clarity in local contexts.
 */
export function resolveLocalRecordResponsesForUrl(
  url: string,
  configValue: boolean | Array<RecordResponsesPattern> | undefined,
  baseUrl?: string
): boolean {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  return shouldRecordResponseForUrl(url, configValue, env, baseUrl);
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
