import {
  buildMockDataAfterLiveCapture,
  buildRequestOnlyMockData,
  type MockData,
} from '@sgedda/mockifyer-core';
import { shouldWriteProxyRecordOnMiss } from '../packages/mockifyer-dashboard/src/utils/proxy-recording';

describe('dashboard proxy live capture recording', () => {
  const existingMock: MockData = {
    request: {
      method: 'GET',
      url: 'https://api.example.test/subscription',
      headers: {},
    },
    response: {
      status: 200,
      data: { subscription: { status: 'stale' } },
      headers: {},
    },
    timestamp: '2026-06-01T00:00:00.000Z',
    refreshOnNextRequest: true,
    responseFieldOverrides: [{ path: 'subscription.status', value: 'patched' }],
  };

  it('treats a persisted live capture as authoritative over record-on-miss', () => {
    const capturedResponse = {
      status: 202,
      data: { subscription: { status: 'live' } },
      headers: { 'content-type': 'application/json' },
    };
    const refreshedMock = buildMockDataAfterLiveCapture(existingMock, capturedResponse);

    expect(shouldWriteProxyRecordOnMiss(true, true)).toBe(false);
    expect(refreshedMock.response).toEqual(capturedResponse);
    expect(refreshedMock.refreshOnNextRequest).toBeUndefined();
    expect(refreshedMock.responsePending).toBeUndefined();
    expect(refreshedMock.alwaysUseRealApi).toBeUndefined();
    expect(refreshedMock.responseFieldOverrides).toEqual(existingMock.responseFieldOverrides);

    const requestOnlyOverwrite = buildRequestOnlyMockData(existingMock.request, {
      alwaysUseRealApi: true,
    });
    expect(requestOnlyOverwrite.responsePending).toBe(true);
    expect(requestOnlyOverwrite.response.data).toBeNull();
  });

  it('still writes record-on-miss data when no existing mock was refreshed', () => {
    expect(shouldWriteProxyRecordOnMiss(true, false)).toBe(true);
    expect(shouldWriteProxyRecordOnMiss(false, false)).toBe(false);
  });
});
