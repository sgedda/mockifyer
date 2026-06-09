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

type RedisGetClient = {
  get(key: string): Promise<string | null>;
  mget(...keys: string[]): Promise<Array<string | null>>;
};

type RedisDelClient = {
  del(...keys: string[]): Promise<unknown>;
};

/**
 * Cluster-safe MGET: one round-trip on standalone Redis; falls back to per-key GET on CROSSSLOT.
 */
export async function redisMget(client: RedisGetClient, keys: string[]): Promise<Array<string | null>> {
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
 * Cluster-safe DEL: one round-trip on standalone Redis; falls back to per-key DEL on CROSSSLOT.
 */
export async function redisDel(client: RedisDelClient, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (keys.length === 1) {
    await client.del(keys[0]);
    return;
  }

  try {
    await client.del(...keys);
  } catch (err) {
    if (!isRedisCrossslotError(err)) throw err;
    await Promise.all(keys.map((key) => client.del(key)));
  }
}
