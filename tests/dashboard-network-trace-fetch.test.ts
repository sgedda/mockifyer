import {
  networkTraceHopToNetworkEvent,
  networkTraceToNetworkEvents,
  normalizeDashboardBaseUrl,
  pullDashboardDescendantsForParents,
  selectNewDashboardChildHops,
  selectNewDashboardDescendantHops,
  type NetworkRequestTrace,
} from '@sgedda/mockifyer-core';
import type { NetworkEvent } from '@sgedda/mockifyer-core';

function hop(partial: Partial<NetworkEvent> & Pick<NetworkEvent, 'id' | 'method' | 'url' | 'source'>): NetworkEvent {
  return {
    id: partial.id,
    timestamp: partial.timestamp ?? '2026-09-26T12:00:00.000Z',
    scenario: partial.scenario ?? 'default',
    transport: partial.transport ?? 'proxy',
    method: partial.method,
    url: partial.url,
    source: partial.source,
    requestId: partial.requestId,
    parentRequestId: partial.parentRequestId,
    status: partial.status,
  };
}

describe('dashboard-network-trace-fetch', () => {
  it('normalizeDashboardBaseUrl trims trailing slashes', () => {
    expect(normalizeDashboardBaseUrl(' http://localhost:4000/mockifyer/ ')).toBe(
      'http://localhost:4000/mockifyer'
    );
    expect(normalizeDashboardBaseUrl('')).toBeUndefined();
  });

  it('selectNewDashboardChildHops keeps descendants and skips the parent + duplicates', () => {
    const existing = [
      hop({
        id: 'metro-gql',
        method: 'POST',
        url: 'http://localhost:4000/graphql',
        source: 'upstream',
        requestId: 'gql-1',
      }),
    ];
    const traceEvents = [
      hop({
        id: 'dash-gql',
        method: 'POST',
        url: 'http://localhost:4000/graphql',
        source: 'upstream',
        requestId: 'gql-1',
      }),
      hop({
        id: 'dash-member',
        method: 'GET',
        url: 'https://azurewebsites.net/v-2/myaccount/',
        source: 'upstream',
        requestId: 'member-1',
        parentRequestId: 'gql-1',
      }),
      hop({
        id: 'dash-token',
        method: 'POST',
        url: 'https://azurewebsites.net/api/v1/token',
        source: 'upstream',
        requestId: 'token-1',
        parentRequestId: 'gql-1',
      }),
      hop({
        id: 'dash-deeper',
        method: 'GET',
        url: 'https://azurewebsites.net/v-2/profile',
        source: 'upstream',
        requestId: 'profile-1',
        parentRequestId: 'member-1',
      }),
    ];

    const selected = selectNewDashboardChildHops({
      parentRequestId: 'gql-1',
      existing,
      traceEvents,
    });

    expect(selected.map((e) => e.id).sort()).toEqual([
      'dash-deeper',
      'dash-member',
      'dash-token',
    ]);
  });

  it('selectNewDashboardDescendantHops links children for many parents at once', () => {
    const existing = [
      hop({ id: 'm-a', method: 'POST', url: 'http://localhost:4000/graphql', source: 'upstream', requestId: 'gql-a' }),
      hop({ id: 'm-b', method: 'POST', url: 'http://localhost:4000/graphql', source: 'upstream', requestId: 'gql-b' }),
    ];
    const candidateEvents = [
      hop({ id: 'd-a1', method: 'GET', url: 'https://azurewebsites.net/a1', source: 'upstream', requestId: 'a1', parentRequestId: 'gql-a' }),
      hop({ id: 'd-b1', method: 'GET', url: 'https://azurewebsites.net/b1', source: 'upstream', requestId: 'b1', parentRequestId: 'gql-b' }),
      hop({ id: 'd-orphan', method: 'GET', url: 'https://azurewebsites.net/x', source: 'upstream', requestId: 'x1', parentRequestId: 'unrelated' }),
    ];

    const selected = selectNewDashboardDescendantHops({
      parentRequestIds: ['gql-a', 'gql-b'],
      existing,
      candidateEvents,
    });

    expect(selected.map((e) => e.id).sort()).toEqual(['d-a1', 'd-b1']);
  });

  it('pullDashboardDescendantsForParents issues a single list request', async () => {
    const calls: string[] = [];
    const fetchFn = (async (url: string) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({
          events: [
            hop({ id: 'd-child', method: 'GET', url: 'https://azurewebsites.net/child', source: 'upstream', requestId: 'child-1', parentRequestId: 'gql-1' }),
          ],
        }),
      };
    }) as unknown as typeof fetch;

    const children = await pullDashboardDescendantsForParents({
      dashboardBaseUrl: 'http://localhost:4000/mockifyer',
      parentRequestIds: ['gql-1', 'gql-2', 'gql-3'],
      existing: [hop({ id: 'm-1', method: 'POST', url: 'http://localhost:4000/graphql', source: 'upstream', requestId: 'gql-1' })],
      fetchFn,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/mockifyer/api/network-events?');
    expect(children.map((e) => e.id)).toEqual(['d-child']);
  });

  it('networkTraceToNetworkEvents maps dashboard hops', () => {
    const trace: NetworkRequestTrace = {
      lookup: { by: 'requestId', value: 'gql-1' },
      scenario: 'default',
      rootRequestId: 'gql-1',
      anchorRequestId: 'gql-1',
      anchorEventId: 'e1',
      hopCount: 1,
      incomplete: false,
      hops: [
        {
          index: 0,
          eventId: 'e-child',
          requestId: 'child-1',
          parentRequestId: 'gql-1',
          timestamp: '2026-09-26T12:00:01.000Z',
          method: 'GET',
          url: 'https://azurewebsites.net/v-2/myaccount/',
          status: 200,
          source: 'upstream',
          transport: 'axios',
          response: { status: 200, body: '{"ok":true}' },
        },
      ],
    };

    const events = networkTraceToNetworkEvents(trace);
    expect(events).toHaveLength(1);
    expect(networkTraceHopToNetworkEvent(trace.hops[0], 'default')).toEqual(
      events[0]
    );
    expect(events[0]).toMatchObject({
      id: 'e-child',
      requestId: 'child-1',
      parentRequestId: 'gql-1',
      responseBodyPreview: '{"ok":true}',
      status: 200,
    });
  });
});
