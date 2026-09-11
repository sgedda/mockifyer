import type { MockData } from '@sgedda/mockifyer-core';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';
import type { MockKvBackend } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';

const MOCK_PAYLOAD: MockData = {
  request: {
    method: 'GET',
    url: 'https://api.example.com/items',
    headers: {},
    queryParams: {},
  },
  response: {
    status: 200,
    data: { ok: true },
    headers: {},
  },
  timestamp: '2026-01-01T00:00:00.000Z',
};

const MOCK_JSON = JSON.stringify(MOCK_PAYLOAD);

function listOnlyKv(input: {
  hashes: string[];
  values: Map<string, string>;
  onMget: (keys: string[]) => void;
}): MockKvBackend {
  return {
    smembers: async () => input.hashes,
    mget: async (keys: string[]) => {
      input.onMget(keys);
      return keys.map((key) => input.values.get(key) ?? null);
    },
  } as unknown as MockKvBackend;
}

describe('RedisMockStore.list', () => {
  it('passes the full key list as one array instead of spreading into mget', async () => {
    const scenario = 'default';
    const hashes = Array.from({ length: 2500 }, (_, i) => `hash-${i}`);
    const values = new Map<string, string>();
    for (const hash of hashes) {
      values.set(`mockifyer:v1:mock:${scenario}:${hash}`, MOCK_JSON);
    }
    const mgetCalls: string[][] = [];
    const store = new RedisMockStore({
      kv: listOnlyKv({
        hashes,
        values,
        onMget: (keys) => mgetCalls.push(keys),
      }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const items = await store.list(scenario);

    expect(items).toHaveLength(2500);
    expect(items[0].hash).toBe('hash-0');
    expect(items[2499].mockData.response.status).toBe(200);
    expect(mgetCalls).toHaveLength(1);
    expect(mgetCalls[0]).toHaveLength(2500);
    expect(Array.isArray(mgetCalls[0])).toBe(true);
  });

  it('lists a very large Redis index without overflowing the call stack', async () => {
    const scenario = 'default';
    const count = 80_000;
    const hashes = Array.from({ length: count }, (_, i) => `h${i}`);
    const values = new Map<string, string>();
    for (const hash of hashes) {
      values.set(`mockifyer:v1:mock:${scenario}:${hash}`, MOCK_JSON);
    }
    const store = new RedisMockStore({
      kv: listOnlyKv({
        hashes,
        values,
        onMget: () => undefined,
      }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const items = await store.list(scenario);
    expect(items).toHaveLength(count);
    expect(items[count - 1].hash).toBe(`h${count - 1}`);
  });
});

describe('RedisMockStore.listWithOverrides', () => {
  function overrideKv(input: {
    hashes: string[];
    values: Map<string, string>;
    fullGets: string[];
  }): MockKvBackend {
    const sets = new Map<string, Set<string>>();
    const kvStrings = new Map<string, string>();
    return {
      smembers: async (key: string) => {
        if (key.includes(':override_index:') && !key.includes(':override_index_ready:')) {
          return [...(sets.get(key) ?? [])];
        }
        return input.hashes;
      },
      mget: async (keys: string[]) => keys.map((key) => input.values.get(key) ?? null),
      get: async (key: string) => {
        if (kvStrings.has(key)) return kvStrings.get(key) ?? null;
        if (key.includes(':mock:')) input.fullGets.push(key);
        return input.values.get(key) ?? null;
      },
      set: async (key: string, value: string) => {
        kvStrings.set(key, value);
      },
      sadd: async (key: string, ...members: string[]) => {
        const set = sets.get(key) ?? new Set<string>();
        for (const m of members) set.add(m);
        sets.set(key, set);
      },
      srem: async () => undefined,
      getrange: async (key: string, start: number, end: number) => {
        const raw = input.values.get(key);
        if (!raw) return '';
        const from = start < 0 ? Math.max(0, raw.length + start) : start;
        const to = end < 0 ? raw.length + end + 1 : end + 1;
        return raw.slice(from, to);
      },
    } as unknown as MockKvBackend;
  }

  it('does not pull full bodies for mocks without overlay keys', async () => {
    const scenario = 'default';
    const huge = JSON.stringify({
      ...MOCK_PAYLOAD,
      response: { status: 200, data: { bookings: 'x'.repeat(50_000) }, headers: {} },
    });
    const withOverride = JSON.stringify({
      ...MOCK_PAYLOAD,
      responseFieldOverrides: [{ path: 'status', value: 'CLOSED' }],
    });
    const hashes = ['plain', 'overridden'];
    const values = new Map<string, string>([
      [`mockifyer:v1:mock:${scenario}:plain`, huge],
      [`mockifyer:v1:mock:${scenario}:overridden`, withOverride],
    ]);
    const fullGets: string[] = [];
    const store = new RedisMockStore({
      kv: overrideKv({ hashes, values, fullGets }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const items = await store.listWithOverrides(scenario);
    expect(items).toHaveLength(1);
    expect(items[0].hash).toBe('overridden');
    expect(fullGets).toEqual([`mockifyer:v1:mock:${scenario}:overridden`]);

    fullGets.length = 0;
    const second = await store.listWithOverrides(scenario);
    expect(second).toHaveLength(1);
    expect(fullGets).toHaveLength(0);
  });
});
