import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createScenario,
  getScenarioFolderPath,
  listScenarios,
  validateScenarioName,
} from '@sgedda/mockifyer-core';

describe('scenario name validation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenario-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts trimmed filesystem-safe scenario names', () => {
    expect(validateScenarioName(' e2e_login-1 ')).toEqual({ ok: true, value: 'e2e_login-1' });
  });

  it('rejects traversal scenario names before building paths', () => {
    expect(() => getScenarioFolderPath(tmpDir, '../../outside')).toThrow('Invalid scenario name');
    expect(() => createScenario(tmpDir, '../outside')).toThrow('Invalid scenario name');
    expect(fs.existsSync(path.resolve(tmpDir, '..', 'outside'))).toBe(false);
  });

  it('does not list invalid scenario directory names', () => {
    fs.mkdirSync(path.join(tmpDir, 'default'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'valid_1'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'invalid name'), { recursive: true });

    expect(listScenarios(tmpDir)).toEqual(['default', 'valid_1']);
  });
});
