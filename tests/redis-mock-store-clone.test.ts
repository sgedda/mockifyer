import type { MockData } from '@sgedda/mockifyer-core';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';
import type { MockKvBackend, MockKvMulti } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';

class ThrowingMulti implements MockKvMulti {
  set(): MockKvMulti {
    return this;
  }

  sadd(): MockKvMulti {
    return this;
  }

  del(): MockKvMulti {
    return this;
  }

  async exec(): Promise<unknown> {
    throw new Error('CROSSSLOT Keys in request do not hash to the same slot');
  }
}

class MemoryKvBackend implements MockKvBackend {
  private readonly values = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly sortedSets = new Map<string, Map<string, number>>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.values.delete(key);
      this.sets.delete(key);
      this.hashes.delete(key);
      this.sortedSets.delete(key);
    }
  }

  async mget(...keys: string[]): Promise<Array<string | null>> {
    return keys.map((key) => this.values.get(key) ?? null);
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    const set = this.sets.get(key) ?? new Set<string>();
    for (const member of members) {
      set.add(member);
    }
    this.sets.set(key, set);
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? []);
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    const set = this.sets.get(key);
    if (!set) return;
    for (const member of members) {
      set.delete(member);
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    hash.set(field, value);
    this.hashes.set(key, hash);
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    const hash = this.hashes.get(key);
    if (!hash) return;
    for (const field of fields) {
      hash.delete(field);
    }
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    const sortedSet = this.sortedSets.get(key) ?? new Map<string, number>();
    sortedSet.set(member, score);
    this.sortedSets.set(key, sortedSet);
  }

  async zrem(key: string, ...members: string[]): Promise<void> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return;
    for (const member of members) {
      sortedSet.delete(member);
    }
  }

  async zrevrangebyscore(key: string, max: number, min: number): Promise<string[]> {
    return Array.from(this.sortedSets.get(key) ?? [])
      .filter(([, score]) => score <= max && score >= min)
      .sort((a, b) => b[1] - a[1])
      .map(([member]) => member);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    const sortedSet = this.sortedSets.get(key);
    if (!sortedSet) return;
    for (const [member, score] of sortedSet) {
      if (score >= min && score <= max) {
        sortedSet.delete(member);
      }
    }
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    return Array.from(this.sortedSets.get(key) ?? []).filter(([, score]) => score >= min && score <= max).length;
  }

  async scanKeys(): Promise<string[]> {
    return Array.from(new Set([...this.values.keys(), ...this.sets.keys(), ...this.hashes.keys()]));
  }

  multi(): MockKvMulti {
    return new ThrowingMulti();
  }

  async ping(): Promise<void> {
    return undefined;
  }

  async close(): Promise<void> {
    return undefined;
  }
}

function mockData(url: string): MockData {
  return {
    request: {
      method: 'GET',
      url,
      headers: {},
      queryParams: {},
    },
    response: {
      status: 200,
      data: { url },
      headers: {},
    },
    timestamp: '2026-06-14T00:00:00.000Z',
  };
}

describe('RedisMockStore.cloneScenario', () => {
  it('copies mocks without relying on MULTI so Redis Cluster slots cannot abort deriveFrom', async () => {
    const store = new RedisMockStore({
      kv: new MemoryKvBackend(),
      mockDataPath: process.cwd(),
      keyPrefix: 'test',
    });
    const first = mockData('https://api.example.com/one');
    const second = mockData('https://api.example.com/two');
    const firstHash = RedisMockStore.hashForMock(first);
    const secondHash = RedisMockStore.hashForMock(second);

    await store.setByHash(firstHash, first, 'source');
    await store.setByHash(secondHash, second, 'source');
    await store.setDateConfig('source', {
      dateManipulation: { fixedDate: '2026-06-14T12:00:00.000Z' },
      updatedAt: '2026-06-14T00:00:00.000Z',
    });

    await expect(store.cloneScenario('source', 'target')).resolves.toEqual({
      mocksCopied: 2,
      dateConfigCopied: true,
    });

    const copied = await store.list('target');
    expect(copied.map((item) => item.hash).sort()).toEqual([firstHash, secondHash].sort());
    await expect(store.getDateConfig('target')).resolves.toMatchObject({
      dateManipulation: { fixedDate: '2026-06-14T12:00:00.000Z' },
    });
  });
});
