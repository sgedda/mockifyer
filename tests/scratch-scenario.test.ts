import {
  SCRATCH_SCENARIO,
  DEFAULT_SCENARIO,
  getCurrentScenario,
  getScratchScenarioTtlSec,
  isScratchScenario,
  assertNotReservedScenarioName,
  createScenario,
  resetScenario,
  SCRATCH_SCENARIO_DEFAULT_TTL_SEC,
  ENV_VARS,
} from '@sgedda/mockifyer-core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('scratch scenario (unscoped ephemeral)', () => {
  const prevScenario = process.env[ENV_VARS.MOCK_SCENARIO];
  const prevTtl = process.env[ENV_VARS.MOCK_SCRATCH_SCENARIO_TTL_SEC];

  afterEach(() => {
    resetScenario();
    if (prevScenario !== undefined) {
      process.env[ENV_VARS.MOCK_SCENARIO] = prevScenario;
    } else {
      delete process.env[ENV_VARS.MOCK_SCENARIO];
    }
    if (prevTtl !== undefined) {
      process.env[ENV_VARS.MOCK_SCRATCH_SCENARIO_TTL_SEC] = prevTtl;
    } else {
      delete process.env[ENV_VARS.MOCK_SCRATCH_SCENARIO_TTL_SEC];
    }
  });

  it('falls back to _scratch when nothing is configured', () => {
    delete process.env[ENV_VARS.MOCK_SCENARIO];
    expect(getCurrentScenario()).toBe(SCRATCH_SCENARIO);
    expect(isScratchScenario(getCurrentScenario())).toBe(true);
  });

  it('keeps explicit default durable (not scratch)', () => {
    process.env[ENV_VARS.MOCK_SCENARIO] = DEFAULT_SCENARIO;
    expect(getCurrentScenario()).toBe(DEFAULT_SCENARIO);
    expect(isScratchScenario(DEFAULT_SCENARIO)).toBe(false);
  });

  it('rejects creating a scenario named _scratch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scratch-'));
    expect(() => createScenario(dir, SCRATCH_SCENARIO)).toThrow(/temporary unscoped/);
    expect(() => assertNotReservedScenarioName(SCRATCH_SCENARIO)).toThrow(/temporary unscoped/);
    expect(() => assertNotReservedScenarioName(SCRATCH_SCENARIO, { allowScratch: true })).not.toThrow();
  });

  it('reads MOCKIFYER_SCRATCH_SCENARIO_TTL_SEC', () => {
    delete process.env[ENV_VARS.MOCK_SCRATCH_SCENARIO_TTL_SEC];
    expect(getScratchScenarioTtlSec()).toBe(SCRATCH_SCENARIO_DEFAULT_TTL_SEC);
    process.env[ENV_VARS.MOCK_SCRATCH_SCENARIO_TTL_SEC] = '3600';
    expect(getScratchScenarioTtlSec()).toBe(3600);
    process.env[ENV_VARS.MOCK_SCRATCH_SCENARIO_TTL_SEC] = 'nope';
    expect(getScratchScenarioTtlSec()).toBe(SCRATCH_SCENARIO_DEFAULT_TTL_SEC);
  });
});
