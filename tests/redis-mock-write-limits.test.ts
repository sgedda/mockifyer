import {
  DEFAULT_MAX_MOCKS_PER_PATH,
  ENV_VARS,
  buildMockPathCardinalitySegment,
  decideRedisMockWriteLimits,
  evaluateRedisMockWriteLimits,
  getMaxMocksPerPathFromEnv,
  getMaxRequestsPerScenarioFromEnv,
  partitionLiveRedisIndexMembers,
} from '@sgedda/mockifyer-core';

describe('redis mock write limits', () => {
  const prevScenario = process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO];
  const prevPath = process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH];

  afterEach(() => {
    if (prevScenario !== undefined) {
      process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO] = prevScenario;
    } else {
      delete process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO];
    }
    if (prevPath !== undefined) {
      process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH] = prevPath;
    } else {
      delete process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH];
    }
  });

  it('parses scenario max from env (unset = unlimited)', () => {
    delete process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO];
    expect(getMaxRequestsPerScenarioFromEnv()).toBeUndefined();
    process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO] = '100';
    expect(getMaxRequestsPerScenarioFromEnv()).toBe(100);
  });

  it('defaults path max to 200; 0/off disables', () => {
    delete process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH];
    expect(getMaxMocksPerPathFromEnv()).toBe(DEFAULT_MAX_MOCKS_PER_PATH);
    process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH] = '50';
    expect(getMaxMocksPerPathFromEnv()).toBe(50);
    process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH] = 'off';
    expect(getMaxMocksPerPathFromEnv()).toBeUndefined();
  });

  it('builds stable path segments ignoring query', () => {
    const a = buildMockPathCardinalitySegment(
      'POST',
      'https://host.example/api/network-events?x=1'
    );
    const b = buildMockPathCardinalitySegment('POST', 'https://host.example/api/network-events');
    const c = buildMockPathCardinalitySegment('GET', 'https://host.example/api/network-events');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('allows overwrites even when at limits', () => {
    expect(
      decideRedisMockWriteLimits({
        hashAlreadyStored: true,
        scenarioMockCount: 999,
        pathMockCount: 999,
        hashAlreadyOnPath: true,
        maxScenario: 10,
        maxPath: 10,
      }).allow
    ).toBe(true);
  });

  it('blocks new hashes at scenario or path cap', () => {
    expect(
      decideRedisMockWriteLimits({
        hashAlreadyStored: false,
        scenarioMockCount: 10,
        pathMockCount: 0,
        hashAlreadyOnPath: false,
        maxScenario: 10,
        maxPath: 200,
      })
    ).toMatchObject({ allow: false, reason: 'scenario_limit' });

    expect(
      decideRedisMockWriteLimits({
        hashAlreadyStored: false,
        scenarioMockCount: 0,
        pathMockCount: 200,
        hashAlreadyOnPath: false,
        maxScenario: undefined,
        maxPath: 200,
      })
    ).toMatchObject({ allow: false, reason: 'path_limit' });
  });

  it('partitions stale index members from expired/cleared payloads', () => {
    expect(partitionLiveRedisIndexMembers(['a', 'b', 'c'], [true, false, true])).toEqual({
      liveCount: 2,
      staleHashes: ['b'],
    });
  });

  it('allows a new hash after pruning ghost path-index members', async () => {
    const stale = ['dead-1', 'dead-2'];
    const dropped: string[] = [];
    const decision = await evaluateRedisMockWriteLimits({
      hashAlreadyStored: false,
      scenarioMockCount: 0,
      pathMockCount: 200,
      hashAlreadyOnPath: false,
      maxPath: 200,
      loadPathMembers: async () => [...stale, ...Array.from({ length: 198 }, (_, i) => `live-${i}`)],
      membersAreLive: async (hashes) => hashes.map((h) => !h.startsWith('dead-')),
      dropStale: async (_kind, hashes) => {
        dropped.push(...hashes);
      },
    });
    expect(decision.allow).toBe(true);
    expect(dropped).toEqual(stale);
  });

  it('still blocks when live path members remain at the cap', async () => {
    const live = Array.from({ length: 200 }, (_, i) => `live-${i}`);
    const decision = await evaluateRedisMockWriteLimits({
      hashAlreadyStored: false,
      scenarioMockCount: 0,
      pathMockCount: 200,
      hashAlreadyOnPath: false,
      maxPath: 200,
      loadPathMembers: async () => live,
      membersAreLive: async (hashes) => hashes.map(() => true),
    });
    expect(decision).toMatchObject({ allow: false, reason: 'path_limit' });
  });
});
