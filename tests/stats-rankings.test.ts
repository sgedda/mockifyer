import {
  annotateLeafHops,
  countReplayModes,
  leafResponses,
  rankLargestResponses,
  rankSlowestResponses,
  readMockDurationMs,
  statsTrafficMode,
  toRankedResponseStat,
} from '../packages/mockifyer-dashboard/src/utils/stats-rankings';
import type { MockData } from '@sgedda/mockifyer-core';

function mock(partial: {
  url?: string;
  method?: string;
  duration?: number;
  responseTime?: number;
  operationName?: string;
  requestId?: string;
  parentRequestId?: string;
  alwaysUseRealApi?: boolean;
  responsePending?: boolean;
  alwaysRefreshFromLive?: boolean;
  refreshOnNextRequest?: boolean;
}): MockData {
  return {
    request: {
      url: partial.url ?? 'https://api.example.com/graphql',
      method: partial.method ?? 'POST',
      headers: {},
      data: partial.operationName ? { operationName: partial.operationName } : undefined,
    },
    response: { status: 200, data: null, headers: {} },
    timestamp: '2026-01-01T00:00:00.000Z',
    duration: partial.duration,
    requestId: partial.requestId,
    parentRequestId: partial.parentRequestId,
    alwaysUseRealApi: partial.alwaysUseRealApi,
    responsePending: partial.responsePending,
    alwaysRefreshFromLive: partial.alwaysRefreshFromLive,
    refreshOnNextRequest: partial.refreshOnNextRequest,
    ...(partial.responseTime != null ? { responseTime: partial.responseTime } : {}),
  } as MockData;
}

describe('stats rankings', () => {
  it('prefers duration over legacy responseTime', () => {
    expect(readMockDurationMs(mock({ duration: 40, responseTime: 90 }))).toBe(40);
    expect(readMockDurationMs(mock({ responseTime: 90 }))).toBe(90);
    expect(readMockDurationMs(mock({ duration: 0 }))).toBeUndefined();
  });

  it('ranks slowest and largest responses', () => {
    const items = [
      toRankedResponseStat({ filename: 'a.json', mockData: mock({ duration: 10, url: '/a' }), size: 500 }),
      toRankedResponseStat({
        filename: 'b.json',
        mockData: mock({ duration: 400, url: '/b', operationName: 'SlowOp' }),
        size: 50,
      }),
      toRankedResponseStat({ filename: 'c.json', mockData: mock({ url: '/c' }), size: 900 }),
    ];

    const slowest = rankSlowestResponses(items, 2);
    expect(slowest.map((row) => row.filename)).toEqual(['b.json', 'a.json']);
    expect(slowest[0].operationName).toBe('SlowOp');
    expect(slowest[0].durationMs).toBe(400);

    const largest = rankLargestResponses(items, 2);
    expect(largest.map((row) => row.filename)).toEqual(['c.json', 'a.json']);
    expect(largest[0].size).toBe(900);
  });

  it('treats hops with children as parents and ranks leaf hops for time and size', () => {
    const items = [
      toRankedResponseStat({
        filename: 'parent.json',
        mockData: mock({
          duration: 900,
          url: '/graphql',
          operationName: 'Entry',
          requestId: 'root-1',
        }),
        size: 80_000,
      }),
      toRankedResponseStat({
        filename: 'leaf-slow.json',
        mockData: mock({
          duration: 400,
          url: '/booking',
          requestId: 'leaf-1',
          parentRequestId: 'root-1',
        }),
        size: 1_200,
      }),
      toRankedResponseStat({
        filename: 'leaf-big.json',
        mockData: mock({
          duration: 50,
          url: '/catalog',
          requestId: 'leaf-2',
          parentRequestId: 'root-1',
        }),
        size: 9_000,
      }),
    ];

    const annotated = annotateLeafHops(items);
    expect(annotated.find((row) => row.filename === 'parent.json')?.isLeaf).toBe(false);
    expect(annotated.find((row) => row.filename === 'leaf-slow.json')?.isLeaf).toBe(true);

    const leaves = leafResponses(items);
    expect(rankSlowestResponses(leaves, 5).map((row) => row.filename)).toEqual([
      'leaf-slow.json',
      'leaf-big.json',
    ]);
    expect(rankLargestResponses(leaves, 5).map((row) => row.filename)).toEqual([
      'leaf-big.json',
      'leaf-slow.json',
    ]);
  });

  it('counts replay modes with pending winning over live flags', () => {
    expect(statsTrafficMode(mock({}))).toBe('replay');
    expect(statsTrafficMode(mock({ alwaysUseRealApi: true }))).toBe('live');
    expect(statsTrafficMode(mock({ responsePending: true }))).toBe('pending');
    expect(statsTrafficMode(mock({ alwaysRefreshFromLive: true }))).toBe('refresh');
    expect(statsTrafficMode(mock({ refreshOnNextRequest: true }))).toBe('refresh');
    expect(statsTrafficMode(mock({ alwaysUseRealApi: true, responsePending: true }))).toBe(
      'pending'
    );

    expect(
      countReplayModes([
        mock({}),
        mock({ alwaysUseRealApi: true }),
        mock({ responsePending: true }),
        mock({ alwaysRefreshFromLive: true }),
        mock({ refreshOnNextRequest: true }),
      ])
    ).toEqual({
      replay: 1,
      live: 1,
      pending: 1,
      refresh: 2,
    });
  });
});
