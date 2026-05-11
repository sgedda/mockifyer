import fs from 'fs';
import os from 'os';
import path from 'path';
import { getCurrentScenario, resetScenario } from '@sgedda/mockifyer-core';

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
