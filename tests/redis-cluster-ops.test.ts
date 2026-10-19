import {
  REDIS_COMMAND_ARG_CHUNK_SIZE,
  chunkArray,
  redisDel,
  redisMget,
} from '@sgedda/mockifyer-core';

describe('chunkArray', () => {
  it('returns no chunks for an empty list', () => {
    expect(chunkArray([])).toEqual([]);
  });

  it('keeps a short list as a single chunk', () => {
    expect(chunkArray(['a', 'b'], 10)).toEqual([['a', 'b']]);
  });

  it('splits on the default Redis command size', () => {
    const items = Array.from({ length: REDIS_COMMAND_ARG_CHUNK_SIZE + 3 }, (_, i) => i);
    const chunks = chunkArray(items);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(REDIS_COMMAND_ARG_CHUNK_SIZE);
    expect(chunks[1]).toEqual([
      REDIS_COMMAND_ARG_CHUNK_SIZE,
      REDIS_COMMAND_ARG_CHUNK_SIZE + 1,
      REDIS_COMMAND_ARG_CHUNK_SIZE + 2,
    ]);
  });

  it('rejects a non-positive chunk size', () => {
    expect(() => chunkArray([1], 0)).toThrow('chunk size must be greater than 0');
  });
});

describe('redisMget', () => {
  it('returns empty for no keys', async () => {
    const client = {
      get: async () => 'x',
      mget: async () => ['should-not-run'],
    };
    await expect(redisMget(client, [])).resolves.toEqual([]);
  });

  it('uses GET for a single key', async () => {
    const client = {
      get: async (key: string) => `got:${key}`,
      mget: async () => {
        throw new Error('mget should not be used for a single key');
      },
    };
    await expect(redisMget(client, ['only'])).resolves.toEqual(['got:only']);
  });

  it('chunks large MGET lists so spread never exceeds the command size', async () => {
    const mgetSizes: number[] = [];
    const n = REDIS_COMMAND_ARG_CHUNK_SIZE * 2 + 7;
    const store = new Map<string, string>();
    for (let i = 0; i < n; i++) {
      store.set(`k${i}`, `v${i}`);
    }
    const client = {
      get: async (key: string) => store.get(key) ?? null,
      mget: async (...keys: string[]) => {
        mgetSizes.push(keys.length);
        if (keys.length > REDIS_COMMAND_ARG_CHUNK_SIZE) {
          throw new RangeError('Maximum call stack size exceeded');
        }
        return keys.map((key) => store.get(key) ?? null);
      },
    };

    const keys = Array.from({ length: n }, (_, i) => `k${i}`);
    const values = await redisMget(client, keys);

    expect(values).toHaveLength(n);
    expect(values[0]).toBe('v0');
    expect(values[n - 1]).toBe(`v${n - 1}`);
    expect(mgetSizes.length).toBe(3);
    expect(mgetSizes.every((size) => size <= REDIS_COMMAND_ARG_CHUNK_SIZE)).toBe(true);
  });

  it('does not blow the JS call stack on a very large key list', async () => {
    const n = 120_000;
    const keys = Array.from({ length: n }, (_, i) => `k${i}`);
    const client = {
      get: async () => 'v',
      mget: async (...keysChunk: string[]) => keysChunk.map(() => 'v'),
    };
    const values = await redisMget(client, keys);
    expect(values).toHaveLength(n);
    expect(values[n - 1]).toBe('v');
  });

  it('falls back to GET per key on CROSSSLOT, including across chunks', async () => {
    const client = {
      get: async (key: string) => `v:${key}`,
      mget: async () => {
        throw new Error("CROSSSLOT Keys in request don't hash to the same slot");
      },
    };
    const keys = Array.from({ length: REDIS_COMMAND_ARG_CHUNK_SIZE + 1 }, (_, i) => `k${i}`);
    const values = await redisMget(client, keys);
    expect(values).toHaveLength(REDIS_COMMAND_ARG_CHUNK_SIZE + 1);
    expect(values[0]).toBe('v:k0');
    expect(values[REDIS_COMMAND_ARG_CHUNK_SIZE]).toBe(`v:k${REDIS_COMMAND_ARG_CHUNK_SIZE}`);
  });
});

describe('redisDel', () => {
  it('chunks large DEL lists', async () => {
    const delSizes: number[] = [];
    const n = REDIS_COMMAND_ARG_CHUNK_SIZE + 2;
    const client = {
      del: async (...keys: string[]) => {
        delSizes.push(keys.length);
        if (keys.length > REDIS_COMMAND_ARG_CHUNK_SIZE) {
          throw new RangeError('Maximum call stack size exceeded');
        }
        return keys.length;
      },
    };
    await redisDel(client, Array.from({ length: n }, (_, i) => `k${i}`));
    expect(delSizes).toEqual([REDIS_COMMAND_ARG_CHUNK_SIZE, 2]);
  });
});
