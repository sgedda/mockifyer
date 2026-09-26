import {
  ATLAS_TRACE_REPLAY_PATH,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  buildAtlasTraceReplayHtml,
  buildPrettyCurlCommand,
  replayNetworkEventWithIncludeTrace,
  resolveNetworkEventReplayUrl,
  appendParamsToUrl,
  mergeQueryStringOntoUrl,
  reviveNestedJsonStringFields,
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
    query: partial.query,
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

  it('merges event.query onto a URL that lost axios/fetch params', () => {
    expect(
      resolveNetworkEventReplayUrl(
        hop({
          method: 'GET',
          url: 'http://localhost:4000/rest/deliveryapi/attributecollection',
          path: '/rest/deliveryapi/attributecollection',
          query: '?alias=foo&environment=prod',
          source: 'upstream',
        }),
      ),
    ).toBe(
      'http://localhost:4000/rest/deliveryapi/attributecollection?alias=foo&environment=prod',
    );
    expect(appendParamsToUrl('http://localhost:4000/items', { alias: 'x' })).toBe(
      'http://localhost:4000/items?alias=x',
    );
    expect(mergeQueryStringOntoUrl('http://localhost:4000/items?a=1', '?b=2')).toBe(
      'http://localhost:4000/items?a=1',
    );
  });

  it('revives nested responseBodyPreview JSON strings for readable display', () => {
    const revived = reviveNestedJsonStringFields({
      hops: [
        {
          responseBodyPreview: '{\n  "bookingId": "b1",\n  "status": "Confirmed"\n}',
        },
      ],
    }) as { hops: Array<{ responseBodyPreview: { bookingId: string; status: string } }> };

    expect(revived.hops[0].responseBodyPreview).toEqual({
      bookingId: 'b1',
      status: 'Confirmed',
    });
    expect(JSON.stringify(revived, null, 2)).toContain('"bookingId": "b1"');
    expect(JSON.stringify(revived, null, 2)).not.toContain('\\n');
  });

  it('returns hop not found when id is missing from the buffer', async () => {
    const result = await replayNetworkEventWithIncludeTrace([], 'missing');
    expect(result.success).toBe(false);
    expect(result.error).toBe('hop not found');
  });

  it('re-calls with event.query when the stored url omitted params', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const event = hop({
      id: 'hop-qs',
      method: 'GET',
      url: 'http://localhost:4000/rest/deliveryapi/attributecollection',
      path: '/rest/deliveryapi/attributecollection',
      query: 'alias=home&environment=prod',
      source: 'upstream',
    });

    const result = await replayNetworkEventWithIncludeTrace([event], 'hop-qs', {
      fetchFn,
    });

    expect(result.success).toBe(true);
    expect(result.url).toBe(
      'http://localhost:4000/rest/deliveryapi/attributecollection?alias=home&environment=prod',
    );
    expect(calls[0]?.url).toBe(
      'http://localhost:4000/rest/deliveryapi/attributecollection?alias=home&environment=prod',
    );
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

  it('restores GraphQL display-form previews to JSON before re-call', async () => {
    let seenBody: BodyInit | null | undefined;
    const fetchFn = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      seenBody = init?.body ?? null;
      return new Response(
        JSON.stringify({
          data: { ok: true },
          mockifyerTrace: { requestId: 'gql-1', hops: [] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    const display =
      '# operationName: myAccountDeferredBookings\n\n' +
      'query myAccountDeferredBookings($timeFilter: TimeFilter) {\n' +
      '  myAccount { customerId }\n' +
      '}\n\n' +
      '# Variables\n' +
      '{\n  "timeFilter": "CURRENT_AND_UPCOMING"\n}';

    const event = hop({
      id: 'gql-1',
      method: 'POST',
      url: 'http://localhost:4000/graphql',
      path: '/graphql',
      source: 'upstream',
      requestBodyPreview: display,
    });

    const result = await replayNetworkEventWithIncludeTrace([event], 'gql-1', {
      fetchFn,
    });
    expect(result.success).toBe(true);
    expect(typeof seenBody).toBe('string');
    const parsed = JSON.parse(String(seenBody));
    expect(parsed.operationName).toBe('myAccountDeferredBookings');
    expect(parsed.query).toContain('myAccountDeferredBookings');
    expect(parsed.variables).toEqual({ timeFilter: 'CURRENT_AND_UPCOMING' });
  });

  it('builds an HTML result page for the new-tab format', () => {
    const html = buildAtlasTraceReplayHtml({
      success: true,
      hopId: 'hop-1',
      method: 'GET',
      url: 'https://api.example.com/v1/home',
      status: 200,
      durationMs: 42,
      body: { ok: true, mockifyerTrace: { hops: [] } },
      mockifyerTrace: {
        requestId: 'hop-1',
        hopCount: 2,
        incomplete: false,
        hops: [
          {
            index: 0,
            requestId: 'hop-1',
            parentRequestId: null,
            timestamp: '2026-09-26T10:00:00.000Z',
            method: 'GET',
            url: 'https://api.example.com/v1/home',
            status: 200,
            source: 'upstream',
            transport: 'fetch',
          },
          {
            index: 1,
            requestId: 'child-1',
            parentRequestId: 'hop-1',
            timestamp: '2026-09-26T10:00:00.100Z',
            method: 'GET',
            url: 'https://api.example.com/v1/nested',
            status: 200,
            source: 'upstream',
            transport: 'fetch',
            responseBodyPreview: '{"nested":true}',
          },
        ],
      },
      requestHeaders: { accept: 'application/json' },
    }, {
      capturedLines: ['GET  200  10ms  https://api.example.com/v1/home'],
      atlasLiveUrl: '/mockifyer-atlas-live',
      dashboardUrl: 'http://localhost:3002',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('include-trace');
    expect(html).toContain('https://api.example.com/v1/nested');
    expect(html).toContain('Captured hops');
    expect(html).toContain('Nested hop body previews');
    expect(html).toContain('json-k');
    expect(html).toContain('&quot;nested&quot;');
    // Nested responseBodyPreview is revived to an object (not a `\n`-escaped string).
    expect(html).not.toContain('responseBodyPreview&quot;: &quot;{');
    expect(html).toContain('Response body');
    expect(html).toContain('curl-cmd');
    expect(html).toContain('class="code');
    expect(html).toContain('--code-key');
    expect(html).toContain('href="/mockifyer-atlas-live"');
    expect(html).toContain('>Atlas live</a>');
    expect(html).toContain('href="http://localhost:3002"');
    expect(html).toContain('>Dashboard</a>');
    expect(html).toContain('>Dark mode</button>');
    expect(html).toContain('sec-curl');
    expect(html).toContain('curl-cmd');
    expect(html).toMatch(/curl[\s\S]*-i[\s\S]*-X/);
    expect(html).toContain('data-copy-target');
    expect(html).toContain('Copy');
  });

  it('builds a multiline pretty curl for the trace page', () => {
    const cmd = buildPrettyCurlCommand({
      method: 'POST',
      url: 'http://localhost:4000/graphql',
      headers: {
        'content-type': 'application/json',
        'x-mockifyer-include-trace': '1',
      },
      body: '{"query":"{ ping }"}',
    });
    expect(cmd).toContain("curl -i -X POST 'http://localhost:4000/graphql'");
    expect(cmd).toContain("\\\n");
    expect(cmd).toContain("-H 'content-type: application/json'");
    expect(cmd).toContain("--data-raw '{\"query\":\"{ ping }\"}'");
  });
});
