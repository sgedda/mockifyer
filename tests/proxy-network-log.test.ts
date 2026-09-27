import {
  adoptStoredHopIdOnProxyLog,
  applyHopIdentityToProxyLog,
  applyProxyCorrelationToMockData,
  applyUpstreamRequestCorrelationHeaders,
  copyProxyUpstreamHeadersWithoutHopIds,
  resolveCatalogHopIdentity,
  resolveProxyHopIdentity,
  resolveProxyTraceIds,
  readLatestRowForCallerMerge,
  type ProxyNetworkLogContext,
} from '../packages/mockifyer-dashboard/src/utils/proxy-network-log';
import { resetHopOwnerRegistry } from '@sgedda/mockifyer-core';
import type { MockData } from '@sgedda/mockifyer-core';

function mockData(partial: Partial<MockData> = {}): MockData {
  return {
    request: { method: 'GET', url: 'http://svc/v-2/myaccount', headers: {} },
    response: { status: 200, data: {}, headers: {} },
    timestamp: '2026-09-17T00:00:00.000Z',
    ...partial,
  };
}

describe('proxy hop id stability', () => {
  it('keeps stored requestId and updates parent from the live caller', () => {
    const mock = mockData({ requestId: 'stored-hop', parentRequestId: 'stale-parent' });
    applyProxyCorrelationToMockData(
      mock,
      { requestId: 'live-hop', parentRequestId: 'live-parent' } as ProxyNetworkLogContext,
      { requestId: 'inbound-hop', parentRequestId: 'inbound-parent' }
    );
    expect(mock.requestId).toBe('stored-hop');
    expect(mock.parentRequestId).toBe('live-parent');
  });

  it('keeps earlier callers when a pending row is rewritten from scratch', () => {
    const previous = mockData({
      requestId: 'myaccount',
      parentRequestId: 'gql-deferred',
      parentRequestIds: ['gql-deferred'],
    });
    const rewritten = mockData();
    applyProxyCorrelationToMockData(
      rewritten,
      { requestId: 'myaccount', parentRequestId: 'gql-extras' } as ProxyNetworkLogContext,
      undefined,
      undefined,
      previous
    );
    expect(rewritten.parentRequestId).toBe('gql-extras');
    expect(rewritten.parentRequestIds).toEqual(['gql-deferred', 'gql-extras']);
  });

  it('keeps a caller added by a concurrent call while this one was upstream', async () => {
    const rows = new Map<string, MockData>();
    const store = { getByHashInScenario: async (hash: string) => rows.get(hash) ?? null };
    const readAtStart = mockData({ requestId: 'myaccount', parentRequestIds: ['gql-account'] });
    rows.set('h', readAtStart);

    // Another GraphQL operation's call to the same request finished first.
    rows.set('h', mockData({ requestId: 'myaccount', parentRequestIds: ['gql-account', 'gql-upcoming'] }));

    const rewritten = mockData();
    applyProxyCorrelationToMockData(
      rewritten,
      { requestId: 'myaccount', parentRequestId: 'gql-previous' } as ProxyNetworkLogContext,
      undefined,
      undefined,
      await readLatestRowForCallerMerge(store, 'h', 'default', readAtStart)
    );
    expect(rewritten.parentRequestIds).toEqual(['gql-account', 'gql-upcoming', 'gql-previous']);

    const failing = { getByHashInScenario: async () => Promise.reject(new Error('redis down')) };
    await expect(readLatestRowForCallerMerge(failing, 'h', 'default', readAtStart)).resolves.toBe(readAtStart);
  });

  it('fills hop ids only when the mock has none', () => {
    const mock = mockData();
    applyProxyCorrelationToMockData(mock, {
      requestId: 'live-hop',
      parentRequestId: 'live-parent',
    } as ProxyNetworkLogContext);
    expect(mock.requestId).toBe('live-hop');
    expect(mock.parentRequestId).toBe('live-parent');
  });

  it('repairs a stored requestId that equals the live parent (stolen caller id)', () => {
    const mock = mockData({ requestId: 'gql-1', parentRequestId: 'stale' });
    applyProxyCorrelationToMockData(mock, {
      requestId: 'acct-new',
      parentRequestId: 'gql-1',
    } as ProxyNetworkLogContext);
    expect(mock.requestId).toBe('acct-new');
    expect(mock.parentRequestId).toBe('gql-1');
  });

  it('stamps elapsed proxy time as duration for slowest-leaf stats', () => {
    jest.useFakeTimers();
    jest.setSystemTime(1_700_000_000_000);
    const mock = mockData();
    applyProxyCorrelationToMockData(mock, {
      requestId: 'live-hop',
      startedAt: 1_700_000_000_000 - 412,
    } as ProxyNetworkLogContext);
    expect(mock.duration).toBe(412);
    jest.useRealTimers();
  });

  it('adopts the stored hop id onto the proxy log so upstream keeps the same parent', () => {
    const ctx = { requestId: 'live-hop', parentRequestId: 'parent-hop' } as ProxyNetworkLogContext;
    adoptStoredHopIdOnProxyLog(ctx, mockData({ requestId: 'stored-hop' }));
    expect(ctx.requestId).toBe('stored-hop');
    expect(ctx.parentRequestId).toBe('parent-hop');

    const headers = new Headers();
    applyUpstreamRequestCorrelationHeaders(headers, ctx);
    expect(headers.get('x-mockifyer-request-id')).toBe('stored-hop');
    expect(headers.get('x-mockifyer-parent-request-id')).toBe('parent-hop');
  });

  it('does not let a fresh client mint overwrite the adopted GraphQL hop id on upstream', () => {
    const clientHeaders = {
      'content-type': 'application/json',
      'x-mockifyer-request-id': 'fresh-client-mint',
      'x-mockifyer-parent-request-id': 'should-not-leak',
      authorization: 'Bearer tok',
    };
    const upstream = new Headers();
    copyProxyUpstreamHeadersWithoutHopIds(upstream, clientHeaders);
    // buildProxyUpstreamBodyInit used to re-merge the full client bag after hop identity —
    // that overwrote the adopted stored id and orphaned downstream parentRequestId links.
    copyProxyUpstreamHeadersWithoutHopIds(upstream, clientHeaders);
    applyUpstreamRequestCorrelationHeaders(upstream, {
      requestId: 'stored-graphql-hop',
      parentRequestId: null,
    });

    expect(upstream.get('x-mockifyer-request-id')).toBe('stored-graphql-hop');
    expect(upstream.get('x-mockifyer-parent-request-id')).toBeNull();
    expect(upstream.get('content-type')).toBe('application/json');
    expect(upstream.get('authorization')).toBe('Bearer tok');
  });

  it('strips hop-by-hop and content-length so a rebuilt body cannot mismatch', () => {
    const clientHeaders = {
      'content-type': 'application/json',
      'content-length': '12',
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      authorization: 'Bearer tok',
    };
    const upstream = new Headers();
    copyProxyUpstreamHeadersWithoutHopIds(upstream, clientHeaders);

    expect(upstream.get('content-type')).toBe('application/json');
    expect(upstream.get('authorization')).toBe('Bearer tok');
    expect(upstream.get('content-length')).toBeNull();
    expect(upstream.get('connection')).toBeNull();
    expect(upstream.get('transfer-encoding')).toBeNull();
  });

  it('does not forward empty header values from GraphQL login', () => {
    const clientHeaders = {
      'content-type': 'application/json',
      authorization: '',
      impersonatekey: '',
      'nltg-api-key': 'test-key',
    };
    const upstream = new Headers();
    copyProxyUpstreamHeadersWithoutHopIds(upstream, clientHeaders);

    expect(upstream.get('content-type')).toBe('application/json');
    expect(upstream.get('nltg-api-key')).toBe('test-key');
    expect(upstream.get('authorization')).toBeNull();
    expect(upstream.get('impersonatekey')).toBeNull();
  });

  it('treats a reused inbound hop id as the parent of a different endpoint', () => {
    resetHopOwnerRegistry();
    const graphqlInbound = { requestId: 'gql-1', parentRequestId: null };
    const graphqlHop = resolveProxyHopIdentity(
      graphqlInbound,
      'POST',
      'http://localhost:4000/graphql'
    );
    expect(graphqlHop.requestId).toBe('gql-1');

    const child = resolveProxyHopIdentity(
      { requestId: 'gql-1', parentRequestId: null },
      'GET',
      'https://capi.example/v-2/myaccount/',
      'acct-stored'
    );
    expect(child).toEqual({ requestId: 'acct-stored', parentRequestId: 'gql-1' });
  });
});

describe('healed inbound parent (catalog vs live)', () => {
  const live = { requestId: 'crm-hop', parentRequestId: 'member-live' };

  it('keeps the live parent when heal is a no-op', () => {
    expect(resolveCatalogHopIdentity(live, undefined)).toBe(live);
    expect(resolveCatalogHopIdentity(live, 'member-live')).toBe(live);
    expect(resolveCatalogHopIdentity({ requestId: 'root' }, 'recorded')).toEqual({
      requestId: 'root',
    });
  });

  it('points only the catalog at the recorded parent row', () => {
    const catalog = resolveCatalogHopIdentity(live, 'member-recorded');
    expect(catalog).toEqual({ requestId: 'crm-hop', parentRequestId: 'member-recorded' });
    expect(live.parentRequestId).toBe('member-live');
  });

  it('stores the healed parent on the mock while the log and upstream keep the live one', () => {
    const ctx = { requestId: 'crm-hop', parentRequestId: null } as ProxyNetworkLogContext;
    applyHopIdentityToProxyLog(ctx, live);
    const catalog = resolveCatalogHopIdentity(live, 'member-recorded');

    const mock = mockData();
    applyProxyCorrelationToMockData(mock, ctx, live, catalog);
    expect(mock.requestId).toBe('crm-hop');
    expect(mock.parentRequestId).toBe('member-recorded');

    expect(resolveProxyTraceIds(ctx, live)).toEqual({
      requestId: 'crm-hop',
      parentRequestId: 'member-live',
    });
    const upstream = new Headers();
    applyUpstreamRequestCorrelationHeaders(upstream, ctx);
    expect(upstream.get('x-mockifyer-parent-request-id')).toBe('member-live');
  });
});
