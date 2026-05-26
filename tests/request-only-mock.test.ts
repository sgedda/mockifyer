import {
  applyCapturedResponse,
  buildRequestOnlyMockData,
  mockHasCapturableResponse,
  mockPassesThroughToRealApi,
  resolveRecordResponses,
} from '@sgedda/mockifyer-core';

describe('request-only-mock', () => {
  const originalEnv = process.env.MOCKIFYER_RECORD_RESPONSES;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MOCKIFYER_RECORD_RESPONSES;
    } else {
      process.env.MOCKIFYER_RECORD_RESPONSES = originalEnv;
    }
  });

  it('resolveRecordResponses defaults to false', () => {
    delete process.env.MOCKIFYER_RECORD_RESPONSES;
    expect(resolveRecordResponses()).toBe(false);
    expect(resolveRecordResponses(true)).toBe(true);
  });

  it('resolveRecordResponses respects MOCKIFYER_RECORD_RESPONSES env', () => {
    process.env.MOCKIFYER_RECORD_RESPONSES = 'false';
    expect(resolveRecordResponses(true)).toBe(false);
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
