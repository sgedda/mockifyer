import fs from 'fs';
import os from 'os';
import path from 'path';
import { setScenarioLockedFs } from '../packages/mockifyer-core/src/utils/scenario-meta';
import {
  SCENARIO_BUNDLE_FORMAT_VERSION,
  ScenarioLockedError,
  applyScenarioImport,
  type ScenarioExportBundle,
} from '../packages/mockifyer-dashboard/src/utils/scenario-bundle';

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
        provider: 'filesystem',
      })
    ).rejects.toThrow('Invalid mock path in bundle: ../escape.json');

    expect(fs.existsSync(existingPath)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'escape.json'))).toBe(false);
  });

  it('rejects import into a locked scenario without clearing or writing mocks', async () => {
    const scenario = 'demo-locked';
    const scenarioDir = path.join(tmpDir, scenario);
    const existingPath = path.join(scenarioDir, 'existing.json');
    fs.mkdirSync(scenarioDir, { recursive: true });
    fs.writeFileSync(existingPath, JSON.stringify(makeMock('https://api.example.com/existing', scenario), null, 2));
    setScenarioLockedFs(tmpDir, scenario, true);

    const bundle: ScenarioExportBundle = {
      formatVersion: SCENARIO_BUNDLE_FORMAT_VERSION,
      exportedAt: EXPORT_TIMESTAMP,
      sourceScenario: scenario,
      dashboardProvider: 'filesystem',
      dateManipulation: null,
      proxyConfig: null,
      mocks: [
        {
          relativePath: 'imported.json',
          data: makeMock('https://api.example.com/imported', scenario),
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
        provider: 'filesystem',
      })
    ).rejects.toBeInstanceOf(ScenarioLockedError);

    expect(fs.existsSync(existingPath)).toBe(true);
    expect(fs.existsSync(path.join(scenarioDir, 'imported.json'))).toBe(false);
  });
});
