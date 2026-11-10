/** True when Redis Cluster rejects a multi-key command (keys span slots). */
export function isRedisCrossslotError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('CROSSSLOT');
}

/** True when a standalone client hit a key on another cluster node (`MOVED slot host:port`). */
export function isRedisMovedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\bMOVED\b/.test(msg);
}

/**
 * Max keys/members passed to a single Redis vararg command (`MGET`, `DEL`, `SADD`).
 * Spreading a larger array (`fn(...keys)`) throws `RangeError: Maximum call stack size exceeded`.
 */
export const REDIS_COMMAND_ARG_CHUNK_SIZE = 500;

/**
 * Split `items` into slices of at most `size` (default {@link REDIS_COMMAND_ARG_CHUNK_SIZE}).
 */
export function chunkArray<T>(items: readonly T[], size: number = REDIS_COMMAND_ARG_CHUNK_SIZE): T[][] {
  if (size <= 0) {
    throw new Error('chunk size must be greater than 0');
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type RedisGetClient = {
  get(key: string): Promise<string | null>;
  mget(...keys: string[]): Promise<Array<string | null>>;
};

type RedisDelClient = {
  del(...keys: string[]): Promise<unknown>;
};

async function redisMgetChunk(
  client: RedisGetClient,
  keys: string[]
): Promise<Array<string | null>> {
  if (keys.length === 0) return [];
  if (keys.length === 1) return [await client.get(keys[0])];

  try {
    return await client.mget(...keys);
  } catch (err) {
    if (!isRedisCrossslotError(err)) throw err;
  }

  const results: Array<string | null> = new Array(keys.length);
  await Promise.all(
    keys.map(async (key, index) => {
      results[index] = await client.get(key);
    })
  );
  return results;
}

/**
 * Cluster-safe MGET: chunked round-trips on standalone Redis; falls back to per-key GET on CROSSSLOT.
 */
export async function redisMget(client: RedisGetClient, keys: string[]): Promise<Array<string | null>> {
  if (keys.length <= REDIS_COMMAND_ARG_CHUNK_SIZE) {
    return redisMgetChunk(client, keys);
  }
  const out: Array<string | null> = [];
  for (const chunk of chunkArray(keys)) {
    const part = await redisMgetChunk(client, chunk);
    for (const value of part) {
      out.push(value);
    }
  }
  return out;
}

async function redisDelChunk(client: RedisDelClient, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (keys.length === 1) {
    await client.del(keys[0]);
    return;
  }

  try {
    await client.del(...keys);
    return;
  } catch (err) {
    if (!isRedisCrossslotError(err)) throw err;
    await Promise.all(keys.map((key) => client.del(key)));
  }
}

/**
 * Cluster-safe DEL: chunked round-trips on standalone Redis; falls back to per-key DEL on CROSSSLOT.
 */
export async function redisDel(client: RedisDelClient, keys: string[]): Promise<void> {
  if (keys.length <= REDIS_COMMAND_ARG_CHUNK_SIZE) {
    await redisDelChunk(client, keys);
    return;
  }
  for (const chunk of chunkArray(keys)) {
    await redisDelChunk(client, chunk);
  }
}
