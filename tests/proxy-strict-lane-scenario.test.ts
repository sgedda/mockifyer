import {
  ENV_VARS,
  resolveProxyStrictLaneScenario,
} from '@sgedda/mockifyer-core';

describe('resolveProxyStrictLaneScenario', () => {
  const LANE_KEY = ENV_VARS.MOCK_STRICT_LANE_SCENARIO;

  it('defaults to true when proxy.baseUrl is set', () => {
    expect(
      resolveProxyStrictLaneScenario({
        proxy: { baseUrl: 'http://localhost:3002' },
      })
    ).toBe(true);
  });

  it('defaults to false when no proxy', () => {
    expect(resolveProxyStrictLaneScenario({})).toBe(false);
  });

  it('respects proxy.strictLaneScenario: false', () => {
    expect(
      resolveProxyStrictLaneScenario({
        proxy: { baseUrl: 'http://localhost:3002', strictLaneScenario: false },
      })
    ).toBe(false);
  });

  it('env wins over config', () => {
    const prev = process.env[LANE_KEY];
    process.env[LANE_KEY] = 'false';
    try {
      expect(
        resolveProxyStrictLaneScenario({
          proxy: { baseUrl: 'http://localhost:3002', strictLaneScenario: true },
        })
      ).toBe(false);
    } finally {
      if (prev === undefined) delete process.env[LANE_KEY];
      else process.env[LANE_KEY] = prev;
    }
  });
});
