import type { MockData } from '@sgedda/mockifyer-core';
import type { MockKvBackend, MockKvMulti } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';

class CrossSlotMulti implements MockKvMulti {
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

class InMemoryClusterKv implements MockKvBackend {
  readonly values = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();
  readonly hashes = new Map<string, Map<string, string>>();
  readonly zsets = new Map<string, Map<string, number>>();
  multiCallCount = 0;

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
      this.zsets.delete(key);
    }
  }

  async mget(...keys: string[]): Promise<Array<string | null>> {
    return keys.map((key) => this.values.get(key) ?? null);
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    let set = this.sets.get(key);
    if (!set) {
      set = new Set<string>();
      this.sets.set(key, set);
    }
    for (const member of members) {
      set.add(member);
    }
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
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map<string, string>();
      this.hashes.set(key, hash);
    }
    hash.set(field, value);
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    const hash = this.hashes.get(key);
    if (!hash) return;
    for (const field of fields) {
      hash.delete(field);
    }
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    let zset = this.zsets.get(key);
    if (!zset) {
      zset = new Map<string, number>();
      this.zsets.set(key, zset);
    }
    zset.set(member, score);
  }

  async zrem(key: string, ...members: string[]): Promise<void> {
    const zset = this.zsets.get(key);
    if (!zset) return;
    for (const member of members) {
      zset.delete(member);
    }
  }

  async zrevrangebyscore(
    key: string,
    max: number,
    min: number,
    ...args: Array<string | number>
  ): Promise<string[]> {
    const limitIndex = args.findIndex((arg) => String(arg).toUpperCase() === 'LIMIT');
    const offset = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 0;
    const count = limitIndex >= 0 ? Number(args[limitIndex + 2]) : Number.POSITIVE_INFINITY;
    return Array.from(this.zsets.get(key)?.entries() ?? [])
      .filter(([, score]) => score >= min && score <= max)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(offset, offset + count)
      .map(([member]) => member);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    const zset = this.zsets.get(key);
    if (!zset) return;
    for (const [member, score] of zset.entries()) {
      if (score >= min && score <= max) {
        zset.delete(member);
      }
    }
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    return Array.from(this.zsets.get(key)?.values() ?? []).filter(
      (score) => score >= min && score <= max
    ).length;
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return [...this.values.keys(), ...this.sets.keys(), ...this.hashes.keys()].filter((key) =>
      regex.test(key)
    );
  }

  multi(): MockKvMulti {
    this.multiCallCount++;
    return new CrossSlotMulti();
  }

  async ping(): Promise<void> {
    return undefined;
  }

  async close(): Promise<void> {
    return undefined;
  }
}

function mockData(path: string): MockData {
  return {
    request: {
      method: 'GET',
      url: `https://api.example.com${path}`,
      headers: {},
    },
    response: {
      status: 200,
      data: { path },
      headers: {},
    },
    timestamp: '2026-06-16T00:00:00.000Z',
  };
}

describe('RedisMockStore', () => {
  it('clones scenarios without a cross-slot transaction', async () => {
    const kv = new InMemoryClusterKv();
    const store = new RedisMockStore({
      kv,
      keyPrefix: 'test',
      mockDataPath: '/tmp/mockifyer-tests',
    });

    await store.setByHashInScenario('hash-a', mockData('/a'), 'base');
    await store.setByHashInScenario('hash-b', mockData('/b'), 'base');
    await store.setDateConfig('base', {
      dateManipulation: { fixedDate: '2026-06-16T12:00:00.000Z' },
      updatedAt: '2026-06-16T00:00:00.000Z',
    });
    await store.setProxyConfig('base', {
      recordOnMiss: false,
      allowUpstream: false,
      recordResponses: true,
      updatedAt: '2026-06-16T00:00:00.000Z',
    });

    await expect(store.cloneScenario('base', 'derived')).resolves.toEqual({
      mocksCopied: 2,
      dateConfigCopied: true,
    });

    const clonedMocks = await store.list('derived');
    expect(clonedMocks.map((item) => item.hash).sort()).toEqual(['hash-a', 'hash-b']);
    expect(clonedMocks.map((item) => item.mockData.response.data)).toEqual(expect.arrayContaining([
      { path: '/a' },
      { path: '/b' },
    ]));
    await expect(store.getDateConfig('derived')).resolves.toMatchObject({
      dateManipulation: { fixedDate: '2026-06-16T12:00:00.000Z' },
    });
    await expect(store.getProxyConfig('derived')).resolves.toMatchObject({
      recordOnMiss: false,
      allowUpstream: false,
      recordResponses: true,
    });
    await expect(store.listScenarios()).resolves.toEqual(expect.arrayContaining(['base', 'derived']));
    expect(kv.multiCallCount).toBe(0);
  });
});
