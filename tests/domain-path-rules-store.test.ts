import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  applyDomainPathRuleMutation,
  loadMergedDomainPathRules,
  mergeDomainPathRulesMaps,
  persistMergedDomainPathRules,
  readDomainPathRulesFile,
  writeDomainPathRulesFile,
  DOMAIN_PATH_RULES_FILENAME,
} from '../packages/mockifyer-dashboard/src/utils/domain-path-rules-store';
import type { DomainPathRulesMap } from '../packages/mockifyer-core/src';

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

  it('mergeDomainPathRulesMaps prefers centralized keys on conflict', () => {
    const fromFile: DomainPathRulesMap = {
      'api.example.com': { recordResponses: false, autoMock: false },
      'api.example.com/v1/users/:id': { recordResponses: true, autoMock: true },
    };
    const fromCentralized: DomainPathRulesMap = {
      'api.example.com': { recordResponses: true, autoMock: true },
    };
    expect(mergeDomainPathRulesMaps(fromFile, fromCentralized)).toEqual({
      'api.example.com': { recordResponses: true, autoMock: true },
      'api.example.com/v1/users/:id': { recordResponses: true, autoMock: true },
    });
  });

  it('applyDomainPathRuleMutation upserts and deletes without mutating input', () => {
    const base: DomainPathRulesMap = {
      'api.example.com': { recordResponses: true, autoMock: true },
    };
    const updated = applyDomainPathRuleMutation(base, 'api.example.com/v1', {
      recordResponses: false,
      autoMock: false,
    });
    expect(base['api.example.com/v1']).toBeUndefined();
    expect(updated['api.example.com/v1']?.recordResponses).toBe(false);
    expect(updated['api.example.com/v1']?.updatedAt).toEqual(expect.any(String));

    const cleared = applyDomainPathRuleMutation(updated, 'api.example.com/v1', null);
    expect(cleared['api.example.com/v1']).toBeUndefined();
    expect(cleared['api.example.com']).toEqual(base['api.example.com']);
  });

  it('persistMergedDomainPathRules keeps file-only discovery keys after a store mutation', async () => {
    const fileOnly: DomainPathRulesMap = {
      'api.example.com': { recordResponses: true, autoMock: true },
      'api.example.com/v1/users/:id': { recordResponses: true, autoMock: true },
    };
    writeDomainPathRulesFile(tmpRoot, 'default', fileOnly);

    let storeRules: DomainPathRulesMap = {
      'api.example.com': { recordResponses: true, autoMock: true },
    };
    const store = {
      getDomainPathRules: async () => ({ ...storeRules }),
      replaceDomainPathRules: async (_scenario: string, rules: DomainPathRulesMap) => {
        storeRules = { ...rules };
      },
    };

    const merged = await loadMergedDomainPathRules(store, tmpRoot, 'default');
    const next = applyDomainPathRuleMutation(merged, 'api.example.com', {
      recordResponses: true,
      autoMock: false,
    });
    await persistMergedDomainPathRules(store, tmpRoot, 'default', next);

    const onDisk = readDomainPathRulesFile(tmpRoot, 'default');
    expect(onDisk['api.example.com/v1/users/:id']).toEqual({
      recordResponses: true,
      autoMock: true,
    });
    expect(onDisk['api.example.com']?.autoMock).toBe(false);
    expect(storeRules['api.example.com/v1/users/:id']).toEqual({
      recordResponses: true,
      autoMock: true,
    });
    expect(storeRules['api.example.com']?.autoMock).toBe(false);
  });
});
