import type { MockData, MockifyerConfig } from '../types';
import { applyCapturedResponse } from './request-only-mock';
import { mockPassesThroughToRealApi } from './mock-passthrough';
import { applyResponseDateOverridesToData } from './mock-response-date-overrides';
import {
  applyResponseFieldOverridesToData,
  mockHasResponseFieldOverrides,
} from './mock-response-field-overrides';
import { resolveRefreshPassthroughRecordings } from './record-passthrough-config';

/** How a matched mock is served on the next outbound request. */
export type MockReplayMode = 'stored' | 'refresh-next' | 'always-refresh' | 'passthrough';

/**
 * Resolves replay behavior for a mock recording.
 *
 * - `stored` — serve saved body (+ optional date overrides).
 * - `refresh-next` — one upstream fetch, update stored body, clear flag, return live (+ overrides).
 * - `always-refresh` — every request fetches upstream, updates stored body, returns live (+ overrides).
 * - `passthrough` — legacy live API (`alwaysUseRealApi` / `responsePending`); optional store refresh via global config.
 */
export function resolveMockReplayMode(mockData: MockData): MockReplayMode {
  if (mockData.alwaysUseRealApi === true) {
    return 'passthrough';
  }
  if (mockData.alwaysRefreshFromLive === true) {
    return 'always-refresh';
  }
  if (mockData.refreshOnNextRequest === true) {
    return 'refresh-next';
  }
  if (mockData.responsePending === true) {
    return 'passthrough';
  }
  return 'stored';
}

/** True when the outbound request must call the real upstream instead of serving the stored body. */
export function mockRequiresUpstreamFetch(mockData: MockData): boolean {
  return resolveMockReplayMode(mockData) !== 'stored';
}

/** True when the stored mock body should be returned without calling upstream. */
export function mockShouldServeStoredBody(mockData: MockData): boolean {
  return resolveMockReplayMode(mockData) === 'stored';
}

/** True when the mock has date overrides configured on response paths. */
export function mockHasResponseDateOverrides(mockData: MockData): boolean {
  return Array.isArray(mockData.responseDateOverrides) && mockData.responseDateOverrides.length > 0;
}

/**
 * Whether a mock should participate in request matching (exact / similar).
 *
 * Passthrough mocks are normally skipped so traffic hits upstream anonymously; they are included when
 * passthrough mocks carry overrides (live response patching) or when callers set `includePassthroughMocks`.
 */
export function mockShouldBeIncludedInRequestMatch(
  mockData: MockData,
  options?: { includePassthroughMocks?: boolean }
): boolean {
  if (options?.includePassthroughMocks === true) {
    return true;
  }
  if (mockPassesThroughToRealApi(mockData)) {
    return mockHasResponseDateOverrides(mockData) || mockHasResponseFieldOverrides(mockData);
  }
  return true;
}

/**
 * Whether a successful upstream response should overwrite the stored mock corpus entry.
 *
 * Refresh modes always persist. Passthrough persists only when global refresh passthrough is enabled.
 */
export function resolveShouldPersistLiveCapture(
  mockData: MockData,
  config: Pick<MockifyerConfig, 'refreshPassthroughRecordings'>
): boolean {
  const mode = resolveMockReplayMode(mockData);
  if (mode === 'refresh-next' || mode === 'always-refresh') {
    return true;
  }
  if (mode === 'passthrough') {
    return resolveRefreshPassthroughRecordings(config);
  }
  return false;
}

/** Applies upstream capture to mock metadata (raw body, timestamp, clears one-shot refresh flag). */
export function applyLiveFetchMockUpdates(
  mockData: MockData,
  capturedResponse: MockData['response'],
  durationMs?: number
): void {
  applyCapturedResponse(mockData, capturedResponse);
  mockData.timestamp = new Date().toISOString();
  if (durationMs !== undefined) {
    mockData.duration = durationMs;
  }
  if (mockData.refreshOnNextRequest === true) {
    delete mockData.refreshOnNextRequest;
  }
}

/** Clones upstream response and applies configured date overrides for the client. */
export function buildClientResponseFromLiveCapture(
  mockData: MockData,
  capturedResponse: MockData['response'],
  getNow: () => Date
): MockData['response'] {
  const hasDate = mockHasResponseDateOverrides(mockData);
  const hasField = mockHasResponseFieldOverrides(mockData);
  if (!hasDate && !hasField) {
    return capturedResponse;
  }

  let data = capturedResponse.data;
  if (hasField) {
    data = applyResponseFieldOverridesToData(data, mockData.responseFieldOverrides ?? []);
  }
  if (hasDate) {
    data = applyResponseDateOverridesToData(data, mockData.responseDateOverrides ?? [], getNow);
  }

  return {
    ...capturedResponse,
    data,
  };
}

/** Deep-clones mock, applies live capture fields, for safe persistence. */
export function buildMockDataAfterLiveCapture(
  mockData: MockData,
  capturedResponse: MockData['response'],
  durationMs?: number
): MockData {
  const updated: MockData = JSON.parse(JSON.stringify(mockData)) as MockData;
  applyLiveFetchMockUpdates(updated, capturedResponse, durationMs);
  return updated;
}

/** Applies a mutually exclusive replay mode to a mock recording. */
export function applyMockReplayModeSetting(mockData: MockData, mode: MockReplayMode): void {
  delete mockData.alwaysUseRealApi;
  delete mockData.refreshOnNextRequest;
  delete mockData.alwaysRefreshFromLive;

  switch (mode) {
    case 'passthrough':
      mockData.alwaysUseRealApi = true;
      break;
    case 'refresh-next':
      mockData.refreshOnNextRequest = true;
      break;
    case 'always-refresh':
      mockData.alwaysRefreshFromLive = true;
      break;
    case 'stored':
    default:
      break;
  }
}
