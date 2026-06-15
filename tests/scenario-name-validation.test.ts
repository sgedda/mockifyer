import { getScenarioFolderPath, validateScenarioName } from '@sgedda/mockifyer-core';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';
import type { MockKvBackend, MockKvMulti } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';

class MemoryKvMulti implements MockKvMulti {
  private readonly ops: Array<() => Promise<void>> = [];

  constructor(private readonly kv: MemoryKvBackend) {}

  set(key: string, value: string): MockKvMulti {
    this.ops.push(() => this.kv.set(key, value));
    return this;
  }

  sadd(key: string, ...members: string[]): MockKvMulti {
    this.ops.push(() => this.kv.sadd(key, ...members));
    return this;
  }

  del(key: string): MockKvMulti {
    this.ops.push(() => this.kv.del(key));
    return this;
  }

  async exec(): Promise<unknown> {
    for (const op of this.ops) {
      await op();
    }
    return undefined;
  }
}

class MemoryKvBackend implements MockKvBackend {
  readonly values = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();
  readonly hashes = new Map<string, Map<string, string>>();
  readonly zsets = new Map<string, Map<string, number>>();

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
    const set = this.sets.get(key) ?? new Set<string>();
    for (const member of members) {
      set.add(member);
    }
    this.sets.set(key, set);
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? []).sort();
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
    const zset = this.zsets.get(key) ?? new Map<string, number>();
    zset.set(member, score);
    this.zsets.set(key, zset);
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
    const withScores = args.includes('WITHSCORES');
    const rows = Array.from(this.zsets.get(key) ?? [])
      .filter(([, score]) => score >= min && score <= max)
      .sort((a, b) => b[1] - a[1]);
    const out: string[] = [];
    for (const [member, score] of rows) {
      out.push(member);
      if (withScores) out.push(String(score));
    }
    return out;
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    const zset = this.zsets.get(key);
    if (!zset) return;
    for (const [member, score] of zset) {
      if (score >= min && score <= max) {
        zset.delete(member);
      }
    }
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    return Array.from(this.zsets.get(key) ?? []).filter(([, score]) => score >= min && score <= max).length;
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    const keys = new Set<string>();
    for (const key of this.values.keys()) keys.add(key);
    for (const key of this.sets.keys()) keys.add(key);
    for (const key of this.hashes.keys()) keys.add(key);
    return Array.from(keys).filter((key) => key.startsWith(prefix));
  }

  multi(): MockKvMulti {
    return new MemoryKvMulti(this);
  }

  async ping(): Promise<void> {
    return undefined;
  }

  async close(): Promise<void> {
    return undefined;
  }
}

describe('scenario name validation', () => {
  it('rejects traversal scenario names at the filesystem boundary', () => {
    expect(validateScenarioName('default')).toEqual({ ok: true, value: 'default' });
    expect(() => getScenarioFolderPath('/tmp/mock-data', '../escape')).toThrow(/Invalid scenario name/);
  });

  it('rejects invalid proxy and lane scenarios before they can reach disk mirror paths', async () => {
    const kv = new MemoryKvBackend();
    const store = new RedisMockStore({ kv, mockDataPath: '/tmp/mock-data' });

    await expect(store.resolveProxyScenario('../escape')).rejects.toThrow(/Invalid scenario name/);
    await expect(store.setLaneScenario('lane-a', '../escape')).rejects.toThrow(/Invalid scenario name/);
    await expect(kv.get('mockifyer:v1:client_scenario:lane-a')).resolves.toBeNull();
  });

  it('does not surface stale invalid scenario values from Redis indexes', async () => {
    const kv = new MemoryKvBackend();
    const store = new RedisMockStore({ kv, mockDataPath: '/tmp/mock-data' });

    await kv.sadd('mockifyer:v1:scenarios', 'safe', '../escape');
    await kv.sadd('mockifyer:v1:index:other_safe', 'hash-a');
    await kv.sadd('mockifyer:v1:index:../other_escape', 'hash-b');
    await kv.set('mockifyer:v1:date_config:dated_safe', '{}');
    await kv.set('mockifyer:v1:date_config:../dated_escape', '{}');

    await expect(store.listScenarios()).resolves.toEqual(['dated_safe', 'other_safe', 'safe']);
  });
});
