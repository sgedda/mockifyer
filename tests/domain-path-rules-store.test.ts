import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readDomainPathRulesFile,
  writeDomainPathRulesFile,
  updateDomainPathRulesFile,
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

  it('locked update preserves a flag change and a new discovery key', async () => {
    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: false, autoMock: false },
    });

    await Promise.all([
      updateDomainPathRulesFile(tmpRoot, 'default', (rules) => ({
        ...rules,
        'api.example.com': { recordResponses: true, autoMock: true },
      })),
      updateDomainPathRulesFile(tmpRoot, 'default', (rules) => ({
        ...rules,
        'api.example.com/v1': { recordResponses: false, autoMock: false },
      })),
    ]);

    const onDisk = readDomainPathRulesFile(tmpRoot, 'default');
    expect(onDisk['api.example.com'].recordResponses).toBe(true);
    expect(onDisk['api.example.com/v1']).toEqual({
      recordResponses: false,
      autoMock: false,
    });
  });
});
