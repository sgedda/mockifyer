import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readDomainPathRulesFile,
  writeDomainPathRulesFile,
  DOMAIN_PATH_RULES_FILENAME,
} from '../packages/mockifyer-dashboard/src/utils/domain-path-rules-store';

describe('domain-path-rules-store', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-dpr-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('writes and reads rules under scenario folder', () => {
    const rules = {
      'pokeapi.co': { recordResponses: true, autoMock: true, updatedAt: '2026-01-01T00:00:00.000Z' },
    };
    writeDomainPathRulesFile(tmpRoot, 'default', rules);
    const filePath = path.join(tmpRoot, 'default', DOMAIN_PATH_RULES_FILENAME);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(readDomainPathRulesFile(tmpRoot, 'default')).toEqual(rules);
  });

  it('removes file when rules are cleared', () => {
    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: false },
    });
    writeDomainPathRulesFile(tmpRoot, 'default', {});
    const filePath = path.join(tmpRoot, 'default', DOMAIN_PATH_RULES_FILENAME);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
