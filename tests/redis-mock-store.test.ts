import type { MockData } from '@sgedda/mockifyer-core';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';
import type {
  MockKvBackend,
  MockKvMulti,
} from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';

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
  readonly values = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();
  multiCalled = false;

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

  async hget(): Promise<string | null> {
    return null;
  }

  async hset(): Promise<void> {
    return undefined;
  }

  async hdel(): Promise<void> {
    return undefined;
  }

  async zadd(): Promise<void> {
    return undefined;
  }

  async zrem(): Promise<void> {
    return undefined;
  }

  async zrevrangebyscore(): Promise<string[]> {
    return [];
  }

  async zremrangebyscore(): Promise<void> {
    return undefined;
  }

  async zcount(): Promise<number> {
    return 0;
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    return [...this.values.keys(), ...this.sets.keys()].filter((key) => key.startsWith(prefix));
  }

  multi(): MockKvMulti {
    this.multiCalled = true;
    return new ThrowingMulti();
  }

  async ping(): Promise<void> {
    return undefined;
  }

  async close(): Promise<void> {
    return undefined;
  }
}

function makeMock(): MockData {
  return {
    request: {
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: {},
      queryParams: {},
    },
    response: {
      status: 200,
      data: { ok: true },
      headers: {},
    },
    timestamp: '2026-06-13T00:00:00.000Z',
  };
}

describe('RedisMockStore', () => {
  it('clones scenarios without a cross-key MULTI transaction', async () => {
    const kv = new MemoryKvBackend();
    const store = new RedisMockStore({ kv, mockDataPath: '/tmp/mock-data' });
    const mock = makeMock();
    const hash = RedisMockStore.hashForMock(mock);

    await store.setByHashInScenario(hash, mock, 'source');
    await store.setDateConfig('source', {
      dateManipulation: { offsetDays: 1 },
      updatedAt: '2026-06-13T00:00:00.000Z',
    });

    await expect(store.cloneScenario('source', 'copy')).resolves.toEqual({
      mocksCopied: 1,
      dateConfigCopied: true,
    });

    await expect(store.getByHashInScenario(hash, 'copy')).resolves.toEqual(mock);
    await expect(store.getDateConfig('copy')).resolves.toEqual({
      dateManipulation: { offsetDays: 1 },
      updatedAt: expect.any(String),
    });
    expect(kv.multiCalled).toBe(false);
  });
});
