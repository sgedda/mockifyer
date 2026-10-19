import type { MockData } from '@sgedda/mockifyer-core';
import { shouldWriteNewProxyRecording } from '../packages/mockifyer-dashboard/src/utils/proxy-record-existing';

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
