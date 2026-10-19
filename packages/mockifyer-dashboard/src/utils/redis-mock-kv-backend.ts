import { chunkArray, redisDel, redisMget, ResilientIoRedisClient } from '@sgedda/mockifyer-core';
import type { MockKvBackend, MockKvMulti } from './mock-kv-backend';

/** Field/value pairs per HSET so flattened args stay under Redis command chunk size (500). */
const HSET_FIELD_PAIR_CHUNK = 250;

/** Buffers MULTI commands until exec(), when the cluster-aware client is ready. */
class BufferedRedisKvMulti implements MockKvMulti {
  private readonly ops: Array<(multi: any) => void> = [];

  constructor(private readonly holder: ResilientIoRedisClient) {}

  set(key: string, value: string): MockKvMulti {
    this.ops.push((multi) => multi.set(key, value));
    return this;
  }

  sadd(key: string, ...members: string[]): MockKvMulti {
    if (members.length === 0) return this;
    for (const chunk of chunkArray(members)) {
      this.ops.push((multi) => multi.sadd(key, ...chunk));
    }
    return this;
  }

  del(key: string): MockKvMulti {
    this.ops.push((multi) => multi.del(key));
    return this;
  }

  async exec(): Promise<unknown> {
    return this.holder.run(async (redis) => {
      const multi = redis.multi();
      for (const op of this.ops) {
        op(multi);
      }
      return multi.exec();
    });
  }
}

export class RedisMockKvBackend implements MockKvBackend {
  private readonly holder: ResilientIoRedisClient;

  constructor(redisUrl: string, redisOptions?: Record<string, unknown>) {
    this.holder = new ResilientIoRedisClient(redisUrl, {
      maxRetriesPerRequest: 3,
      ...(redisOptions || {}),
    });
  }

  async get(key: string): Promise<string | null> {
    return this.holder.run((redis) => redis.get(key));
  }

  async getrange(key: string, start: number, end: number): Promise<string | null> {
    const value = await this.holder.run((redis) => redis.getrange(key, start, end));
    return typeof value === 'string' ? value : null;
  }

  async set(key: string, value: string, expiryMode?: 'EX', ttlSec?: number): Promise<void> {
    await this.holder.run(async (redis) => {
      if (expiryMode === 'EX' && ttlSec != null) {
        await redis.set(key, value, 'EX', ttlSec);
        return;
      }
      await redis.set(key, value);
    });
  }

  async del(...keys: string[]): Promise<void> {
    await this.holder.run((redis) => redisDel(redis, keys));
  }

  async mget(keys: string[]): Promise<Array<string | null>> {
    return this.holder.run((redis) => redisMget(redis, keys));
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await this.holder.run(async (redis) => {
      for (const chunk of chunkArray(members)) {
        await redis.sadd(key, ...chunk);
      }
    });
  }

  async smembers(key: string): Promise<string[]> {
    return this.holder.run((redis) => redis.smembers(key));
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await this.holder.run(async (redis) => {
      for (const chunk of chunkArray(members)) {
        await redis.srem(key, ...chunk);
      }
    });
  }

  async scard(key: string): Promise<number> {
    const n = await this.holder.run((redis) => redis.scard(key));
    return typeof n === 'number' ? n : 0;
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const n = await this.holder.run((redis) => redis.sismember(key, member));
    return n === 1 || n === true;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.holder.run((redis) => redis.hget(key, field));
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.holder.run((redis) => redis.hset(key, field, value));
  }

  async hsetMany(key: string, fields: Record<string, string>): Promise<void> {
    const entries = Object.entries(fields);
    if (entries.length === 0) return;
    const pairChunk = HSET_FIELD_PAIR_CHUNK;
    await this.holder.run(async (redis) => {
      for (const chunk of chunkArray(entries, pairChunk)) {
        const args: string[] = [];
        for (const [field, value] of chunk) {
          args.push(field, value);
        }
        await redis.hset(key, ...args);
      }
    });
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const raw = await this.holder.run((redis) => redis.hgetall(key));
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value == null) continue;
      out[field] = typeof value === 'string' ? value : String(value);
    }
    return out;
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (fields.length === 0) return;
    await this.holder.run(async (redis) => {
      for (const chunk of chunkArray(fields)) {
        await redis.hdel(key, ...chunk);
      }
    });
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.holder.run((redis) => redis.zadd(key, score, member));
  }

  async zrem(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await this.holder.run((redis) => redis.zrem(key, ...members));
  }

  async zrevrangebyscore(
    key: string,
    max: number,
    min: number,
    ...args: Array<string | number>
  ): Promise<string[]> {
    return this.holder.run((redis) => redis.zrevrangebyscore(key, max, min, ...args));
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    await this.holder.run((redis) => redis.zremrangebyscore(key, min, max));
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    return this.holder.run((redis) => redis.zcount(key, min, max));
  }

  async scanKeys(pattern: string): Promise<string[]> {
    return this.holder.run(async (redis) => {
      const scanNode = async (node: {
        scan: (...args: unknown[]) => Promise<[string, string[]]>;
      }): Promise<string[]> => {
        const keys: string[] = [];
        let cursor = '0';
        do {
          const [next, batch] = await node.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
          cursor = next;
          keys.push(...batch);
        } while (cursor !== '0');
        return keys;
      };

      if (typeof redis.nodes === 'function') {
        const masters: Array<{ scan: (...args: unknown[]) => Promise<[string, string[]]> }> =
          redis.nodes('master') ?? [];
        const batches = await Promise.all(masters.map((node) => scanNode(node)));
        return [...new Set(batches.flat())];
      }

      return scanNode(redis);
    });
  }

  multi(): MockKvMulti {
    return new BufferedRedisKvMulti(this.holder);
  }

  async ping(): Promise<void> {
    await this.holder.run((redis) => redis.ping());
  }

  async close(): Promise<void> {
    await this.holder.close();
  }
}
