import {
  getCurrentScenario,
  setScenarioLaunchOverride,
  initializeScenario,
  resetScenario,
} from '@sgedda/mockifyer-core';
import { ENV_VARS } from '@sgedda/mockifyer-core';

describe('scenario launch override', () => {
  const prevEnv = process.env[ENV_VARS.MOCK_SCENARIO];

  afterEach(() => {
    setScenarioLaunchOverride(null);
    resetScenario();
    if (prevEnv !== undefined) {
      process.env[ENV_VARS.MOCK_SCENARIO] = prevEnv;
    } else {
      delete process.env[ENV_VARS.MOCK_SCENARIO];
    }
  });

  it('returns launch override before env and config', () => {
    process.env[ENV_VARS.MOCK_SCENARIO] = 'from-env';
    initializeScenario({
      mockDataPath: '/tmp/mock-data',
      scenarios: { default: 'from-config' },
    } as any);

    setScenarioLaunchOverride('e2e-scenario');
    expect(getCurrentScenario()).toBe('e2e-scenario');
  });

  it('clears when set to null or empty', () => {
    process.env[ENV_VARS.MOCK_SCENARIO] = 'from-env';
    setScenarioLaunchOverride('temp');
    expect(getCurrentScenario()).toBe('temp');

    setScenarioLaunchOverride(null);
    expect(getCurrentScenario()).toBe('from-env');

    setScenarioLaunchOverride('   ');
    expect(getCurrentScenario()).toBe('from-env');
  });
});
