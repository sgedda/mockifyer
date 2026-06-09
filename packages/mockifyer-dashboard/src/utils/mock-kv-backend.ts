/**
 * Minimal Redis-like KV API used by {@link RedisMockStore} (Redis and SQLite backends).
 */
export interface MockKvMulti {
  set(key: string, value: string): MockKvMulti;
  sadd(key: string, ...members: string[]): MockKvMulti;
  del(key: string): MockKvMulti;
  exec(): Promise<unknown>;
}

export interface MockKvBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode?: 'EX', ttlSec?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  mget(...keys: string[]): Promise<Array<string | null>>;
  sadd(key: string, ...members: string[]): Promise<void>;
  smembers(key: string): Promise<string[]>;
  srem(key: string, ...members: string[]): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hdel(key: string, ...fields: string[]): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrem(key: string, ...members: string[]): Promise<void>;
  zrevrangebyscore(
    key: string,
    max: number,
    min: number,
    ...args: Array<string | number>
  ): Promise<string[]>;
  zremrangebyscore(key: string, min: number, max: number): Promise<void>;
  zcount(key: string, min: number, max: number): Promise<number>;
  /** Returns all keys matching glob-style pattern (only `*` supported). */
  scanKeys(pattern: string): Promise<string[]>;
  multi(): MockKvMulti;
  ping(): Promise<void>;
  close(): Promise<void>;
}
