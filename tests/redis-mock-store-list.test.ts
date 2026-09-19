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
  onSrem?: (key: string, members: string[]) => void;
}): MockKvBackend {
  return {
    smembers: async () => input.hashes,
    mget: async (keys: string[]) => {
      input.onMget(keys);
      return keys.map((key) => input.values.get(key) ?? null);
    },
    srem: async (key: string, ...members: string[]) => {
      input.onSrem?.(key, members);
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

  it('returns only live mocks and prunes missing index hashes', async () => {
    const scenario = 'different-kind-of-trips';
    const liveHash = 'a'.repeat(64);
    const ghostHash = 'b'.repeat(64);
    const values = new Map<string, string>([
      [`mockifyer:v1:mock:${scenario}:${liveHash}`, MOCK_JSON],
    ]);
    const sremCalls: Array<{ key: string; members: string[] }> = [];
    const store = new RedisMockStore({
      kv: listOnlyKv({
        hashes: [liveHash, ghostHash],
        values,
        onMget: () => undefined,
        onSrem: (key, members) => sremCalls.push({ key, members }),
      }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const items = await store.list(scenario);
    expect(items).toHaveLength(1);
    expect(items[0].hash).toBe(liveHash);

    await new Promise((resolve) => setImmediate(resolve));
    expect(sremCalls.length).toBeGreaterThan(0);
    expect(sremCalls[0].key).toBe(`mockifyer:v1:index:${scenario}`);
    expect(sremCalls[0].members).toEqual([ghostHash]);
  });

  it('clearAllMocksInScenario deletes mock keys, ghost index members, and path indexes', async () => {
    const scenario = 'different-kind-of-trips';
    const liveHash = 'c'.repeat(64);
    const ghostHash = 'd'.repeat(64);
    const deleted: string[] = [];
    const pathIndexKey = `mockifyer:v1:path_index:${scenario}:abc`;
    const store = new RedisMockStore({
      kv: {
        smembers: async () => [liveHash, ghostHash],
        scanKeys: async () => [pathIndexKey],
        del: async (...keys: string[]) => {
          deleted.push(...keys);
        },
        sadd: async () => undefined,
      } as unknown as MockKvBackend,
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const removed = await store.clearAllMocksInScenario(scenario);
    expect(removed).toBe(2);
    expect(deleted).toContain(`mockifyer:v1:mock:${scenario}:${liveHash}`);
    expect(deleted).toContain(`mockifyer:v1:mock:${scenario}:${ghostHash}`);
    expect(deleted).toContain(`mockifyer:v1:index:${scenario}`);
    expect(deleted).toContain(`mockifyer:v1:list_catalog:${scenario}`);
    expect(deleted).toContain(pathIndexKey);
    expect(deleted).not.toContain(`mockifyer:v1:date_config:${scenario}`);
  });

  it('deleteEntireScenario removes mocks, metadata, and registry membership', async () => {
    const scenario = 'staging';
    const liveHash = 'e'.repeat(64);
    const deleted: string[] = [];
    const sremCalls: Array<{ key: string; members: string[] }> = [];
    const store = new RedisMockStore({
      kv: {
        smembers: async (key: string) => {
          if (key.includes(`:index:${scenario}`)) return [liveHash];
          return [];
        },
        scanKeys: async () => [],
        del: async (...keys: string[]) => {
          deleted.push(...keys);
        },
        sadd: async () => undefined,
        srem: async (key: string, ...members: string[]) => {
          sremCalls.push({ key, members });
        },
        mget: async () => [],
        hget: async () => null,
      } as unknown as MockKvBackend,
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const result = await store.deleteEntireScenario(scenario);
    expect(result.mocksRemoved).toBe(1);
    expect(result.lanesUnassigned).toBe(0);
    expect(deleted).toContain(`mockifyer:v1:mock:${scenario}:${liveHash}`);
    expect(deleted).toContain(`mockifyer:v1:date_config:${scenario}`);
    expect(deleted).toContain(`mockifyer:v1:proxy_config:${scenario}`);
    expect(deleted).toContain(`mockifyer:v1:path_rules:${scenario}`);
    expect(deleted).toContain(`mockifyer:v1:scenario_meta:${scenario}`);
    expect(sremCalls.some((call) => call.key === 'mockifyer:v1:scenarios' && call.members.includes(scenario))).toBe(
      true
    );
  });
});

describe('RedisMockStore.listCatalog', () => {
  it('parses large recordings without keeping response.data and caches the result', async () => {
    const scenario = 'different-kind-of-trips';
    const hash = 'e'.repeat(64);
    const huge = JSON.stringify({
      ...MOCK_PAYLOAD,
      response: { status: 201, data: { bookings: 'z'.repeat(40_000) }, headers: {} },
    });
    const values = new Map<string, string>([[`mockifyer:v1:mock:${scenario}:${hash}`, huge]]);
    const mgetCalls: number[] = [];
    const store = new RedisMockStore({
      kv: catalogKv({
        hashes: [hash],
        values,
        onMget: (keys) => mgetCalls.push(keys.length),
      }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const first = await store.listCatalog(scenario);
    expect(first).toHaveLength(1);
    expect(first[0].mockData.response.status).toBe(201);
    expect(first[0].mockData.response.data).toBeNull();
    expect(first[0].rawByteLength).toBe(Buffer.byteLength(huge));
    expect(mgetCalls).toEqual([1]);

    const second = await store.listCatalog(scenario);
    expect(second[0].hash).toBe(hash);
    expect(mgetCalls).toEqual([1]);
  });

  function catalogKv(input: {
    hashes: string[];
    values: Map<string, string>;
    onMget: (keys: string[]) => void;
  }): MockKvBackend {
    const sets = new Map<string, Set<string>>();
    const hashes = [...input.hashes];
    const hashFields = new Map<string, Map<string, string>>();
    return {
      smembers: async (key: string) => {
        if (key.includes(':index:') && !key.includes('path_index')) return hashes;
        return [...(sets.get(key) ?? [])];
      },
      mget: async (keys: string[]) => {
        input.onMget(keys);
        return keys.map((key) => input.values.get(key) ?? null);
      },
      hgetall: async (key: string) => {
        const fields = hashFields.get(key);
        if (!fields) return {};
        return Object.fromEntries(fields);
      },
      hset: async (key: string, field: string, value: string) => {
        const fields = hashFields.get(key) ?? new Map<string, string>();
        fields.set(field, value);
        hashFields.set(key, fields);
      },
      hsetMany: async (key: string, fields: Record<string, string>) => {
        const existing = hashFields.get(key) ?? new Map<string, string>();
        for (const [field, value] of Object.entries(fields)) {
          existing.set(field, value);
        }
        hashFields.set(key, existing);
      },
      hdel: async (key: string, ...fields: string[]) => {
        const existing = hashFields.get(key);
        if (!existing) return;
        for (const field of fields) existing.delete(field);
      },
      del: async (...keys: string[]) => {
        for (const key of keys) hashFields.delete(key);
      },
      srem: async () => undefined,
      sadd: async () => undefined,
    } as unknown as MockKvBackend;
  }

  it('serves later catalog reads from the Redis sidecar without MGET of bodies', async () => {
    const scenario = 'different-kind-of-trips';
    const hash = 'f'.repeat(64);
    const huge = JSON.stringify({
      ...MOCK_PAYLOAD,
      request: {
        ...MOCK_PAYLOAD.request,
        method: 'POST',
        url: 'https://api.example.com/graphql',
        data: { query: 'query Bookings { bookings { id } }' },
      },
      response: { status: 200, data: { bookings: 'z'.repeat(40_000) }, headers: {} },
    });
    const values = new Map<string, string>([[`mockifyer:v1:mock:${scenario}:${hash}`, huge]]);
    const mgetCalls: number[] = [];
    const kv = catalogKv({
      hashes: [hash],
      values,
      onMget: (keys) => mgetCalls.push(keys.length),
    });

    const firstStore = new RedisMockStore({ kv, mockDataPath: '/tmp/mockifyer-unused' });
    const first = await firstStore.listCatalog(scenario);
    expect(first).toHaveLength(1);
    expect(first[0].mockData.response.data).toBeNull();
    expect((first[0].mockData.request.data as { query: string }).query).toContain('Bookings');
    expect(mgetCalls).toEqual([1]);

    const secondStore = new RedisMockStore({ kv, mockDataPath: '/tmp/mockifyer-unused' });
    const second = await secondStore.listCatalog(scenario);
    expect(second).toHaveLength(1);
    expect(second[0].mockData.response.data).toBeNull();
    expect(second[0].rawByteLength).toBe(Buffer.byteLength(huge));
    expect(mgetCalls).toEqual([1]);
  });

  it('MGETs only hashes missing from the sidecar', async () => {
    const scenario = 'default';
    const cachedHash = 'a'.repeat(64);
    const missingHash = 'b'.repeat(64);
    const cachedPayload = JSON.stringify(MOCK_PAYLOAD);
    const missingPayload = JSON.stringify({
      ...MOCK_PAYLOAD,
      request: { ...MOCK_PAYLOAD.request, url: 'https://api.example.com/new' },
    });
    const values = new Map<string, string>([
      [`mockifyer:v1:mock:${scenario}:${cachedHash}`, cachedPayload],
      [`mockifyer:v1:mock:${scenario}:${missingHash}`, missingPayload],
    ]);
    const mgetKeys: string[][] = [];
    const kv = catalogKv({
      hashes: [cachedHash, missingHash],
      values,
      onMget: (keys) => mgetKeys.push(keys),
    });
    const sidecarKey = `mockifyer:v1:list_catalog:${scenario}`;
    await kv.hset(
      sidecarKey,
      cachedHash,
      JSON.stringify({
        rawByteLength: Buffer.byteLength(cachedPayload),
        mockData: {
          ...MOCK_PAYLOAD,
          response: { status: 200, data: null, headers: {} },
        },
      })
    );

    const store = new RedisMockStore({ kv, mockDataPath: '/tmp/mockifyer-unused' });
    const items = await store.listCatalog(scenario);
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.hash).sort()).toEqual([cachedHash, missingHash].sort());
    expect(mgetKeys).toEqual([[`mockifyer:v1:mock:${scenario}:${missingHash}`]]);
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
