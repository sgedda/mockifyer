import type { MockData, StoredRequest } from '../types';
import { ENV_VARS } from '../types';

function parseBoolEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

export interface RecordResponsesResolution {
  recordResponses: boolean;
}

/**
 * Whether upstream recordings should include response bodies.
 * Env **`MOCKIFYER_RECORD_RESPONSES`** wins; else explicit `recordResponses` argument.
 */
export function resolveRecordResponses(explicit?: boolean): boolean {
  const fromEnv = parseBoolEnv(
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_RECORD_RESPONSES] : undefined
  );
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

export function applyCapturedResponse(mockData: MockData, response: MockData['response']): void {
  mockData.response = response;
  delete mockData.responsePending;
}

export function mockHasCapturableResponse(mockData: MockData): boolean {
  return mockData.responsePending !== true;
}
