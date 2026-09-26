import {
  ATLAS_TRACE_REPLAY_PATH,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  replayNetworkEventWithIncludeTrace,
} from '@sgedda/mockifyer-core';
import type { NetworkEvent } from '@sgedda/mockifyer-core';

function hop(
  partial: Partial<NetworkEvent> & Pick<NetworkEvent, 'method' | 'url' | 'source'>,
): NetworkEvent {
  return {
    id: partial.id ?? 'hop-1',
    timestamp: partial.timestamp ?? '2026-09-26T10:00:00.000Z',
    scenario: partial.scenario ?? 'default',
    transport: partial.transport ?? 'fetch',
    method: partial.method,
    url: partial.url,
    path: partial.path,
    status: partial.status,
    durationMs: partial.durationMs,
    source: partial.source,
    requestId: partial.requestId ?? partial.id ?? 'hop-1',
    parentRequestId: partial.parentRequestId,
    requestBodyPreview: partial.requestBodyPreview,
  };
}

describe('atlas-trace-replay', () => {
  it('exposes the Metro path constant', () => {
    expect(ATLAS_TRACE_REPLAY_PATH).toBe('/mockifyer-atlas-trace');
  });

  it('returns hop not found when id is missing from the buffer', async () => {
    const result = await replayNetworkEventWithIncludeTrace([], 'missing');
    expect(result.success).toBe(false);
    expect(result.error).toBe('hop not found');
  });

  it('re-calls the hop URL with include-trace headers', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          ok: true,
          mockifyerTrace: { requestId: 'hop-1', hops: [{ id: 'child-1' }] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    const event = hop({
      id: 'hop-1',
      method: 'GET',
      url: 'https://api.example.com/v1/home',
      path: '/v1/home',
      source: 'upstream',
    });

    const result = await replayNetworkEventWithIncludeTrace([event], 'hop-1', {
      fetchFn,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.url).toBe('https://api.example.com/v1/home');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.example.com/v1/home');
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers[MOCKIFYER_INCLUDE_TRACE_HEADER]).toBe('1');
    expect(headers[MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER]).toBe('1');
    expect(result.mockifyerTrace).toEqual({
      requestId: 'hop-1',
      hops: [{ id: 'child-1' }],
    });
  });

  it('forwards request body preview on POST replays', async () => {
    let seenBody: BodyInit | null | undefined;
    const fetchFn = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      seenBody = init?.body;
      return new Response('{"data":null,"mockifyerTrace":{"hops":[]}}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const event = hop({
      id: 'post-1',
      method: 'POST',
      url: 'https://api.example.com/graphql',
      path: '/graphql',
      source: 'upstream',
      requestBodyPreview: '{"query":"{ ping }"}',
    });

    const result = await replayNetworkEventWithIncludeTrace([event], 'post-1', {
      fetchFn,
    });
    expect(result.success).toBe(true);
    expect(seenBody).toBe('{"query":"{ ping }"}');
  });
});
