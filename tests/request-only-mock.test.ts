import {
  applyCapturedResponse,
  buildMockDataAfterLiveCapture,
  buildRequestOnlyMockData,
  mockHasCapturableResponse,
  mockPassesThroughToRealApi,
  MOCKIFYER_TRACE_DATA_KEY,
  MOCKIFYER_TRACE_RESPONSE_KEY,
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

  it('applyCapturedResponse strips inline-trace envelopes before persist', () => {
    const mock = buildRequestOnlyMockData({
      method: 'GET',
      url: 'https://api.example.com/x',
      headers: {},
    });
    const envelope = {
      [MOCKIFYER_TRACE_DATA_KEY]: { ok: true, id: 7 },
      [MOCKIFYER_TRACE_RESPONSE_KEY]: {
        requestId: 'svc-a',
        hopCount: 1,
        incomplete: false,
        hops: [
          {
            index: 0,
            requestId: 'hop-1',
            parentRequestId: 'svc-a',
            timestamp: '2026-01-01T00:00:00.000Z',
            method: 'GET',
            url: 'https://api.example.com/downstream',
            status: 200,
            source: 'upstream',
            transport: 'proxy',
          },
        ],
      },
    };

    applyCapturedResponse(mock, { status: 200, data: envelope, headers: { 'content-type': 'application/json' } });

    expect(mock.response.data).toEqual({ ok: true, id: 7 });
    expect(mock.response.data).not.toHaveProperty(MOCKIFYER_TRACE_RESPONSE_KEY);
  });

  it('buildMockDataAfterLiveCapture strips inline-trace envelopes', () => {
    const existing = {
      request: { method: 'GET', url: 'https://api.example.com/x', headers: {} },
      response: { status: 200, data: { stale: true }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
      refreshOnNextRequest: true,
    };
    const envelope = {
      [MOCKIFYER_TRACE_DATA_KEY]: { fresh: true },
      [MOCKIFYER_TRACE_RESPONSE_KEY]: {
        requestId: 'root',
        hopCount: 0,
        incomplete: false,
        hops: [],
      },
    };

    const updated = buildMockDataAfterLiveCapture(existing, {
      status: 200,
      data: envelope,
      headers: {},
    });

    expect(updated.response.data).toEqual({ fresh: true });
    expect(updated.response.data).not.toHaveProperty(MOCKIFYER_TRACE_RESPONSE_KEY);
    expect(updated.refreshOnNextRequest).toBeUndefined();
  });
});
