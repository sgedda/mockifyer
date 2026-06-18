import fs from 'fs';
import os from 'os';
import path from 'path';
import type { MockKvBackend, MockKvMulti } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';

const EXPORT_TIMESTAMP = '2026-06-10T00:00:00.000Z';

function makeMock(url: string, scenario = 'source') {
  return {
    request: {
      method: 'GET',
      url,
      headers: {},
      queryParams: {},
    },
    response: {
      status: 200,
      data: { ok: true },
      headers: {},
    },
    timestamp: EXPORT_TIMESTAMP,
    scenario,
  };
}

class InMemoryKvBackend implements MockKvBackend {
  private readonly values = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly zsets = new Map<string, Map<string, number>>();

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
    const limitIndex = args.findIndex((arg) => String(arg).toUpperCase() === 'LIMIT');
    const offset = limitIndex >= 0 ? Number(args[limitIndex + 1] ?? 0) : 0;
    const count = limitIndex >= 0 ? Number(args[limitIndex + 2] ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    return Array.from(this.zsets.get(key)?.entries() ?? [])
      .filter(([, score]) => score <= max && score >= min)
      .sort((a, b) => b[1] - a[1])
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
    return Array.from(this.zsets.get(key)?.values() ?? []).filter((score) => score >= min && score <= max).length;
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return [...this.values.keys(), ...this.sets.keys(), ...this.hashes.keys(), ...this.zsets.keys()].filter((key) =>
      regex.test(key)
    );
  }

  multi(): MockKvMulti {
    throw new Error('multi should not be used by cluster-safe clone');
  }

  async ping(): Promise<void> {
    return undefined;
  }

  async close(): Promise<void> {
    return undefined;
  }
}

describe('RedisMockStore', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-redis-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('clones scenarios without Redis MULTI so Redis Cluster slots do not break derivation', async () => {
    const kv = new InMemoryKvBackend();
    const store = new RedisMockStore({ kv, mockDataPath: tmpDir });
    const sourceMock = makeMock('https://api.example.com/source');
    const hash = RedisMockStore.hashForMock(sourceMock);

    await store.setByHash(hash, sourceMock, 'source');

    const result = await store.cloneScenario('source', 'derived');

    expect(result).toEqual({ mocksCopied: 1, dateConfigCopied: false });
    expect(await store.getByHash(hash, 'derived')).toEqual(sourceMock);
    expect(await store.listScenarios()).toEqual(expect.arrayContaining(['derived', 'source']));
  });
});
