import {
  buildClusterNatMapToEndpoint,
  extractNodesFromClusterSlots,
  parseRedisUrl,
  resetRedisClusterModeCacheForTests,
  resolveRedisClusterMode,
  shouldBuildClusterNatMap,
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

describe('extractNodesFromClusterSlots', () => {
  it('parses flat CLUSTER SLOTS host/port pairs', () => {
    const slots = [[0, 5460, '108.141.197.203', 8502, '10.0.0.4', 8502]];
    expect(extractNodesFromClusterSlots(slots)).toEqual([
      { host: '108.141.197.203', port: 8502 },
      { host: '10.0.0.4', port: 8502 },
    ]);
  });
});

describe('buildClusterNatMapToEndpoint', () => {
  it('maps discovered nodes to the configured endpoint', () => {
    expect(
      buildClusterNatMapToEndpoint(
        [{ host: '10.0.0.4', port: 8502 }],
        { host: 'myredis.example.com', port: 6380 }
      )
    ).toEqual({
      'myredis.example.com:6380': { host: 'myredis.example.com', port: 6380 },
      '10.0.0.4:8502': { host: 'myredis.example.com', port: 6380 },
    });
  });
});

describe('shouldBuildClusterNatMap', () => {
  const prev = process.env.MOCKIFYER_REDIS_CLUSTER_NAT_MAP;

  afterEach(() => {
    if (prev === undefined) delete process.env.MOCKIFYER_REDIS_CLUSTER_NAT_MAP;
    else process.env.MOCKIFYER_REDIS_CLUSTER_NAT_MAP = prev;
  });

  it('skips nat map for local loopback endpoints', () => {
    expect(
      shouldBuildClusterNatMap(
        { host: '127.0.0.1', port: 7000 },
        [{ host: '172.17.0.2', port: 7000 }]
      )
    ).toBe(false);
  });

  it('enables nat map when cluster announces private IPs to a public hostname', () => {
    expect(
      shouldBuildClusterNatMap(
        { host: 'myredis.example.com', port: 6380 },
        [{ host: '10.0.0.4', port: 8502 }]
      )
    ).toBe(true);
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
