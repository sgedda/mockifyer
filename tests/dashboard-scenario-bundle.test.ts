import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SCENARIO_BUNDLE_FORMAT_VERSION,
  applyScenarioImport,
  buildFilesystemScenarioBundle,
  type ScenarioExportBundle,
} from '../packages/mockifyer-dashboard/src/utils/scenario-bundle';
import { DOMAIN_PATH_RULES_FILENAME } from '../packages/mockifyer-dashboard/src/utils/domain-path-rules-store';

const EXPORT_TIMESTAMP = '2026-05-14T00:00:00.000Z';

function makeMock(url: string, scenario = 'default') {
  return {
    request: {
      method: 'GET',
      url,
      headers: {},
      queryParams: {},
    },
    response: {
      status: 200,
      data: { ok: true },
      headers: {},
    },
    timestamp: EXPORT_TIMESTAMP,
    scenario,
  };
}

function writeDomainPathRules(scenarioDir: string, rules: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(scenarioDir, DOMAIN_PATH_RULES_FILENAME),
    `${JSON.stringify(rules, null, 2)}\n`,
    'utf-8'
  );
}

describe('dashboard scenario bundle import', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-import-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not clear existing mocks when a replace import has an invalid filesystem path', async () => {
    const scenario = 'default';
    const scenarioDir = path.join(tmpDir, scenario);
    const existingPath = path.join(scenarioDir, 'existing.json');
    fs.mkdirSync(scenarioDir, { recursive: true });
    fs.writeFileSync(existingPath, JSON.stringify(makeMock('https://api.example.com/existing'), null, 2));

    const bundle: ScenarioExportBundle = {
      formatVersion: SCENARIO_BUNDLE_FORMAT_VERSION,
      exportedAt: EXPORT_TIMESTAMP,
      sourceScenario: scenario,
      dashboardProvider: 'filesystem',
      dateManipulation: null,
      proxyConfig: null,
      mocks: [
        {
          relativePath: '../escape.json',
          data: makeMock('https://api.example.com/escape'),
        },
      ],
    };

    await expect(
      applyScenarioImport({
        mockDataPath: tmpDir,
        targetScenario: scenario,
        bundle,
        replaceExistingMocks: true,
        applyDateConfig: false,
        bundleHadDateKey: false,
        applyProxyConfig: false,
        bundleHadProxyKey: false,
        applyDomainPathRules: true,
        bundleHadDomainPathRulesKey: false,
        provider: 'filesystem',
      })
    ).rejects.toThrow('Invalid mock path in bundle: ../escape.json');

    expect(fs.existsSync(existingPath)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'escape.json'))).toBe(false);
  });

  it('exports and restores domain-path-rules on filesystem round-trip', async () => {
    const scenario = 'demo';
    const scenarioDir = path.join(tmpDir, scenario);
    fs.mkdirSync(scenarioDir, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioDir, 'weather.json'),
      JSON.stringify(makeMock('https://api.weather.com/v1/forecast', scenario), null, 2)
    );
    writeDomainPathRules(scenarioDir, {
      'api.weather.com': {
        recordResponses: true,
        autoMock: true,
        updatedAt: EXPORT_TIMESTAMP,
      },
    });

    const bundle = buildFilesystemScenarioBundle(tmpDir, scenario, 'filesystem');
    expect(bundle.domainPathRules).toEqual({
      'api.weather.com': {
        recordResponses: true,
        autoMock: true,
        updatedAt: EXPORT_TIMESTAMP,
      },
    });

    const restored = 'demo-restored';
    const result = await applyScenarioImport({
      mockDataPath: tmpDir,
      targetScenario: restored,
      bundle,
      replaceExistingMocks: false,
      applyDateConfig: false,
      bundleHadDateKey: false,
      applyProxyConfig: false,
      bundleHadProxyKey: false,
      applyDomainPathRules: true,
      bundleHadDomainPathRulesKey: true,
      provider: 'filesystem',
    });

    expect(result.domainPathRulesApplied).toBe(true);
    const restoredRulesPath = path.join(tmpDir, restored, DOMAIN_PATH_RULES_FILENAME);
    expect(JSON.parse(fs.readFileSync(restoredRulesPath, 'utf-8'))).toEqual({
      'api.weather.com': {
        recordResponses: true,
        autoMock: true,
        updatedAt: EXPORT_TIMESTAMP,
      },
    });
  });

  it('replace import preserves domain-path-rules when older bundles omit them', async () => {
    const scenario = 'default';
    const scenarioDir = path.join(tmpDir, scenario);
    const existingPath = path.join(scenarioDir, 'existing.json');
    const rulesPath = path.join(scenarioDir, DOMAIN_PATH_RULES_FILENAME);
    fs.mkdirSync(scenarioDir, { recursive: true });
    fs.writeFileSync(existingPath, JSON.stringify(makeMock('https://api.example.com/existing'), null, 2));
    writeDomainPathRules(scenarioDir, {
      'api.example.com': { recordResponses: true, autoMock: false, updatedAt: EXPORT_TIMESTAMP },
    });

    const legacyBundle: ScenarioExportBundle = {
      formatVersion: SCENARIO_BUNDLE_FORMAT_VERSION,
      exportedAt: EXPORT_TIMESTAMP,
      sourceScenario: scenario,
      dashboardProvider: 'filesystem',
      dateManipulation: null,
      proxyConfig: null,
      mocks: [
        {
          relativePath: 'imported.json',
          data: makeMock('https://api.example.com/imported'),
        },
      ],
    };

    const result = await applyScenarioImport({
      mockDataPath: tmpDir,
      targetScenario: scenario,
      bundle: legacyBundle,
      replaceExistingMocks: true,
      applyDateConfig: false,
      bundleHadDateKey: false,
      applyProxyConfig: false,
      bundleHadProxyKey: false,
      applyDomainPathRules: true,
      bundleHadDomainPathRulesKey: false,
      provider: 'filesystem',
    });

    expect(result.mocksWritten).toBe(1);
    expect(result.domainPathRulesApplied).toBe(false);
    expect(fs.existsSync(existingPath)).toBe(false);
    expect(fs.existsSync(path.join(scenarioDir, 'imported.json'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(rulesPath, 'utf-8'))).toEqual({
      'api.example.com': { recordResponses: true, autoMock: false, updatedAt: EXPORT_TIMESTAMP },
    });
  });

  it('replace import applies domainPathRules from the bundle', async () => {
    const scenario = 'default';
    const scenarioDir = path.join(tmpDir, scenario);
    const rulesPath = path.join(scenarioDir, DOMAIN_PATH_RULES_FILENAME);
    fs.mkdirSync(scenarioDir, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioDir, 'old.json'),
      JSON.stringify(makeMock('https://api.example.com/old'), null, 2)
    );
    writeDomainPathRules(scenarioDir, {
      'api.old.com': { recordResponses: false, autoMock: false, updatedAt: EXPORT_TIMESTAMP },
    });

    const bundle: ScenarioExportBundle = {
      formatVersion: SCENARIO_BUNDLE_FORMAT_VERSION,
      exportedAt: EXPORT_TIMESTAMP,
      sourceScenario: scenario,
      dashboardProvider: 'filesystem',
      dateManipulation: null,
      proxyConfig: null,
      domainPathRules: {
        'api.new.com': { recordResponses: true, autoMock: true, updatedAt: EXPORT_TIMESTAMP },
      },
      mocks: [
        {
          relativePath: 'new.json',
          data: makeMock('https://api.new.com/v1'),
        },
      ],
    };

    const result = await applyScenarioImport({
      mockDataPath: tmpDir,
      targetScenario: scenario,
      bundle,
      replaceExistingMocks: true,
      applyDateConfig: false,
      bundleHadDateKey: false,
      applyProxyConfig: false,
      bundleHadProxyKey: false,
      applyDomainPathRules: true,
      bundleHadDomainPathRulesKey: true,
      provider: 'filesystem',
    });

    expect(result.domainPathRulesApplied).toBe(true);
    expect(fs.existsSync(path.join(scenarioDir, 'old.json'))).toBe(false);
    expect(JSON.parse(fs.readFileSync(rulesPath, 'utf-8'))).toEqual({
      'api.new.com': { recordResponses: true, autoMock: true, updatedAt: EXPORT_TIMESTAMP },
    });
  });
});
