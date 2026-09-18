import {
  adoptStoredHopIdOnProxyLog,
  applyProxyCorrelationToMockData,
  applyUpstreamRequestCorrelationHeaders,
  type ProxyNetworkLogContext,
} from '../packages/mockifyer-dashboard/src/utils/proxy-network-log';
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

  it('fills hop ids only when the mock has none', () => {
    const mock = mockData();
    applyProxyCorrelationToMockData(mock, {
      requestId: 'live-hop',
      parentRequestId: 'live-parent',
    } as ProxyNetworkLogContext);
    expect(mock.requestId).toBe('live-hop');
    expect(mock.parentRequestId).toBe('live-parent');
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
});
