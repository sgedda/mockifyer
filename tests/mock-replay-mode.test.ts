import {
  applyLiveFetchMockUpdates,
  applyMockReplayModeSetting,
  buildClientResponseFromLiveCapture,
  buildMockDataAfterLiveCapture,
  mockHasResponseDateOverrides,
  mockPassesThroughToRealApi,
  mockRequiresUpstreamFetch,
  mockShouldBeIncludedInRequestMatch,
  mockShouldServeStoredBody,
  resolveMockReplayMode,
  resolveShouldPersistLiveCapture,
} from '@sgedda/mockifyer-core';
import type { MockData } from '@sgedda/mockifyer-core';

const baseMock = (overrides: Partial<MockData> = {}): MockData => ({
  request: { method: 'GET', url: 'https://api.example.com/items', headers: {} },
  response: { status: 200, data: { id: 1 }, headers: {} },
  timestamp: '2020-01-01T00:00:00.000Z',
  ...overrides,
});

describe('mock replay mode', () => {
  it('resolves stored mode by default', () => {
    expect(resolveMockReplayMode(baseMock())).toBe('stored');
    expect(mockShouldServeStoredBody(baseMock())).toBe(true);
    expect(mockRequiresUpstreamFetch(baseMock())).toBe(false);
  });

  it('resolves refresh-next and always-refresh modes', () => {
    expect(resolveMockReplayMode(baseMock({ refreshOnNextRequest: true }))).toBe('refresh-next');
    expect(mockShouldServeStoredBody(baseMock({ refreshOnNextRequest: true }))).toBe(false);
    expect(resolveMockReplayMode(baseMock({ alwaysRefreshFromLive: true }))).toBe('always-refresh');
  });

  it('resolves passthrough mode', () => {
    expect(resolveMockReplayMode(baseMock({ alwaysUseRealApi: true }))).toBe('passthrough');
    expect(mockRequiresUpstreamFetch(baseMock({ alwaysUseRealApi: true }))).toBe(true);
  });

  it('includes passthrough mocks in match when overrides exist', () => {
    const passthrough = baseMock({ alwaysUseRealApi: true });
    expect(mockShouldBeIncludedInRequestMatch(passthrough)).toBe(false);
    expect(
      mockShouldBeIncludedInRequestMatch(
        baseMock({
          alwaysUseRealApi: true,
          responseDateOverrides: [{ path: 'expiresAt' }],
        })
      )
    ).toBe(true);
  });

  it('always persists refresh modes after live capture', () => {
    expect(resolveShouldPersistLiveCapture(baseMock({ refreshOnNextRequest: true }), {})).toBe(true);
    expect(resolveShouldPersistLiveCapture(baseMock({ alwaysRefreshFromLive: true }), {})).toBe(true);
    expect(
      resolveShouldPersistLiveCapture(baseMock({ alwaysUseRealApi: true }), { refreshPassthroughRecordings: false })
    ).toBe(false);
  });

  it('clears refreshOnNextRequest when applying live capture', () => {
    const mock = baseMock({ refreshOnNextRequest: true });
    applyLiveFetchMockUpdates(mock, { status: 200, data: { id: 2 }, headers: {} });
    expect(mock.refreshOnNextRequest).toBeUndefined();
    expect(mock.response.data).toEqual({ id: 2 });
  });

  it('applies date overrides on live capture for client response', () => {
    const fixed = new Date('2025-06-01T12:00:00.000Z');
    const mock = baseMock({
      alwaysRefreshFromLive: true,
      responseDateOverrides: [{ path: 'expiresAt' }],
    });
    const client = buildClientResponseFromLiveCapture(
      mock,
      { status: 200, data: { expiresAt: '1999-01-01T00:00:00.000Z' }, headers: {} },
      () => fixed
    );
    expect((client.data as { expiresAt: string }).expiresAt).toBe(fixed.toISOString());
    expect(mockHasResponseDateOverrides(mock)).toBe(true);
  });

  it('honors explicit refresh flags over responsePending', () => {
    expect(
      resolveMockReplayMode(baseMock({ responsePending: true, refreshOnNextRequest: true }))
    ).toBe('refresh-next');
    expect(
      mockPassesThroughToRealApi(baseMock({ responsePending: true, refreshOnNextRequest: true }))
    ).toBe(false);
    expect(
      mockShouldBeIncludedInRequestMatch(baseMock({ responsePending: true, refreshOnNextRequest: true }))
    ).toBe(true);
  });

  it('clears responsePending when leaving live-api mode on a request-only stub', () => {
    const pending = baseMock({
      alwaysUseRealApi: true,
      responsePending: true,
      response: { status: 0, data: null, headers: {} },
    });

    applyMockReplayModeSetting(pending, 'refresh-next');
    expect(pending.responsePending).toBeUndefined();
    expect(pending.alwaysUseRealApi).toBeUndefined();
    expect(pending.refreshOnNextRequest).toBe(true);
    expect(resolveMockReplayMode(pending)).toBe('refresh-next');
    expect(mockPassesThroughToRealApi(pending)).toBe(false);
  });

  it('promotes stored mode to refresh-next when no response has been captured', () => {
    const pending = baseMock({ alwaysUseRealApi: true, responsePending: true });
    applyMockReplayModeSetting(pending, 'stored');
    expect(pending.responsePending).toBeUndefined();
    expect(resolveMockReplayMode(pending)).toBe('refresh-next');
  });

  it('keeps responsePending when staying on passthrough', () => {
    const pending = baseMock({ alwaysUseRealApi: true, responsePending: true });
    applyMockReplayModeSetting(pending, 'passthrough');
    expect(pending.responsePending).toBe(true);
    expect(pending.alwaysUseRealApi).toBe(true);
    expect(resolveMockReplayMode(pending)).toBe('passthrough');
  });

  it('buildMockDataAfterLiveCapture clones before mutating', () => {
    const original = baseMock({ refreshOnNextRequest: true });
    const updated = buildMockDataAfterLiveCapture(
      original,
      { status: 200, data: { fresh: true }, headers: {} }
    );
    expect(original.refreshOnNextRequest).toBe(true);
    expect(updated.refreshOnNextRequest).toBeUndefined();
    expect((updated.response.data as { fresh: boolean }).fresh).toBe(true);
  });

  it('promotes stored to refresh-next even when responsePending was cleared but body is still empty', () => {
    const mock = baseMock({
      response: { status: 0, data: null, headers: {} },
      alwaysUseRealApi: true,
      responsePending: true,
    });
    applyMockReplayModeSetting(mock, 'always-refresh');
    expect(mock.responsePending).toBeUndefined();
    expect(mock.alwaysRefreshFromLive).toBe(true);
    applyMockReplayModeSetting(mock, 'stored');
    expect(resolveMockReplayMode(mock)).toBe('refresh-next');
    expect(mock.response.status).toBe(0);
    expect(mock.response.data).toBe(null);
  });
});
