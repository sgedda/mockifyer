import {
  resolveMockifyerTraceFromHeaders,
  resolveMockifyerTraceFromProxyPayload,
  stripMockifyerTraceFromBody,
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
} from '@sgedda/mockifyer-core';

describe('mockifyer-trace', () => {
  it('resolveMockifyerTraceFromHeaders reads request and parent ids', () => {
    const trace = resolveMockifyerTraceFromHeaders({
      [MOCKIFYER_REQUEST_ID_HEADER]: 'req-hop-1',
      [MOCKIFYER_PARENT_REQUEST_ID_HEADER]: 'req-root',
    });
    expect(trace).toEqual({ requestId: 'req-hop-1', parentRequestId: 'req-root' });
  });

  it('resolveMockifyerTraceFromProxyPayload prefers envelope fields', () => {
    const trace = resolveMockifyerTraceFromProxyPayload(
      { requestId: 'from-payload', parentRequestId: 'from-parent' },
      { [MOCKIFYER_REQUEST_ID_HEADER]: 'from-header' }
    );
    expect(trace).toEqual({ requestId: 'from-payload', parentRequestId: 'from-parent' });
  });

  it('resolveMockifyerTraceFromProxyPayload falls back to headers', () => {
    const trace = resolveMockifyerTraceFromProxyPayload(
      {},
      { [MOCKIFYER_REQUEST_ID_HEADER]: 'req-header-only' }
    );
    expect(trace).toEqual({ requestId: 'req-header-only' });
  });

  it('stripMockifyerTraceFromBody leaves REST payloads unchanged', () => {
    const body = { city: 'Stockholm', tempC: 18.4 };
    expect(stripMockifyerTraceFromBody(body)).toEqual(body);
  });

  it('stripMockifyerTraceFromBody leaves arrays unchanged', () => {
    const body = [{ id: 1 }];
    expect(stripMockifyerTraceFromBody(body)).toEqual(body);
  });

  it('stripMockifyerTraceFromBody unwraps accidental { data, mockifyerTrace } envelopes', () => {
    const body = {
      data: { city: 'Stockholm' },
      mockifyerTrace: { requestId: 'req-1' },
    };
    expect(stripMockifyerTraceFromBody(body)).toEqual({ city: 'Stockholm' });
  });

  it('stripMockifyerTraceFromBody removes GraphQL extensions.mockifyerTrace only', () => {
    const body = {
      data: { matchday: { id: 'md_1' } },
      extensions: {
        mockifyerTrace: { requestId: 'req-gql' },
        other: true,
      },
    };
    expect(stripMockifyerTraceFromBody(body)).toEqual({
      data: { matchday: { id: 'md_1' } },
      extensions: { other: true },
    });
  });
});
