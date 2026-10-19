import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SCENARIO_BUNDLE_FORMAT_VERSION,
  applyScenarioImport,
  clearScenarioMocks,
  deleteEntireScenario,
  renameEntireScenario,
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
});

describe('clearScenarioMocks', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-clear-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes recorded mocks and keeps the empty scenario plus metadata', async () => {
    const scenario = 'staging';
    const scenarioDir = path.join(tmpDir, scenario);
    const nested = path.join(scenarioDir, 'api.example.com');
    fs.mkdirSync(nested, { recursive: true });

    const mockPath = path.join(nested, 'get-users.json');
    const datePath = path.join(scenarioDir, 'date-config.json');
    const metaPath = path.join(scenarioDir, 'scenario-meta.json');
    const rulesPath = path.join(scenarioDir, 'domain-path-rules.json');
    const notesPath = path.join(scenarioDir, 'notes.json');

    fs.writeFileSync(mockPath, JSON.stringify(makeMock('https://api.example.com/users', scenario), null, 2));
    fs.writeFileSync(
      datePath,
      JSON.stringify({ dateManipulation: { offset: 86400 }, updatedAt: EXPORT_TIMESTAMP }, null, 2)
    );
    fs.writeFileSync(metaPath, JSON.stringify({ locked: false, updatedAt: EXPORT_TIMESTAMP }, null, 2));
    fs.writeFileSync(rulesPath, JSON.stringify({ mode: 'allowlist', rules: [] }, null, 2));
    fs.writeFileSync(notesPath, JSON.stringify({ note: 'not a mock' }, null, 2));

    const result = await clearScenarioMocks({
      mockDataPath: tmpDir,
      scenario,
      provider: 'filesystem',
    });

    expect(result.mocksRemoved).toBe(1);
    expect(fs.existsSync(mockPath)).toBe(false);
    expect(fs.existsSync(scenarioDir)).toBe(true);
    expect(JSON.parse(fs.readFileSync(datePath, 'utf-8')).dateManipulation.offset).toBe(86400);
    expect(JSON.parse(fs.readFileSync(metaPath, 'utf-8')).locked).toBe(false);
    expect(fs.existsSync(rulesPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(notesPath, 'utf-8')).note).toBe('not a mock');
  });

  it('returns zero when the scenario folder has no mocks and still exists', async () => {
    const scenario = 'empty-one';
    const scenarioDir = path.join(tmpDir, scenario);
    fs.mkdirSync(scenarioDir, { recursive: true });

    const result = await clearScenarioMocks({
      mockDataPath: tmpDir,
      scenario,
      provider: 'filesystem',
    });

    expect(result.mocksRemoved).toBe(0);
    expect(fs.existsSync(scenarioDir)).toBe(true);
  });
});

describe('deleteEntireScenario', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-delete-scenario-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes the scenario folder including mocks and metadata', async () => {
    const scenario = 'staging';
    const scenarioDir = path.join(tmpDir, scenario);
    const nested = path.join(scenarioDir, 'api.example.com');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(
      path.join(nested, 'get-users.json'),
      JSON.stringify(makeMock('https://api.example.com/users', scenario), null, 2)
    );
    fs.writeFileSync(
      path.join(scenarioDir, 'date-config.json'),
      JSON.stringify({ dateManipulation: { offset: 86400 }, updatedAt: EXPORT_TIMESTAMP }, null, 2)
    );
    fs.writeFileSync(
      path.join(scenarioDir, 'scenario-meta.json'),
      JSON.stringify({ locked: false, updatedAt: EXPORT_TIMESTAMP }, null, 2)
    );

    const sibling = path.join(tmpDir, 'default');
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(
      path.join(sibling, 'keep.json'),
      JSON.stringify(makeMock('https://api.example.com/keep'), null, 2)
    );

    const result = await deleteEntireScenario({
      mockDataPath: tmpDir,
      scenario,
      provider: 'filesystem',
    });

    expect(result.mocksRemoved).toBe(1);
    expect(result.folderRemoved).toBe(true);
    expect(fs.existsSync(scenarioDir)).toBe(false);
    expect(fs.existsSync(path.join(sibling, 'keep.json'))).toBe(true);
  });

  it('returns zeros when the scenario folder is already gone', async () => {
    const result = await deleteEntireScenario({
      mockDataPath: tmpDir,
      scenario: 'missing',
      provider: 'filesystem',
    });
    expect(result.mocksRemoved).toBe(0);
    expect(result.folderRemoved).toBe(false);
  });

  it('renames the scenario folder and rewrites mock scenario labels', async () => {
    const from = 'staging';
    const to = 'staging-v2';
    const fromDir = path.join(tmpDir, from);
    fs.mkdirSync(fromDir, { recursive: true });
    const mockPath = path.join(fromDir, 'users.json');
    fs.writeFileSync(mockPath, JSON.stringify(makeMock('https://api.example.com/users', from), null, 2));
    fs.writeFileSync(
      path.join(fromDir, 'date-config.json'),
      JSON.stringify({ dateManipulation: { offset: 60 }, updatedAt: EXPORT_TIMESTAMP }, null, 2)
    );

    const result = await renameEntireScenario({
      mockDataPath: tmpDir,
      scenario: from,
      newName: to,
      provider: 'filesystem',
    });

    expect(result.folderRenamed).toBe(true);
    expect(result.mocksMoved).toBe(1);
    expect(fs.existsSync(fromDir)).toBe(false);
    const destMock = path.join(tmpDir, to, 'users.json');
    expect(fs.existsSync(destMock)).toBe(true);
    expect(JSON.parse(fs.readFileSync(destMock, 'utf-8')).scenario).toBe(to);
    expect(JSON.parse(fs.readFileSync(path.join(tmpDir, to, 'date-config.json'), 'utf-8')).dateManipulation.offset).toBe(
      60
    );
  });
});
