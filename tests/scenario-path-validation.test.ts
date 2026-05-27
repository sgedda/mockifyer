import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createScenario,
  getScenarioFolderPath,
  saveScenarioConfig,
  validateScenarioName,
} from '../packages/mockifyer-core/src/utils/scenario';
import {
  readDomainPathRulesFile,
  writeDomainPathRulesFile,
} from '../packages/mockifyer-dashboard/src/utils/domain-path-rules-store';

describe('scenario path validation', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenario-path-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('rejects scenario names that can escape the mock-data root', () => {
    expect(() => validateScenarioName('../escape')).toThrow(/Invalid scenario name/);
    expect(() => getScenarioFolderPath(tmpRoot, '../escape')).toThrow(/Invalid scenario name/);
    expect(() => createScenario(tmpRoot, '../escape')).toThrow(/Invalid scenario name/);
    expect(() => saveScenarioConfig(tmpRoot, '../escape')).toThrow(/Invalid scenario name/);
  });

  it('keeps dashboard domain-path rules inside validated scenario folders', () => {
    expect(() => writeDomainPathRulesFile(tmpRoot, '../escape', {})).toThrow(/Invalid scenario name/);
    expect(() => readDomainPathRulesFile(tmpRoot, '../escape')).toThrow(/Invalid scenario name/);
  });

  it('allows the existing safe scenario alphabet', () => {
    const scenario = validateScenarioName('feature_123-a');
    expect(scenario).toBe('feature_123-a');
    expect(getScenarioFolderPath(tmpRoot, scenario)).toBe(path.join(tmpRoot, scenario));
  });
});
