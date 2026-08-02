import type { MockKvBackend, MockKvMulti } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';

/**
 * Minimal KV that throws CROSSSLOT on MULTI/EXEC (Redis Cluster behavior),
 * while allowing per-key SET/SADD/GET used by the clone fallback.
 */
function createCrossslotKv(): MockKvBackend & { sets: Map<string, string>; members: Map<string, Set<string>> } {
  const sets = new Map<string, string>();
  const members = new Map<string, Set<string>>();

  const ensureSet = (key: string): Set<string> => {
    let s = members.get(key);
    if (!s) {
      s = new Set();
      members.set(key, s);
    }
    return s;
  };

  const kv: MockKvBackend & { sets: Map<string, string>; members: Map<string, Set<string>> } = {
    sets,
    members,
    async get(key) {
      return sets.get(key) ?? null;
    },
    async set(key, value) {
      sets.set(key, value);
    },
    async del(...keys) {
      for (const k of keys) {
        sets.delete(k);
        members.delete(k);
      }
    },
    async mget(...keys) {
      return keys.map((k) => sets.get(k) ?? null);
    },
    async sadd(key, ...vals) {
      const s = ensureSet(key);
      for (const v of vals) s.add(v);
    },
    async smembers(key) {
      return Array.from(members.get(key) ?? []);
    },
    async srem() {
      /* unused */
    },
    async hget() {
      return null;
    },
    async hset() {
      /* unused */
    },
    async hdel() {
      /* unused */
    },
    async zadd() {
      /* unused */
    },
    async zrem() {
      /* unused */
    },
    async zrevrangebyscore() {
      return [];
    },
    async zremrangebyscore() {
      /* unused */
    },
    async zcount() {
      return 0;
    },
    async scanKeys() {
      return [];
    },
    multi(): MockKvMulti {
      const ops: Array<() => void> = [];
      const multi: MockKvMulti = {
        set() {
          ops.push(() => undefined);
          return multi;
        },
        sadd() {
          ops.push(() => undefined);
          return multi;
        },
        del() {
          ops.push(() => undefined);
          return multi;
        },
        async exec() {
          void ops;
          throw new Error('CROSSSLOT Keys in request do not hash to the same slot');
        },
      };
      return multi;
    },
    async ping() {
      /* unused */
    },
    async close() {
      /* unused */
    },
  };
  return kv;
}

describe('RedisMockStore.cloneScenario cluster CROSSSLOT fallback', () => {
  it('copies mocks via per-key writes when MULTI spans slots', async () => {
    const kv = createCrossslotKv();
    const store = new RedisMockStore({ kv, mockDataPath: '/tmp/mockifyer-crossslot-test' });

    const mockA = {
      request: { method: 'GET', url: 'https://api.example.com/a', headers: {}, queryParams: {} },
      response: { status: 200, data: { id: 'a' }, headers: {} },
      timestamp: '2026-08-02T00:00:00.000Z',
      scenario: 'source',
    };
    const mockB = {
      request: { method: 'GET', url: 'https://api.example.com/b', headers: {}, queryParams: {} },
      response: { status: 200, data: { id: 'b' }, headers: {} },
      timestamp: '2026-08-02T00:00:00.000Z',
      scenario: 'source',
    };

    const hashA = RedisMockStore.hashForMock(mockA as any);
    const hashB = RedisMockStore.hashForMock(mockB as any);
    await store.setByHash(hashA, mockA as any, 'source');
    await store.setByHash(hashB, mockB as any, 'source');

    const result = await store.cloneScenario('source', 'dest');
    expect(result.mocksCopied).toBe(2);

    const destA = await store.getByHash(hashA, 'dest');
    const destB = await store.getByHash(hashB, 'dest');
    expect(destA?.response?.data).toEqual({ id: 'a' });
    expect(destB?.response?.data).toEqual({ id: 'b' });
  });
});
