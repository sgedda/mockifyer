import { buildMockDataAfterLiveCapture, type MockData } from '@sgedda/mockifyer-core';
import { shouldRunProxyRecordWrite } from '../packages/mockifyer-dashboard/src/utils/proxy-recording';

describe('proxy recording decisions', () => {
  it('does not run the generic record write after a live refresh already persisted metadata', () => {
    const existing: MockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/account',
        headers: {},
        queryParams: {},
      },
      response: {
        status: 200,
        data: { id: 'acct_1', refreshedAt: 'stale' },
        headers: {},
      },
      timestamp: '2026-06-14T00:00:00.000Z',
      alwaysRefreshFromLive: true,
      responseDateOverrides: [{ path: 'refreshedAt', offsetDays: 1 }],
      responseFieldOverrides: [{ path: 'id', value: 'acct_masked' }],
    };
    const refreshed = buildMockDataAfterLiveCapture(existing, {
      status: 200,
      data: { id: 'acct_2', refreshedAt: '2026-06-14T12:00:00.000Z' },
      headers: { 'content-type': 'application/json' },
    });

    expect(refreshed.alwaysRefreshFromLive).toBe(true);
    expect(refreshed.responseDateOverrides).toEqual(existing.responseDateOverrides);
    expect(refreshed.responseFieldOverrides).toEqual(existing.responseFieldOverrides);
    expect(shouldRunProxyRecordWrite(true, true)).toBe(false);
  });

  it('still records normal cache misses when no live refresh write happened', () => {
    expect(shouldRunProxyRecordWrite(true, false)).toBe(true);
    expect(shouldRunProxyRecordWrite(false, false)).toBe(false);
  });
});
