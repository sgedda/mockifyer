import { createNetworkLogStore } from '../packages/mockifyer-dashboard/src/utils/network-log-store';
import type { DashboardContextConfig } from '../packages/mockifyer-dashboard/src/utils/dashboard-context';

const fsConfig: DashboardContextConfig = { provider: 'filesystem' };

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
    });
    const { events } = await store.list({ scenario, limit: 10 });
    expect(events).toHaveLength(2);
    expect(events[0].method).toBe('POST');
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
});
