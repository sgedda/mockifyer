import { NETWORK_LOG_STORE_MAX_EVENT_BYTES } from '@sgedda/mockifyer-core';
import {
  createNetworkLogStore,
  payloadsForRedisRpushNewestFirst,
} from '../packages/mockifyer-dashboard/src/utils/network-log-store';
import { createSharedStoreCache } from '../packages/mockifyer-dashboard/src/utils/shared-store-cache';
import type { DashboardContextConfig } from '../packages/mockifyer-dashboard/src/utils/dashboard-context';

const fsConfig: DashboardContextConfig = { provider: 'filesystem' };

describe('shared-store-cache', () => {
  function fakeStore() {
    const dispose = jest.fn(async () => undefined);
    return { store: { close: dispose }, dispose };
  }

  it('reuses one store per key and keeps it open across route close()', async () => {
    const cache = createSharedStoreCache<{ close(): Promise<void> }>();
    const { store, dispose } = fakeStore();
    const create = jest.fn(() => store);

    const first = cache.getOrCreate('redis:a', create);
    await first.close();
    expect(cache.getOrCreate('redis:a', create)).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();

    await cache.closeAll();
    expect(dispose).toHaveBeenCalledTimes(1);
    const { store: next } = fakeStore();
    expect(cache.getOrCreate('redis:a', () => next)).toBe(next);
  });
});

describe('redis network-log list order', () => {
  it('keeps newest hops at index 0 when restoring after a lane clear', () => {
    const keptNewestFirst = ['newest', 'middle', 'oldest'];
    const restored: string[] = [];
    for (const line of payloadsForRedisRpushNewestFirst(keptNewestFirst)) {
      restored.push(line);
    }
    expect(restored).toEqual(keptNewestFirst);
    expect(restored.slice(0, 1)).toEqual(['newest']);
  });
});

describe('network-log-store (memory)', () => {
  it('append and list events in LIFO order', async () => {
    const store = createNetworkLogStore(fsConfig);
    const scenario = `test-ring-${Date.now()}`;
    await store.append(scenario, {
      transport: 'proxy',
      method: 'GET',
      url: 'https://a.example/one?api_key=secret&page=1',
      source: 'mock-hit',
      status: 200,
    });
    await store.append(scenario, {
      transport: 'proxy',
      method: 'POST',
      url: 'https://a.example/two',
      source: 'upstream',
      status: 201,
      requestHeaders: { authorization: 'Bearer live-token', accept: 'application/json' },
    });
    const { events } = await store.list({ scenario, limit: 10 });
    expect(events).toHaveLength(2);
    expect(events[0].method).toBe('POST');
    expect(events[0].requestHeaders?.authorization).toBe('Bearer live-token');
    expect(events[1].method).toBe('GET');
    expect(decodeURIComponent(events[1].url)).toContain('api_key=[REDACTED]');
    expect(events[1].url).not.toContain('secret');
    expect(events[1].url).toContain('page=1');
    await store.clear({ scenario });
    await store.close();
  });

  it('respects enabled=false', async () => {
    const store = createNetworkLogStore(fsConfig);
    const scenario = `test-disabled-${Date.now()}`;
    await store.setConfig(scenario, { enabled: false });
    const saved = await store.append(scenario, {
      transport: 'fetch',
      method: 'GET',
      url: 'https://b.example/x',
      source: 'upstream',
    });
    expect(saved).toBeNull();
    const { events } = await store.list({ scenario });
    expect(events).toHaveLength(0);
    await store.clear({ scenario });
    await store.close();
  });

  it('filters by clientId on clear and list', async () => {
    const store = createNetworkLogStore(fsConfig);
    const scenario = `test-lane-${Date.now()}`;
    await store.append(scenario, {
      transport: 'proxy',
      method: 'GET',
      url: 'https://c.example/a',
      source: 'mock-hit',
      clientId: 'lane-a',
    });
    await store.append(scenario, {
      transport: 'proxy',
      method: 'GET',
      url: 'https://c.example/b',
      source: 'mock-hit',
      clientId: 'lane-b',
    });
    const laneA = await store.list({ scenario, clientId: 'lane-a' });
    expect(laneA.events).toHaveLength(1);
    expect(laneA.events[0].clientId).toBe('lane-a');
    await store.clear({ scenario, clientId: 'lane-a' });
    const remaining = await store.list({ scenario });
    expect(remaining.events).toHaveLength(1);
    expect(remaining.events[0].clientId).toBe('lane-b');
    await store.clear({ scenario });
    await store.close();
  });

  it('caps stored body previews but keeps request header values intact', async () => {
    const store = createNetworkLogStore(fsConfig);
    const scenario = `test-cap-${Date.now()}`;
    const saved = await store.append(scenario, {
      transport: 'proxy',
      method: 'POST',
      url: 'https://a.example/token',
      source: 'upstream',
      status: 200,
      requestHeaders: {
        authorization: `Token ${'a'.repeat(20_000)}`,
        accept: 'application/json',
      },
      requestBodyPreview: 'x'.repeat(200_000),
      responseBodyPreview: 'y'.repeat(200_000),
    });
    expect(saved).not.toBeNull();
    expect(saved?.requestHeaders?.accept).toBe('application/json');
    expect(saved?.requestHeaders?.authorization).toBe(`Token ${'a'.repeat(20_000)}`);
    expect((saved?.requestBodyPreview ?? '').length).toBeLessThan(
      NETWORK_LOG_STORE_MAX_EVENT_BYTES
    );
    expect((saved?.responseBodyPreview ?? '').length).toBeLessThan(20_000);
    await store.clear({ scenario });
    await store.close();
  });

  it('stores response bodies only when captureBodies is on; keeps the request body', async () => {
    const store = createNetworkLogStore(fsConfig);
    const scenario = `test-resp-${Date.now()}`;
    const hop = {
      transport: 'proxy' as const,
      method: 'POST',
      url: 'https://a.example/graphql',
      source: 'mock-hit' as const,
      status: 200,
      requestBodyPreview: '{"query":"{ me }"}',
      responseBodyPreview: '{"data":{"me":1}}',
    };
    const off = await store.append(scenario, hop);
    expect(off?.requestBodyPreview).toContain('me');
    // Filesystem provider preserves response bodies even when captureBodies is false,
    // since it can't recover them from disk like Redis/SQLite can
    expect(off?.responseBodyPreview).toContain('"me"');

    await store.setConfig(scenario, { captureBodies: true });
    const on = await store.append(scenario, hop);
    expect(on?.responseBodyPreview).toContain('"me"');
    await store.clear({ scenario });
    await store.close();
  });

  it('drops oldest hops once the scenario list exceeds its byte budget', async () => {
    const previous = process.env.MOCKIFYER_NETWORK_LOG_MAX_LIST_BYTES;
    process.env.MOCKIFYER_NETWORK_LOG_MAX_LIST_BYTES = '2500';
    const store = createNetworkLogStore(fsConfig);
    const scenario = `test-budget-${Date.now()}`;
    try {
      for (let i = 0; i < 6; i++) {
        await store.append(scenario, {
          transport: 'proxy',
          method: 'GET',
          url: `https://a.example/hop/${i}`,
          source: 'upstream',
          status: 200,
          requestBodyPreview: 'z'.repeat(800),
        });
      }
      const { events } = await store.list({ scenario, limit: 20 });
      expect(events.length).toBeGreaterThan(0);
      expect(events.length).toBeLessThan(6);
      expect(events[0].url).toContain('/hop/5');
    } finally {
      if (previous === undefined) {
        delete process.env.MOCKIFYER_NETWORK_LOG_MAX_LIST_BYTES;
      } else {
        process.env.MOCKIFYER_NETWORK_LOG_MAX_LIST_BYTES = previous;
      }
      await store.clear({ scenario });
      await store.close();
    }
  });
});
