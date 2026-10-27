import type { MockData, MockReplayMode } from '@sgedda/mockifyer-core';
import { applyMockReplayModeSetting, resolveMockReplayMode } from '@sgedda/mockifyer-core';

export interface MockReplayModeListFlags {
  replayMode: MockReplayMode;
  refreshOnNextRequest: boolean;
  alwaysRefreshFromLive: boolean;
}

export function getMockReplayModeListFlags(mockData: unknown): MockReplayModeListFlags {
  const mode = resolveMockReplayMode(mockData as MockData);
  return {
    replayMode: mode,
    refreshOnNextRequest: mode === 'refresh-next',
    alwaysRefreshFromLive: mode === 'always-refresh',
  };
}

const REPLAY_MODE_BODY_KEYS = [
  'replayMode',
  'alwaysUseRealApi',
  'refreshOnNextRequest',
  'alwaysRefreshFromLive',
] as const;

export function bodyHasReplayModeFields(body: Record<string, unknown> | null | undefined): boolean {
  if (!body) return false;
  return REPLAY_MODE_BODY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

const PLACEHOLDER_RESPONSE_STATUS = 0;
const DEFAULT_RESPONSE_STATUS = 200;

/**
 * Writes a PUT body's `responseData`. Supplying the body turns a request-only stub
 * (`responsePending`, status 0) into a captured mock, so a `stored` replay mode in the
 * same request is kept instead of being queued as `refresh-next`.
 */
export function applyResponseDataFromBody(mockData: MockData, responseData: unknown): void {
  if (!mockData.response) {
    mockData.response = { status: DEFAULT_RESPONSE_STATUS, data: {}, headers: {} };
  }
  mockData.response.data = responseData;
  if (mockData.response.status === PLACEHOLDER_RESPONSE_STATUS) {
    mockData.response.status = DEFAULT_RESPONSE_STATUS;
  }
  delete mockData.responsePending;
}

/**
 * Applies replay-mode fields from a dashboard PATCH/PUT body onto mock data.
 * Supports `replayMode` (mutually exclusive) or individual boolean flags.
 */
export function applyReplayModeFieldsFromBody(
  mockData: MockData,
  body: Record<string, unknown>
): string | null {
  if (Object.prototype.hasOwnProperty.call(body, 'replayMode')) {
    const raw = body.replayMode;
    if (raw === null || raw === 'stored') {
      applyMockReplayModeSetting(mockData, 'stored');
      return null;
    }
    if (
      raw === 'passthrough' ||
      raw === 'refresh-next' ||
      raw === 'always-refresh' ||
      raw === 'stored'
    ) {
      applyMockReplayModeSetting(mockData, raw);
      return null;
    }
    return 'replayMode must be stored, refresh-next, always-refresh, passthrough, or null';
  }

  if (Object.prototype.hasOwnProperty.call(body, 'refreshOnNextRequest')) {
    const v = body.refreshOnNextRequest;
    if (v === true) {
      applyMockReplayModeSetting(mockData, 'refresh-next');
    } else if (v === false || v === null) {
      delete mockData.refreshOnNextRequest;
    } else {
      return 'refreshOnNextRequest must be true, false, or null';
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'alwaysRefreshFromLive')) {
    const v = body.alwaysRefreshFromLive;
    if (v === true) {
      applyMockReplayModeSetting(mockData, 'always-refresh');
    } else if (v === false || v === null) {
      delete mockData.alwaysRefreshFromLive;
    } else {
      return 'alwaysRefreshFromLive must be true, false, or null';
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'alwaysUseRealApi')) {
    const v = body.alwaysUseRealApi;
    if (v === true) {
      applyMockReplayModeSetting(mockData, 'passthrough');
    } else if (v === false || v === null) {
      if (resolveMockReplayMode(mockData) === 'passthrough') {
        applyMockReplayModeSetting(mockData, 'stored');
      } else {
        delete mockData.alwaysUseRealApi;
      }
    } else {
      return 'alwaysUseRealApi must be true, false, or null';
    }
  }

  return null;
}
