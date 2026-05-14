import {
  ENV_VARS,
  isExplicitProxyScenarioContext,
  resolveStrictScenarioResolution,
  resolveStrictScenarioResolutionFromEnv,
} from '@sgedda/mockifyer-core';

describe('strict proxy scenario', () => {
  const STRICT_KEY = ENV_VARS.MOCK_STRICT_SCENARIO;

  describe('resolveStrictScenarioResolutionFromEnv', () => {
    it('interprets true-like values', () => {
      expect(resolveStrictScenarioResolutionFromEnv({ [STRICT_KEY]: 'true' })).toBe(true);
      expect(resolveStrictScenarioResolutionFromEnv({ [STRICT_KEY]: '1' })).toBe(true);
    });

    it('interprets false-like values', () => {
      expect(resolveStrictScenarioResolutionFromEnv({ [STRICT_KEY]: 'false' })).toBe(false);
    });

    it('returns undefined when unset', () => {
      expect(resolveStrictScenarioResolutionFromEnv({ [STRICT_KEY]: undefined })).toBe(undefined);
      expect(resolveStrictScenarioResolutionFromEnv(undefined)).toBe(undefined);
    });
  });

  it('defaults strict resolution false without env or config flag', () => {
    expect(resolveStrictScenarioResolution({})).toBe(false);
  });

  it('when strict proxy + dashboard URL, lane or scenario is required', () => {
    const strict = true;
    expect(
      isExplicitProxyScenarioContext({
        strictScenarioResolution: strict,
        proxy: { baseUrl: 'http://localhost:3002/api' },
        clientId: 'lane-a',
      })
    ).toBe(true);

    expect(
      isExplicitProxyScenarioContext({
        strictScenarioResolution: strict,
        proxy: { baseUrl: 'http://localhost:3002/api', scenario: 'e2e' },
      })
    ).toBe(true);

    expect(
      isExplicitProxyScenarioContext({
        strictScenarioResolution: strict,
        proxy: { baseUrl: 'http://localhost:3002/api' },
      })
    ).toBe(false);
  });

  it('without strict enabled, proxy base alone is acceptable', () => {
    expect(
      isExplicitProxyScenarioContext({
        strictScenarioResolution: false,
        proxy: { baseUrl: 'http://localhost:3002/api' },
      })
    ).toBe(true);
  });

  it('reads MOCKIFYER_STRICT_SCENARIO from process.env when set', () => {
    const prev = process.env[STRICT_KEY];
    process.env[STRICT_KEY] = 'yes';
    try {
      expect(resolveStrictScenarioResolution({ strictScenarioResolution: false })).toBe(true);
    } finally {
      if (prev === undefined) {
        delete process.env[STRICT_KEY];
      } else {
        process.env[STRICT_KEY] = prev;
      }
    }
  });

});
