import type { MockData } from '@sgedda/mockifyer-core';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';
import type { MockKvBackend } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { parseSearchQuery } from '../packages/mockifyer-dashboard/src/utils/mock-search';

function mockPayload(url: string, extra: Record<string, unknown> = {}): MockData {
  return {
    request: {
      method: 'GET',
      url,
      headers: {},
      queryParams: {},
    },
    response: {
      status: 200,
      data: extra,
      headers: {},
    },
    timestamp: '2026-01-01T00:00:00.000Z',
  };
}

function searchKv(input: {
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
    srem: async () => undefined,
  } as unknown as MockKvBackend;
}

describe('RedisMockStore.search', () => {
  it('MGETs in chunks, parses only matches, and stops after limit', async () => {
    const scenario = 'default';
    const hashes = Array.from({ length: 80 }, (_, i) => `hash-${i}`);
    const values = new Map<string, string>();
    for (const hash of hashes) {
      values.set(
        `mockifyer:v1:mock:${scenario}:${hash}`,
        JSON.stringify(mockPayload('https://api.example.com/noise'))
      );
    }
    values.set(
      `mockifyer:v1:mock:${scenario}:hash-0`,
      JSON.stringify(mockPayload('https://api.example.com/items', { needle: 'unique-search-hit' }))
    );

    const mgetCalls: string[][] = [];
    const store = new RedisMockStore({
      kv: searchKv({
        hashes,
        values,
        onMget: (keys) => mgetCalls.push(keys),
      }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const result = await store.search(scenario, parseSearchQuery('unique-search-hit'), 1);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].hash).toBe('hash-0');
    expect(result.truncated).toBe(true);
    expect(mgetCalls).toHaveLength(1);
    expect(mgetCalls[0]).toHaveLength(32);
  });

  it('requires every token to match', async () => {
    const scenario = 'default';
    const hashes = ['a', 'b'];
    const values = new Map<string, string>([
      [
        `mockifyer:v1:mock:${scenario}:a`,
        JSON.stringify(mockPayload('https://api.example.com/users', { role: 'admin' })),
      ],
      [
        `mockifyer:v1:mock:${scenario}:b`,
        JSON.stringify(mockPayload('https://api.example.com/users', { role: 'guest' })),
      ],
    ]);
    const store = new RedisMockStore({
      kv: searchKv({ hashes, values, onMget: () => undefined }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const both = await store.search(scenario, parseSearchQuery('users admin'), 10);
    expect(both.items.map((item) => item.hash)).toEqual(['a']);

    const either = await store.search(scenario, parseSearchQuery('users'), 10);
    expect(either.items).toHaveLength(2);
    expect(either.truncated).toBe(false);
  });
});
