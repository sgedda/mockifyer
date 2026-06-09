import { redisDel, redisMget, resolveIoRedisClient } from '@sgedda/mockifyer-core';
import type { MockKvBackend, MockKvMulti } from './mock-kv-backend';

/** Buffers MULTI commands until exec(), when the cluster-aware client is ready. */
class BufferedRedisKvMulti implements MockKvMulti {
  private readonly ops: Array<(multi: any) => void> = [];

  constructor(private readonly clientPromise: Promise<any>) {}

  set(key: string, value: string): MockKvMulti {
    this.ops.push((multi) => multi.set(key, value));
    return this;
  }

  sadd(key: string, ...members: string[]): MockKvMulti {
    if (members.length > 0) {
      this.ops.push((multi) => multi.sadd(key, ...members));
    }
    return this;
  }

  del(key: string): MockKvMulti {
    this.ops.push((multi) => multi.del(key));
    return this;
  }

  async exec(): Promise<unknown> {
    const redis = await this.clientPromise;
    const multi = redis.multi();
    for (const op of this.ops) {
      op(multi);
    }
    return multi.exec();
  }
}

export class RedisMockKvBackend implements MockKvBackend {
  private readonly clientPromise: Promise<any>;

  constructor(redisUrl: string, redisOptions?: Record<string, unknown>) {
    this.clientPromise = resolveIoRedisClient(redisUrl, {
      maxRetriesPerRequest: 3,
      ...(redisOptions || {}),
    });
  }

  private client(): Promise<any> {
    return this.clientPromise;
  }

  async get(key: string): Promise<string | null> {
    return (await this.client()).get(key);
  }

  async set(key: string, value: string, expiryMode?: 'EX', ttlSec?: number): Promise<void> {
    const redis = await this.client();
    if (expiryMode === 'EX' && ttlSec != null) {
      await redis.set(key, value, 'EX', ttlSec);
      return;
    }
    await redis.set(key, value);
  }

  async del(...keys: string[]): Promise<void> {
    await redisDel(await this.client(), keys);
  }

  async mget(...keys: string[]): Promise<Array<string | null>> {
    return redisMget(await this.client(), keys);
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await (await this.client()).sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return (await this.client()).smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await (await this.client()).srem(key, ...members);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return (await this.client()).hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await (await this.client()).hset(key, field, value);
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (fields.length === 0) return;
    await (await this.client()).hdel(key, ...fields);
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await (await this.client()).zadd(key, score, member);
  }

  async zrem(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) return;
    await (await this.client()).zrem(key, ...members);
  }

  async zrevrangebyscore(
    key: string,
    max: number,
    min: number,
    ...args: Array<string | number>
  ): Promise<string[]> {
    return (await this.client()).zrevrangebyscore(key, max, min, ...args);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    await (await this.client()).zremrangebyscore(key, min, max);
  }

  async zcount(key: string, min: number, max: number): Promise<number> {
    return (await this.client()).zcount(key, min, max);
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

    const redis = await this.client();
    if (typeof redis.nodes === 'function') {
      const masters: Array<{ scan: (...args: unknown[]) => Promise<[string, string[]]> }> =
        redis.nodes('master') ?? [];
      const batches = await Promise.all(masters.map((node) => scanNode(node)));
      return [...new Set(batches.flat())];
    }

    return scanNode(redis);
  }

  multi(): MockKvMulti {
    return new BufferedRedisKvMulti(this.clientPromise);
  }

  async ping(): Promise<void> {
    await (await this.client()).ping();
  }

  async close(): Promise<void> {
    await (await this.client()).quit().catch(() => undefined);
  }
}
