import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SCENARIO_BUNDLE_FORMAT_VERSION,
  applyScenarioImport,
  type ScenarioExportBundle,
} from '../packages/mockifyer-dashboard/src/utils/scenario-bundle';
import {
  clearMirroredMocksForScenario,
  deleteMirroredMockFromDisk,
} from '../packages/mockifyer-dashboard/src/utils/redis-disk-mirror';

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

  it('deletes a Redis disk mirror by hash', () => {
    const scenario = 'default';
    const hash = 'a'.repeat(64);
    const mirrorPath = path.join(tmpDir, scenario, 'redis', `${hash}.json`);
    fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
    fs.writeFileSync(mirrorPath, JSON.stringify(makeMock('https://api.example.com/mirrored'), null, 2));

    expect(deleteMirroredMockFromDisk({ mockDataPath: tmpDir, scenarioName: scenario, hash })).toBe(true);
    expect(fs.existsSync(mirrorPath)).toBe(false);
  });

  it('clears Redis disk mirrors for a scenario without removing other scenario files', () => {
    const scenario = 'default';
    const mirrorPath = path.join(tmpDir, scenario, 'redis', `${'b'.repeat(64)}.json`);
    const regularPath = path.join(tmpDir, scenario, 'regular.json');
    fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
    fs.writeFileSync(mirrorPath, JSON.stringify(makeMock('https://api.example.com/mirrored'), null, 2));
    fs.writeFileSync(regularPath, JSON.stringify(makeMock('https://api.example.com/regular'), null, 2));

    clearMirroredMocksForScenario(tmpDir, scenario);

    expect(fs.existsSync(mirrorPath)).toBe(false);
    expect(fs.existsSync(regularPath)).toBe(true);
  });
});
