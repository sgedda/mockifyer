import type { MockData } from '@sgedda/mockifyer-core';
import {
  shouldStoreProxyErrorPlaceholder,
  shouldWriteNewProxyRecording,
} from '../packages/mockifyer-dashboard/src/utils/proxy-record-existing';

const snapshot = (overrides: Partial<MockData> = {}): MockData => ({
  request: { method: 'POST', url: 'http://localhost:4000/graphql', headers: {} },
  response: { status: 200, data: { data: { ok: true } }, headers: {} },
  timestamp: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('shouldWriteNewProxyRecording', () => {
  it('writes when no mock exists (record-on-miss)', () => {
    expect(shouldWriteNewProxyRecording(null)).toBe(true);
    expect(shouldWriteNewProxyRecording(undefined)).toBe(true);
  });

  it('writes for pending request-only mocks so the first capture can land', () => {
    expect(
      shouldWriteNewProxyRecording(
        snapshot({
          responsePending: true,
          alwaysUseRealApi: true,
          response: { status: 0, data: null, headers: {} },
        })
      )
    ).toBe(true);
  });

  it('does not replace an existing snapshot with alwaysUseRealApi', () => {
    expect(shouldWriteNewProxyRecording(snapshot({ alwaysUseRealApi: true }))).toBe(false);
  });

  it('does not replace always-refresh or stored snapshots', () => {
    expect(shouldWriteNewProxyRecording(snapshot({ alwaysRefreshFromLive: true }))).toBe(false);
    expect(shouldWriteNewProxyRecording(snapshot())).toBe(false);
  });
});

const pending = (): MockData =>
  snapshot({
    responsePending: true,
    alwaysUseRealApi: true,
    response: { status: 0, data: null, headers: {} },
  });

describe('shouldStoreProxyErrorPlaceholder', () => {
  it('stores a placeholder when this request and the store both have no captured body', () => {
    expect(shouldStoreProxyErrorPlaceholder(null, null)).toBe(true);
    expect(shouldStoreProxyErrorPlaceholder(pending(), pending())).toBe(true);
    expect(shouldStoreProxyErrorPlaceholder(null, undefined)).toBe(true);
  });

  it('does not replace a body a parallel request stored before the timeout write', () => {
    expect(shouldStoreProxyErrorPlaceholder(null, snapshot())).toBe(false);
    expect(shouldStoreProxyErrorPlaceholder(pending(), snapshot({ alwaysUseRealApi: true }))).toBe(
      false
    );
  });

  it('does not replace a snapshot this request already loaded', () => {
    expect(shouldStoreProxyErrorPlaceholder(snapshot(), null)).toBe(false);
    expect(shouldStoreProxyErrorPlaceholder(snapshot(), snapshot())).toBe(false);
  });
});
