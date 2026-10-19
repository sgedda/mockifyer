import {
  applyCapturedResponse,
  buildLocalRecordingMockData,
  buildRequestOnlyMockData,
  mockHasCapturableResponse,
  mockPassesThroughToRealApi,
  resolveLocalRecordResponses,
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

  it('resolveLocalRecordResponses defaults to false (request-only stubs)', () => {
    delete process.env.MOCKIFYER_RECORD_RESPONSES;
    expect(resolveLocalRecordResponses()).toBe(false);
    expect(resolveLocalRecordResponses(true)).toBe(true);
  });

  it('resolveLocalRecordResponses respects MOCKIFYER_RECORD_RESPONSES env', () => {
    process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
    expect(resolveLocalRecordResponses()).toBe(true);
    expect(resolveLocalRecordResponses(false)).toBe(true);
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

  it('buildLocalRecordingMockData stores stub when bodies off', () => {
    const mock = buildLocalRecordingMockData({
      request: { method: 'GET', url: 'https://api.example.com/x', headers: {} },
      response: { status: 200, data: { secret: true }, headers: {} },
      recordResponses: false,
      meta: { requestId: 'req-1', parentRequestId: 'parent-1' },
    });
    expect(mock.responsePending).toBe(true);
    expect(mock.response.data).toBeNull();
    expect(mock.requestId).toBe('req-1');
    expect(mock.parentRequestId).toBe('parent-1');
    expect(mock.alwaysUseRealApi).toBe(true);
  });

  it('buildLocalRecordingMockData stores full body when bodies on', () => {
    const mock = buildLocalRecordingMockData({
      request: { method: 'GET', url: 'https://api.example.com/x', headers: {} },
      response: { status: 200, data: { ok: true }, headers: {} },
      recordResponses: true,
    });
    expect(mock.responsePending).toBeUndefined();
    expect(mock.response.data).toEqual({ ok: true });
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
