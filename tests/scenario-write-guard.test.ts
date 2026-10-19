import fs from 'fs';
import os from 'os';
import path from 'path';
import { setScenarioLockedFs } from '../packages/mockifyer-core/src/utils/scenario-meta';
import {
  SCENARIO_MOCK_LOCKED_MESSAGE,
  isFilesystemScenarioWriteBlocked,
  isRedisScenarioWriteBlocked,
  isScenarioWriteBlocked,
} from '../packages/mockifyer-dashboard/src/utils/scenario-write-guard';

describe('scenario-write-guard', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-lock-guard-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blocks writes only when the scenario is locked', () => {
    expect(isScenarioWriteBlocked(false)).toBe(false);
    expect(isScenarioWriteBlocked(true)).toBe(true);
  });

  it('detects filesystem locks used by mock mutation routes', () => {
    const scenario = 'golden-demo';
    fs.mkdirSync(path.join(tmpDir, scenario), { recursive: true });
    expect(isFilesystemScenarioWriteBlocked(tmpDir, scenario)).toBe(false);

    setScenarioLockedFs(tmpDir, scenario, true);
    expect(isFilesystemScenarioWriteBlocked(tmpDir, scenario)).toBe(true);
    expect(SCENARIO_MOCK_LOCKED_MESSAGE).toMatch(/locked/i);
  });

  it('detects redis store locks used by mock mutation routes', async () => {
    const unlocked = { isScenarioLocked: async () => false };
    const locked = { isScenarioLocked: async () => true };
    await expect(isRedisScenarioWriteBlocked(unlocked, 'demo')).resolves.toBe(false);
    await expect(isRedisScenarioWriteBlocked(locked, 'demo')).resolves.toBe(true);
  });
});
