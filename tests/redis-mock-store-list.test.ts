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
