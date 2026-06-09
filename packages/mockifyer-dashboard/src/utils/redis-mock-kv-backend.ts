import { redisDel, redisMget } from '@sgedda/mockifyer-core';
import type { MockKvBackend, MockKvMulti } from './mock-kv-backend';

function requireIoRedis(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('ioredis');
  } catch {
    throw new Error(
      "Redis mock store requires optional dependency 'ioredis'. Install it in the dashboard package: npm install ioredis"
    );
  }
}

class RedisKvMulti implements MockKvMulti {
  constructor(private readonly multi: any) {}

  set(key: string, value: string): MockKvMulti {
    this.multi.set(key, value);
    return this;
  }

  sadd(key: string, ...members: string[]): MockKvMulti {
    if (members.length > 0) {
      this.multi.sadd(key, ...members);
    }
    return this;
  }

  del(key: string): MockKvMulti {
    this.multi.del(key);
    return this;
  }

  async exec(): Promise<unknown> {
    return this.multi.exec();
  }
}

export class RedisMockKvBackend implements MockKvBackend {
  private readonly redis: any;

  constructor(redisUrl: string, redisOptions?: Record<string, unknown>) {
    const RedisCtor = requireIoRedis();
    this.redis = new RedisCtor(redisUrl, {
      maxRetriesPerRequest: 3,
      ...(redisOptions || {}),
    });
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, expiryMode?: 'EX', ttlSec?: number): Promise<void> {
    if (expiryMode === 'EX' && ttlSec != null) {
      await this.redis.set(key, value, 'EX', ttlSec);
      return;
    }
    await this.redis.set(key, value);
  }

  async del(...keys: string[]): Promise<void> {
    await redisDel(this.redis, keys);
  }

  async mget(...keys: string[]): Promise<Array<string | null>> {
    return redisMget(this.redis, keys);
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await this.redis.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await this.redis.srem(key, ...members);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (fields.length === 0) return;
    await this.redis.hdel(key, ...fields);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.redis.zadd(key, score, member);
  }

  async zrem(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await this.redis.zrem(key, ...members);
  }

  async zrevrangebyscore(
    key: string,
    max: number,
    min: number,
    ...args: Array<string | number>
  ): Promise<string[]> {
    return this.redis.zrevrangebyscore(key, max, min, ...args);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    await this.redis.zremrangebyscore(key, min, max);
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    return this.redis.zcount(key, min, max);
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const scanNode = async (node: { scan: (...args: unknown[]) => Promise<[string, string[]]> }): Promise<string[]> => {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [next, batch] = await node.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
        cursor = next;
        keys.push(...batch);
      } while (cursor !== '0');
      return keys;
    };

    if (typeof this.redis.nodes === 'function') {
      const masters: Array<{ scan: (...args: unknown[]) => Promise<[string, string[]]> }> =
        this.redis.nodes('master') ?? [];
      const batches = await Promise.all(masters.map((node) => scanNode(node)));
      return [...new Set(batches.flat())];
    }

    return scanNode(this.redis);
  }

  multi(): MockKvMulti {
    return new RedisKvMulti(this.redis.multi());
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
