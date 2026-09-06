import {
  DEFAULT_MAX_MOCKS_PER_PATH,
  ENV_VARS,
  buildMockPathCardinalitySegment,
  decideRedisMockWriteLimits,
  getMaxMocksPerPathFromEnv,
  getMaxRequestsPerScenarioFromEnv,
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
});
