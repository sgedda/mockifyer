import type { MockData } from '@sgedda/mockifyer-core';
import {
  applyReplayModeFieldsFromBody,
  bodyHasReplayModeFields,
} from '../packages/mockifyer-dashboard/src/utils/mock-replay-mode-patch';

const snapshot = (overrides: Partial<MockData> = {}): MockData => ({
  request: { method: 'POST', url: 'http://localhost:4000/graphql', headers: {} },
  response: { status: 200, data: { data: { ok: true } }, headers: {} },
  timestamp: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('applyReplayModeFieldsFromBody', () => {
  it('detects replayMode-only PUT bodies', () => {
    expect(bodyHasReplayModeFields({ replayMode: 'passthrough' })).toBe(true);
    expect(bodyHasReplayModeFields({ responseData: {} })).toBe(false);
  });

  it('sets alwaysUseRealApi for passthrough without requiring responseData', () => {
    const mock = snapshot();
    expect(applyReplayModeFieldsFromBody(mock, { replayMode: 'passthrough' })).toBeNull();
    expect(mock.alwaysUseRealApi).toBe(true);
    expect(mock.response.data).toEqual({ data: { ok: true } });
  });

  it('clears live-api flags when returning to stored mode', () => {
    const mock = snapshot({ alwaysUseRealApi: true });
    expect(applyReplayModeFieldsFromBody(mock, { replayMode: 'stored' })).toBeNull();
    expect(mock.alwaysUseRealApi).toBeUndefined();
  });

  it('leaves request-only stubs when switching away from always-live without Refresh now', () => {
    const mock = snapshot({
      alwaysUseRealApi: true,
      responsePending: true,
      response: { status: 0, data: null, headers: {} },
    });
    expect(applyReplayModeFieldsFromBody(mock, { replayMode: 'always-refresh' })).toBeNull();
    expect(mock.responsePending).toBeUndefined();
    expect(mock.alwaysUseRealApi).toBeUndefined();
    expect(mock.alwaysRefreshFromLive).toBe(true);
  });
});
