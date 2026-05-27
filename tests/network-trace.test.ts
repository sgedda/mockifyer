import {
  buildNetworkEventChainMaps,
  resolveNetworkRequestTrace,
  type NetworkEvent,
} from '@sgedda/mockifyer-core';

function event(partial: Partial<NetworkEvent> & Pick<NetworkEvent, 'id' | 'method' | 'url' | 'source'>): NetworkEvent {
  return {
    timestamp: partial.timestamp ?? '2026-01-01T12:00:00.000Z',
    scenario: 'default',
    transport: 'proxy',
    ...partial,
  };
}

describe('network-trace', () => {
  const gateway = event({
    id: 'ev-gateway',
    requestId: 'req-gateway',
    method: 'GET',
    url: 'http://gateway:3000/aggregate',
    source: 'mock-hit',
    status: 200,
    responseBodyPreview: '{"items":[]}',
  });

  const catalog = event({
    id: 'ev-catalog',
    requestId: 'req-catalog',
    parentRequestId: 'req-gateway',
    timestamp: '2026-01-01T12:00:01.000Z',
    method: 'GET',
    url: 'http://catalog:3001/product/1',
    source: 'upstream',
    status: 200,
    responseBodyPreview: '{"id":1,"name":"Widget"}',
  });

  const external = event({
    id: 'ev-external',
    requestId: 'req-external',
    parentRequestId: 'req-catalog',
    timestamp: '2026-01-01T12:00:02.000Z',
    method: 'GET',
    url: 'https://api.example/data',
    source: 'mock-hit',
    status: 200,
    responseBodyPreview: '{"raw":true}',
  });

  it('builds root-first chain from requestId', () => {
    const trace = resolveNetworkRequestTrace([external, catalog, gateway], {
      by: 'requestId',
      value: 'req-catalog',
      scenario: 'default',
    });
    expect(trace).not.toBeNull();
    expect(trace!.hopCount).toBe(3);
    expect(trace!.hops.map((h) => h.requestId)).toEqual(['req-gateway', 'req-catalog', 'req-external']);
    expect(trace!.hops[1].response?.body).toBe('{"id":1,"name":"Widget"}');
    expect(trace!.rootRequestId).toBe('req-gateway');
    expect(trace!.anchorRequestId).toBe('req-catalog');
  });

  it('resolves by eventId and marks incomplete when parent missing', () => {
    const trace = resolveNetworkRequestTrace([catalog], {
      by: 'eventId',
      value: 'ev-catalog',
      scenario: 'default',
    });
    expect(trace!.hopCount).toBe(1);
    expect(trace!.incomplete).toBe(true);
  });

  it('collects sibling downstream hops in timestamp order', () => {
    const childB = event({
      id: 'ev-b',
      requestId: 'req-b',
      parentRequestId: 'req-gateway',
      timestamp: '2026-01-01T12:00:03.000Z',
      method: 'GET',
      url: 'http://catalog:3001/product/2',
      source: 'mock-hit',
    });
    const maps = buildNetworkEventChainMaps([gateway, catalog, childB]);
    expect(maps.childrenByParent.get('req-gateway')).toHaveLength(2);
    const trace = resolveNetworkRequestTrace([gateway, catalog, childB], {
      by: 'requestId',
      value: 'req-gateway',
      scenario: 'default',
    });
    expect(trace!.hopCount).toBe(3);
    expect(trace!.hops[0].requestId).toBe('req-gateway');
  });

  it('returns null when key is unknown', () => {
    expect(
      resolveNetworkRequestTrace([gateway], {
        by: 'requestId',
        value: 'missing',
        scenario: 'default',
      })
    ).toBeNull();
  });

  it('resolves full downstream chain from virtual root trace id (parent only)', () => {
    const clientRoot = 'client-trace-root';
    const gatewayHop = event({
      id: 'ev-gw-out',
      requestId: 'req-gateway-out',
      parentRequestId: clientRoot,
      method: 'GET',
      url: 'http://relay:4103/via-axios',
      source: 'upstream',
    });
    const catalogHop = event({
      id: 'ev-catalog-out',
      requestId: 'req-catalog',
      parentRequestId: 'req-gateway-out',
      timestamp: '2026-01-01T12:00:01.000Z',
      method: 'GET',
      url: 'http://catalog:4102/product/1',
      source: 'mock-hit',
      responseBodyPreview: '{"id":1}',
    });

    const trace = resolveNetworkRequestTrace([catalogHop, gatewayHop], {
      by: 'requestId',
      value: clientRoot,
      scenario: 'default',
    });

    expect(trace).not.toBeNull();
    expect(trace!.rootRequestId).toBe(clientRoot);
    expect(trace!.hopCount).toBe(2);
    expect(trace!.hops.map((h) => h.requestId)).toEqual(['req-gateway-out', 'req-catalog']);
    expect(trace!.hops[1].response?.body).toBe('{"id":1}');
  });
});
