import type { MockData, StoredRequest } from '../types';
import { ENV_VARS } from '../types';
import { getInlineTraceEnvelopeBusinessBody } from './inline-trace';

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
 * Whether upstream recordings should include response bodies.
 * Env **`MOCKIFYER_RECORD_RESPONSES`** wins; else explicit `recordResponses` argument; default `false`.
 */
export function resolveRecordResponses(explicit?: boolean): boolean {
  const fromEnv = envRecordResponsesOverride();
  if (fromEnv !== undefined) return fromEnv;
  if (typeof explicit === 'boolean') return explicit;
  return false;
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

/**
 * Persist a captured upstream response onto a mock.
 * Strips inline-trace `{ data, mockifyerTrace }` envelopes so fixtures store business
 * data only (dashboard `/api/proxy` has no ALS hop context to unwrap via merge).
 */
export function applyCapturedResponse(mockData: MockData, response: MockData['response']): void {
  const businessData = getInlineTraceEnvelopeBusinessBody(response.data);
  mockData.response =
    businessData === response.data ? response : { ...response, data: businessData };
  delete mockData.responsePending;
}

export function mockHasCapturableResponse(mockData: MockData): boolean {
  return mockData.responsePending !== true;
}
