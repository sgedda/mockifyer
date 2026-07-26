import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getCurrentScenario,
  isValidScenarioName,
  parseScenarioName,
  resetScenario,
} from '@sgedda/mockifyer-core';

describe('client-specific scenario config', () => {
  let tmp: string;
  let originalScenario: string | undefined;

  beforeEach(() => {
    originalScenario = process.env.MOCKIFYER_SCENARIO;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenario-client-'));
    delete process.env.MOCKIFYER_SCENARIO;
    resetScenario();
  });

  afterEach(() => {
    resetScenario();
    fs.rmSync(tmp, { recursive: true, force: true });
    if (originalScenario === undefined) {
      delete process.env.MOCKIFYER_SCENARIO;
    } else {
      process.env.MOCKIFYER_SCENARIO = originalScenario;
    }
  });

  it('uses a client-specific scenario config for safe client ids', () => {
    const mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(mockDataPath, { recursive: true });
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: 'global' })
    );
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.lane-a.json'),
      JSON.stringify({ currentScenario: 'lane-a-scenario' })
    );

    expect(getCurrentScenario(mockDataPath, '  lane-a  ')).toBe('lane-a-scenario');
  });

  it('does not let client ids read scenario configs outside mockDataPath', () => {
    const mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(mockDataPath, { recursive: true });
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: 'safe-global' })
    );
    fs.writeFileSync(
      path.join(tmp, 'outside.json'),
      JSON.stringify({ currentScenario: 'outside-scenario' })
    );

    expect(getCurrentScenario(mockDataPath, '../../../outside')).toBe('safe-global');
  });
});

describe('parseScenarioName', () => {
  it('accepts safe scenario names and rejects traversal / reserved values', () => {
    expect(isValidScenarioName('check-in_open')).toBe(true);
    expect(parseScenarioName('  check-in_open  ')).toBe('check-in_open');
    expect(parseScenarioName('..')).toBeNull();
    expect(parseScenarioName('../escape')).toBeNull();
    expect(parseScenarioName('foo/bar')).toBeNull();
    expect(parseScenarioName('pool')).toBeNull();
    expect(parseScenarioName('')).toBeNull();
    expect(parseScenarioName(null)).toBeNull();
  });
});
