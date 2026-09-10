import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readDomainPathRulesFile,
  writeDomainPathRulesFile,
  tryMirrorDomainPathRulesToDisk,
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

  it('mirrors rules when mockDataPath already exists as a directory', () => {
    const rules = {
      'bwoty-origo-two-preprod-sc.azurewebsites.net': {
        recordResponses: true,
        autoMock: true,
      },
    };
    const wrote = tryMirrorDomainPathRulesToDisk(tmpRoot, 'different-kind-of-trips', rules);
    expect(wrote).toBe(true);
    expect(
      readDomainPathRulesFile(tmpRoot, 'different-kind-of-trips')
    ).toEqual(expect.objectContaining({
      'bwoty-origo-two-preprod-sc.azurewebsites.net': expect.objectContaining({
        recordResponses: true,
        autoMock: true,
      }),
    }));
  });

  it('skips mkdir when mockDataPath does not exist (Redis dashboard dummy path)', () => {
    const missingRoot = path.join(tmpRoot, 'not-created', 'mock-data');
    const wrote = tryMirrorDomainPathRulesToDisk(missingRoot, 'different-kind-of-trips', {
      'api.example.com': { recordResponses: true, autoMock: true },
    });
    expect(wrote).toBe(false);
    expect(fs.existsSync(missingRoot)).toBe(false);
    expect(fs.existsSync(path.join(missingRoot, 'different-kind-of-trips'))).toBe(false);
  });

  it('does not throw when mockDataPath is a file so mkdir of the scenario folder would fail', () => {
    const notADir = path.join(tmpRoot, 'mock-data-file');
    fs.writeFileSync(notADir, 'not a directory');
    expect(() => {
      tryMirrorDomainPathRulesToDisk(
        notADir,
        'different-kind-of-trips',
        { 'api.example.com': { recordResponses: true } },
        { force: true }
      );
    }).not.toThrow();
    expect(fs.statSync(notADir).isFile()).toBe(true);
  });
});
