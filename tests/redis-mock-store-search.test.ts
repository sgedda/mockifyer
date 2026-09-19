import type { MockData } from '@sgedda/mockifyer-core';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';
import type { MockKvBackend } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { parseSearchQuery } from '../packages/mockifyer-dashboard/src/utils/mock-search';
import { serializeCatalogSidecarEntry } from '../packages/mockifyer-dashboard/src/utils/mock-json-catalog';

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
  hashFields?: Map<string, Map<string, string>>;
}): MockKvBackend {
  const hashFields = input.hashFields ?? new Map<string, Map<string, string>>();
  return {
    smembers: async () => input.hashes,
    mget: async (keys: string[]) => {
      input.onMget(keys);
      return keys.map((key) => input.values.get(key) ?? null);
    },
    hgetall: async (key: string) => {
      const fields = hashFields.get(key);
      return fields ? Object.fromEntries(fields) : {};
    },
    hset: async (key: string, field: string, value: string) => {
      const fields = hashFields.get(key) ?? new Map<string, string>();
      fields.set(field, value);
      hashFields.set(key, fields);
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
    expect(mgetCalls[0]).toHaveLength(80);
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

  it('matches GraphQL metadata from the catalog HASH without MGET of bodies', async () => {
    const scenario = 'different-kind-of-trips';
    const hitHash = 'hit'.padEnd(64, '0');
    const noiseHash = 'noise'.padEnd(64, '1');
    const hugeBody = { bookings: 'z'.repeat(40_000) };
    const hitMock: MockData = {
      request: {
        method: 'POST',
        url: 'https://api.example.com/graphql',
        headers: {},
        queryParams: {},
        data: { query: 'query GetBookings { bookings { id } }' },
      },
      response: { status: 200, data: hugeBody, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const noiseMock = mockPayload('https://api.example.com/noise', hugeBody);
    const values = new Map<string, string>([
      [`mockifyer:v1:mock:${scenario}:${hitHash}`, JSON.stringify(hitMock)],
      [`mockifyer:v1:mock:${scenario}:${noiseHash}`, JSON.stringify(noiseMock)],
    ]);
    const hashFields = new Map<string, Map<string, string>>([
      [
        `mockifyer:v1:list_catalog:${scenario}`,
        new Map([
          [
            hitHash,
            serializeCatalogSidecarEntry({
              mockData: hitMock,
              rawByteLength: Buffer.byteLength(JSON.stringify(hitMock)),
            }),
          ],
          [
            noiseHash,
            serializeCatalogSidecarEntry({
              mockData: noiseMock,
              rawByteLength: Buffer.byteLength(JSON.stringify(noiseMock)),
            }),
          ],
        ]),
      ],
    ]);
    const mgetCalls: string[][] = [];
    const store = new RedisMockStore({
      kv: searchKv({
        hashes: [hitHash, noiseHash],
        values,
        onMget: (keys) => mgetCalls.push(keys),
        hashFields,
      }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const result = await store.search(scenario, parseSearchQuery('GetBookings'), 50);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].hash).toBe(hitHash);
    expect(result.items[0].mockData.response.data).toBeNull();
    expect(mgetCalls).toEqual([]);
  });

  it('does not body-scan remaining mocks when the sidecar already answered the query', async () => {
    const scenario = 'default';
    const urlHash = 'url'.padEnd(64, '3');
    const bodyOnlyHash = 'bod'.padEnd(64, '4');
    const urlMock = mockPayload('https://api.example.com/GetBookings');
    const bodyMock = mockPayload('https://api.example.com/other', { text: 'GetBookings-in-body' });
    const values = new Map<string, string>([
      [`mockifyer:v1:mock:${scenario}:${urlHash}`, JSON.stringify(urlMock)],
      [`mockifyer:v1:mock:${scenario}:${bodyOnlyHash}`, JSON.stringify(bodyMock)],
    ]);
    const hashFields = new Map<string, Map<string, string>>([
      [
        `mockifyer:v1:list_catalog:${scenario}`,
        new Map([
          [urlHash, serializeCatalogSidecarEntry({ mockData: urlMock, rawByteLength: 10 })],
          [bodyOnlyHash, serializeCatalogSidecarEntry({ mockData: bodyMock, rawByteLength: 11 })],
        ]),
      ],
    ]);
    const mgetCalls: string[][] = [];
    const store = new RedisMockStore({
      kv: searchKv({
        hashes: [urlHash, bodyOnlyHash],
        values,
        onMget: (keys) => mgetCalls.push(keys),
        hashFields,
      }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const result = await store.search(scenario, parseSearchQuery('GetBookings'), 50);
    expect(result.items.map((item) => item.hash)).toEqual([urlHash]);
    expect(mgetCalls).toEqual([]);
  });

  it('falls back to body MGET when the term is only in response.data', async () => {
    const scenario = 'default';
    const hash = 'body'.padEnd(64, '2');
    const mock = mockPayload('https://api.example.com/items', { needle: 'unique-in-body' });
    const raw = JSON.stringify(mock);
    const values = new Map<string, string>([[`mockifyer:v1:mock:${scenario}:${hash}`, raw]]);
    const hashFields = new Map<string, Map<string, string>>([
      [
        `mockifyer:v1:list_catalog:${scenario}`,
        new Map([
          [
            hash,
            serializeCatalogSidecarEntry({
              mockData: mock,
              rawByteLength: Buffer.byteLength(raw),
            }),
          ],
        ]),
      ],
    ]);
    const mgetCalls: string[][] = [];
    const store = new RedisMockStore({
      kv: searchKv({
        hashes: [hash],
        values,
        onMget: (keys) => mgetCalls.push(keys),
        hashFields,
      }),
      mockDataPath: '/tmp/mockifyer-unused',
    });

    const result = await store.search(scenario, parseSearchQuery('unique-in-body'), 10);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].hash).toBe(hash);
    expect(mgetCalls).toEqual([[`mockifyer:v1:mock:${scenario}:${hash}`]]);
  });
});
