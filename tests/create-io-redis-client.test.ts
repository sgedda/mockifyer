import {
  parseRedisUrl,
  resetRedisClusterModeCacheForTests,
  resolveRedisClusterMode,
} from '@sgedda/mockifyer-core';

describe('parseRedisUrl', () => {
  it('parses redis URL with auth', () => {
    expect(parseRedisUrl('redis://user:secret@myhost:8502')).toEqual({
      host: 'myhost',
      port: 8502,
      username: 'user',
      password: 'secret',
    });
  });

  it('parses rediss URL with default port', () => {
    expect(parseRedisUrl('rediss://cache.example.com')).toEqual({
      host: 'cache.example.com',
      port: 6380,
      tls: {},
    });
  });
});

describe('resolveRedisClusterMode', () => {
  const prev = process.env.MOCKIFYER_REDIS_CLUSTER;

  afterEach(() => {
    resetRedisClusterModeCacheForTests();
    if (prev === undefined) delete process.env.MOCKIFYER_REDIS_CLUSTER;
    else process.env.MOCKIFYER_REDIS_CLUSTER = prev;
  });

  it('honors explicit cluster option', async () => {
    await expect(resolveRedisClusterMode('redis://127.0.0.1:6379', true)).resolves.toBe(true);
    await expect(resolveRedisClusterMode('redis://127.0.0.1:6379', false)).resolves.toBe(false);
  });

  it('honors MOCKIFYER_REDIS_CLUSTER env', async () => {
    process.env.MOCKIFYER_REDIS_CLUSTER = 'true';
    await expect(resolveRedisClusterMode('redis://127.0.0.1:6379')).resolves.toBe(true);
    process.env.MOCKIFYER_REDIS_CLUSTER = 'false';
    await expect(resolveRedisClusterMode('redis://127.0.0.1:6379')).resolves.toBe(false);
  });
});
