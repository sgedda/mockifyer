import {
  applyLiveFetchMockUpdates,
  buildClientResponseFromLiveCapture,
  buildMockDataAfterLiveCapture,
  mockHasResponseDateOverrides,
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
});
