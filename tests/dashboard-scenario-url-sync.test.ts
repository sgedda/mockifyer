import { planScenarioUrlSync } from '../packages/mockifyer-dashboard/frontend/src/lib/dashboard-urls';

describe('planScenarioUrlSync', () => {
  const base = {
    urlScenario: null as string | null,
    scenario: 'default',
    switchingScenario: false,
    rejectedUrlScenario: null as string | null,
  };

  it('does not stamp placeholder default onto the URL before scenario-config loads', () => {
    expect(
      planScenarioUrlSync({
        ...base,
        scenarioConfigReady: false,
        urlScenario: null,
        scenario: 'default',
      })
    ).toEqual({ action: 'none' });
  });

  it('does not POST URL default back while still waiting for scenario-config', () => {
    expect(
      planScenarioUrlSync({
        ...base,
        scenarioConfigReady: false,
        urlScenario: 'default',
        scenario: 'production',
      })
    ).toEqual({ action: 'none' });
  });

  it('stamps the loaded scenario after config is ready when the URL has none', () => {
    expect(
      planScenarioUrlSync({
        ...base,
        scenarioConfigReady: true,
        urlScenario: null,
        scenario: 'production',
      })
    ).toEqual({ action: 'stamp-url', scenario: 'production' });
  });

  it('applies an explicit URL scenario once config is ready', () => {
    expect(
      planScenarioUrlSync({
        ...base,
        scenarioConfigReady: true,
        urlScenario: 'staging',
        scenario: 'production',
      })
    ).toEqual({ action: 'apply-url', urlScenario: 'staging' });
  });

  it('does nothing when URL and loaded scenario already match', () => {
    expect(
      planScenarioUrlSync({
        ...base,
        scenarioConfigReady: true,
        urlScenario: 'production',
        scenario: 'production',
      })
    ).toEqual({ action: 'none' });
  });

  it('does not retry a scenario the set API already rejected', () => {
    expect(
      planScenarioUrlSync({
        ...base,
        scenarioConfigReady: true,
        urlScenario: 'missing',
        scenario: 'production',
        rejectedUrlScenario: 'missing',
      })
    ).toEqual({ action: 'none' });
  });

  it('does not apply URL while a scenario switch is in flight', () => {
    expect(
      planScenarioUrlSync({
        ...base,
        scenarioConfigReady: true,
        urlScenario: 'staging',
        scenario: 'production',
        switchingScenario: true,
      })
    ).toEqual({ action: 'none' });
  });

  it('after config is ready, an explicit ?scenario=default still wins over the loaded name', () => {
    expect(
      planScenarioUrlSync({
        ...base,
        scenarioConfigReady: true,
        urlScenario: 'default',
        scenario: 'production',
      })
    ).toEqual({ action: 'apply-url', urlScenario: 'default' });
  });
});
