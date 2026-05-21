import {
  buildRequestOnlyMockData,
  applyCapturedResponse,
  mockHasCapturableResponse,
  mockPassesThroughToRealApi,
  resolveRecordResponses,
} from '@sgedda/mockifyer-core';

describe('request-only-mock', () => {
  it('resolveRecordResponses defaults to true', () => {
    expect(resolveRecordResponses()).toBe(true);
    expect(resolveRecordResponses(false)).toBe(false);
  });

  it('buildRequestOnlyMockData marks passthrough', () => {
    const mock = buildRequestOnlyMockData({
      method: 'GET',
      url: 'https://api.example.com/x',
      headers: {},
    });
    expect(mock.responsePending).toBe(true);
    expect(mock.alwaysUseRealApi).toBe(true);
    expect(mockPassesThroughToRealApi(mock)).toBe(true);
  });

  it('applyCapturedResponse clears pending', () => {
    const mock = buildRequestOnlyMockData({
      method: 'GET',
      url: 'https://api.example.com/x',
      headers: {},
    });
    applyCapturedResponse(mock, { status: 200, data: { ok: true }, headers: {} });
    expect(mock.responsePending).toBeUndefined();
    expect(mockHasCapturableResponse(mock)).toBe(true);
  });
});
