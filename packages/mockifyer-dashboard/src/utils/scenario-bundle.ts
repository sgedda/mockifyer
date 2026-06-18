import fs from 'fs';
import path from 'path';
import type { MockData } from '@sgedda/mockifyer-core';
import { getScenarioFolderPath, isScenarioLockedFs } from '@sgedda/mockifyer-core';
import { getAllJsonFiles } from './json-files';
import { createDashboardMockStore, toDashboardRedisStoreConfig } from './create-dashboard-mock-store';
import { isCentralizedDashboardProvider, type CentralizedDashboardProvider } from './dashboard-provider';
import { RedisMockStore } from './redis-mock-store';

const DATE_CONFIG_BASENAME = 'date-config.json';
export const SCENARIO_IMPORT_LOCKED_MESSAGE = 'Scenario is locked; scenario import cannot modify it.';

/** JSON bundle written by GET /api/scenario-config/export and consumed by POST /api/scenario-config/import */
export const SCENARIO_BUNDLE_FORMAT_VERSION = 1 as const;

export interface ScenarioBundleMockEntry {
  /** Relative path under the scenario folder (filesystem) or pseudo-path e.g. redis/<sha256>.json */
  relativePath: string;
  data: MockData;
}

export interface ScenarioExportBundle {
  formatVersion: typeof SCENARIO_BUNDLE_FORMAT_VERSION;
  exportedAt: string;
  sourceScenario: string;
  /** Dashboard storage at export time (informational) */
  dashboardProvider: 'filesystem' | 'sqlite' | 'redis';
  mocks: ScenarioBundleMockEntry[];
  /** Effective date manipulation for the scenario; null means none */
  dateManipulation: Record<string, unknown> | null;
  /** Proxy dashboard settings (Redis-backed dashboard only); null if unset */
  proxyConfig: {
    recordOnMiss: boolean;
    allowUpstream: boolean;
    recordResponses: boolean;
  } | null;
}

function loadMergedDateConfig(mockDataPath: string, scenario: string): {
  dateManipulation: Record<string, unknown> | null;
  source: 'scenario' | 'legacy' | 'none';
} {
  const scenarioFolder = getScenarioFolderPath(mockDataPath, scenario);
  const scenarioPath = path.join(scenarioFolder, DATE_CONFIG_BASENAME);
  if (fs.existsSync(scenarioPath)) {
    try {
      const fileContent = fs.readFileSync(scenarioPath, 'utf-8');
      const config = JSON.parse(fileContent) as { dateManipulation?: unknown };
      const dm = config.dateManipulation ?? null;
      return {
        dateManipulation: dm !== null && typeof dm === 'object' ? (dm as Record<string, unknown>) : null,
        source: 'scenario',
      };
    } catch {
      return { dateManipulation: null, source: 'none' };
    }
  }

  const legacyPath = path.join(mockDataPath, DATE_CONFIG_BASENAME);
  if (fs.existsSync(legacyPath)) {
    try {
      const fileContent = fs.readFileSync(legacyPath, 'utf-8');
      const config = JSON.parse(fileContent) as { dateManipulation?: unknown };
      const dm = config.dateManipulation ?? null;
      return {
        dateManipulation: dm !== null && typeof dm === 'object' ? (dm as Record<string, unknown>) : null,
        source: 'legacy',
      };
    } catch {
      return { dateManipulation: null, source: 'none' };
    }
  }

  return { dateManipulation: null, source: 'none' };
}

function parseRedisHashFromFilename(relativeName: string): string | null {
  if (!relativeName.startsWith('redis/')) return null;
  if (!relativeName.endsWith('.json')) return null;
  const hash = relativeName.slice('redis/'.length, -'.json'.length);
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
  return hash;
}

function resolveMockFilePath(scenarioPath: string, relativeName: string): string | null {
  if (!relativeName.endsWith('.json')) return null;
  const resolved = path.resolve(scenarioPath, relativeName);
  const root = path.resolve(scenarioPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null;
  return resolved;
}

interface FilesystemMockWrite {
  filePath: string;
  data: MockData;
}

function prepareFilesystemMockWrites(
  scenarioPath: string,
  mocks: ScenarioBundleMockEntry[]
): FilesystemMockWrite[] {
  return mocks.map(({ relativePath, data }) => {
    const filePath = resolveMockFilePath(scenarioPath, relativePath);
    if (!filePath) {
      throw new Error(`Invalid mock path in bundle: ${relativePath}`);
    }
    return { filePath, data };
  });
}

export function buildFilesystemScenarioBundle(
  mockDataPath: string,
  scenario: string,
  dashboardProvider: 'filesystem' | 'sqlite'
): ScenarioExportBundle {
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  const mocks: ScenarioBundleMockEntry[] = [];

  if (fs.existsSync(scenarioPath)) {
    for (const filePath of getAllJsonFiles(scenarioPath)) {
      const rel = path.relative(scenarioPath, filePath);
      if (rel === DATE_CONFIG_BASENAME) continue;
      let raw: string;
      try {
        raw = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }
      try {
        const data = JSON.parse(raw) as MockData;
        if (!data || typeof data !== 'object' || !data.request || !data.response) continue;
        mocks.push({ relativePath: rel.split(path.sep).join('/'), data });
      } catch {
        continue;
      }
    }
  }

  const { dateManipulation } = loadMergedDateConfig(mockDataPath, scenario);

  return {
    formatVersion: SCENARIO_BUNDLE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    sourceScenario: scenario,
    dashboardProvider,
    mocks,
    dateManipulation,
    proxyConfig: null,
  };
}

export async function buildRedisScenarioBundle(
  mockDataPath: string,
  scenario: string,
  redisUrl: string,
  keyPrefix?: string,
  provider: CentralizedDashboardProvider = 'redis',
  redisCluster?: boolean
): Promise<ScenarioExportBundle> {
  const store = createDashboardMockStore(
    toDashboardRedisStoreConfig({ provider, redisUrl, keyPrefix, redisCluster }),
    mockDataPath
  );
  try {
    const items = await store.list(scenario);
    const mocks: ScenarioBundleMockEntry[] = items.map(({ hash, mockData }) => ({
      relativePath: `redis/${hash}.json`,
      data: mockData,
    }));

    const redisDoc = await store.getDateConfig(scenario);
    const dateManipulation =
      redisDoc?.dateManipulation !== undefined && redisDoc?.dateManipulation !== null
        ? (redisDoc.dateManipulation as Record<string, unknown>)
        : null;

    const p = await store.getProxyConfig(scenario);
    const proxyConfig =
      p !== null
        ? {
            recordOnMiss: p.recordOnMiss,
            allowUpstream: p.allowUpstream,
            recordResponses: p.recordResponses === true,
          }
        : null;

    return {
      formatVersion: SCENARIO_BUNDLE_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      sourceScenario: scenario,
      dashboardProvider: provider,
      mocks,
      dateManipulation,
      proxyConfig,
    };
  } finally {
    await store.close().catch(() => undefined);
  }
}

export function assertValidImportBundle(body: unknown): ScenarioExportBundle {
  if (!body || typeof body !== 'object') {
    throw new Error('Import body must be a JSON object');
  }
  const o = body as Record<string, unknown>;
  if (o.formatVersion !== SCENARIO_BUNDLE_FORMAT_VERSION) {
    throw new Error(`Unsupported or missing formatVersion (expected ${SCENARIO_BUNDLE_FORMAT_VERSION})`);
  }
  if (!Array.isArray(o.mocks)) {
    throw new Error('Bundle must contain a mocks array');
  }
  const mocks: ScenarioBundleMockEntry[] = [];
  for (const item of o.mocks) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    if (typeof e.relativePath !== 'string' || !e.relativePath.trim()) {
      throw new Error('Each mock entry must have a non-empty relativePath string');
    }
    if (!e.data || typeof e.data !== 'object') {
      throw new Error(`Mock "${e.relativePath}" must include a data object`);
    }
    const data = e.data as Record<string, unknown>;
    if (!data.request || !data.response) {
      throw new Error(`Mock "${e.relativePath}" data must include request and response`);
    }
    mocks.push({ relativePath: e.relativePath.trim().split('\\').join('/'), data: e.data as MockData });
  }

  let dateManipulation: Record<string, unknown> | null = null;
  if (Object.prototype.hasOwnProperty.call(o, 'dateManipulation')) {
    if (o.dateManipulation === null) {
      dateManipulation = null;
    } else if (typeof o.dateManipulation === 'object' && o.dateManipulation !== null) {
      dateManipulation = o.dateManipulation as Record<string, unknown>;
    } else {
      throw new Error('dateManipulation must be null or an object when provided');
    }
  }

  let proxyConfig: ScenarioExportBundle['proxyConfig'] = null;
  if (Object.prototype.hasOwnProperty.call(o, 'proxyConfig')) {
    if (o.proxyConfig === null) {
      proxyConfig = null;
    } else if (o.proxyConfig && typeof o.proxyConfig === 'object') {
      const p = o.proxyConfig as Record<string, unknown>;
      proxyConfig = {
        recordOnMiss: p.recordOnMiss !== false,
        allowUpstream: p.allowUpstream !== false,
        recordResponses: p.recordResponses === true,
      };
    } else {
      throw new Error('proxyConfig must be null or an object when provided');
    }
  }

  return {
    formatVersion: SCENARIO_BUNDLE_FORMAT_VERSION,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : new Date().toISOString(),
    sourceScenario: typeof o.sourceScenario === 'string' ? o.sourceScenario : 'unknown',
    dashboardProvider:
      o.dashboardProvider === 'redis' || o.dashboardProvider === 'filesystem' || o.dashboardProvider === 'sqlite'
        ? (o.dashboardProvider as ScenarioExportBundle['dashboardProvider'])
        : 'filesystem',
    mocks,
    dateManipulation,
    proxyConfig,
  };
}

function clearFilesystemScenarioMocks(scenarioPath: string): void {
  if (!fs.existsSync(scenarioPath)) return;
  for (const filePath of getAllJsonFiles(scenarioPath)) {
    const rel = path.relative(scenarioPath, filePath);
    if (rel === DATE_CONFIG_BASENAME) continue;
    try {
      fs.unlinkSync(filePath);
    } catch {
      // best-effort
    }
  }
}

async function clearRedisScenarioMocks(store: RedisMockStore, scenario: string): Promise<void> {
  const items = await store.list(scenario);
  for (const { hash } of items) {
    await store.deleteByHash(hash, scenario);
  }
}

function writeDateConfigFilesystem(scenarioFolder: string, dateManipulation: Record<string, unknown> | null): void {
  const configPath = path.join(scenarioFolder, DATE_CONFIG_BASENAME);
  const noManipulation =
    !dateManipulation ||
    (Object.keys(dateManipulation).length === 0 &&
      (dateManipulation as { fixedDate?: unknown }).fixedDate == null &&
      (dateManipulation as { offset?: unknown }).offset === undefined);

  if (!fs.existsSync(scenarioFolder)) {
    fs.mkdirSync(scenarioFolder, { recursive: true });
  }

  if (noManipulation) {
    const clearedPayload = {
      dateManipulation: {} as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(configPath, JSON.stringify(clearedPayload, null, 2), 'utf-8');
    return;
  }

  const payloadFs = {
    dateManipulation,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, JSON.stringify(payloadFs, null, 2), 'utf-8');
}

export interface ApplyScenarioImportOptions {
  mockDataPath: string;
  targetScenario: string;
  bundle: ScenarioExportBundle;
  replaceExistingMocks: boolean;
  applyDateConfig: boolean;
  bundleHadDateKey: boolean;
  applyProxyConfig: boolean;
  bundleHadProxyKey: boolean;
  provider: 'filesystem' | 'sqlite' | 'redis';
  redisUrl?: string;
  keyPrefix?: string;
  redisCluster?: boolean;
}

export interface ApplyScenarioImportResult {
  mocksWritten: number;
  dateConfigApplied: boolean;
  proxyConfigApplied: boolean;
}

const IMPORT_META_KEYS = new Set([
  'targetScenario',
  'replaceExistingMocks',
  'applyDateConfig',
  'applyProxyConfig',
  'bundle',
]);

export interface ScenarioImportRequestMeta {
  targetScenario?: string;
  replaceExistingMocks: boolean;
  applyDateConfig: boolean;
  applyProxyConfig: boolean;
}

/**
 * Accepts either a raw export JSON (`formatVersion` + `mocks` + …) or `{ bundle: <export>, …meta }`.
 */
export function parseScenarioImportRequest(body: unknown): {
  meta: ScenarioImportRequestMeta;
  bundle: ScenarioExportBundle;
  bundleHadDateKey: boolean;
  bundleHadProxyKey: boolean;
} {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object');
  }
  const raw = body as Record<string, unknown>;
  const wrapped = raw.bundle !== undefined && raw.bundle !== null && typeof raw.bundle === 'object';
  const bundleSource = (wrapped ? raw.bundle : raw) as Record<string, unknown>;
  const pure: Record<string, unknown> = { ...bundleSource };
  for (const k of IMPORT_META_KEYS) {
    delete pure[k];
  }

  const bundleHadDateKey = Object.prototype.hasOwnProperty.call(pure, 'dateManipulation');
  const bundleHadProxyKey = Object.prototype.hasOwnProperty.call(pure, 'proxyConfig');
  const bundle = assertValidImportBundle(pure);

  const meta: ScenarioImportRequestMeta = {
    targetScenario: typeof raw.targetScenario === 'string' ? raw.targetScenario : undefined,
    replaceExistingMocks: raw.replaceExistingMocks === true,
    applyDateConfig: raw.applyDateConfig !== false,
    applyProxyConfig: raw.applyProxyConfig !== false,
  };

  return { meta, bundle, bundleHadDateKey, bundleHadProxyKey };
}

export async function applyScenarioImport(opts: ApplyScenarioImportOptions): Promise<ApplyScenarioImportResult> {
  const {
    mockDataPath,
    targetScenario,
    bundle,
    replaceExistingMocks,
    applyDateConfig,
    bundleHadDateKey,
    applyProxyConfig,
    bundleHadProxyKey,
    provider,
    redisUrl,
    keyPrefix,
    redisCluster,
  } = opts;

  let mocksWritten = 0;
  let dateConfigApplied = false;
  let proxyConfigApplied = false;

  if (isCentralizedDashboardProvider(provider)) {
    if (provider === 'redis' && !redisUrl) {
      throw new Error('Redis URL is required for redis provider');
    }
    const store = createDashboardMockStore(
      toDashboardRedisStoreConfig({ provider, redisUrl, keyPrefix, redisCluster }),
      mockDataPath
    );
    try {
      if (await store.isScenarioLocked(targetScenario)) {
        throw new Error(SCENARIO_IMPORT_LOCKED_MESSAGE);
      }
      if (replaceExistingMocks) {
        await clearRedisScenarioMocks(store, targetScenario);
      }
      for (const { relativePath, data } of bundle.mocks) {
        const copy = { ...data, scenario: targetScenario } as MockData;
        const hashFromName = parseRedisHashFromFilename(relativePath);
        const hash = hashFromName ?? RedisMockStore.hashForMock(copy);
        await store.setByHash(hash, copy, targetScenario);
        mocksWritten++;
      }

      if (applyDateConfig && bundleHadDateKey) {
        const dm = bundle.dateManipulation;
        if (dm === null) {
          await store.deleteDateConfig(targetScenario);
        } else if (dm && typeof dm === 'object') {
          await store.setDateConfig(targetScenario, {
            dateManipulation: dm,
            updatedAt: new Date().toISOString(),
          });
        }
        dateConfigApplied = true;
      }

      if (applyProxyConfig && bundleHadProxyKey) {
        const pc = bundle.proxyConfig;
        if (pc === null) {
          await store.deleteProxyConfig(targetScenario);
        } else if (pc) {
          await store.setProxyConfig(targetScenario, {
            recordOnMiss: pc.recordOnMiss,
            allowUpstream: pc.allowUpstream,
            recordResponses: pc.recordResponses === true,
            updatedAt: new Date().toISOString(),
          });
        }
        proxyConfigApplied = true;
      }
    } finally {
      await store.close().catch(() => undefined);
    }
    return { mocksWritten, dateConfigApplied, proxyConfigApplied };
  }

  const scenarioFolder = getScenarioFolderPath(mockDataPath, targetScenario);
  if (!fs.existsSync(mockDataPath)) {
    fs.mkdirSync(mockDataPath, { recursive: true });
  }
  if (!fs.existsSync(scenarioFolder)) {
    fs.mkdirSync(scenarioFolder, { recursive: true });
  }
  if (isScenarioLockedFs(mockDataPath, targetScenario)) {
    throw new Error(SCENARIO_IMPORT_LOCKED_MESSAGE);
  }

  const mockWrites = prepareFilesystemMockWrites(scenarioFolder, bundle.mocks);

  if (replaceExistingMocks) {
    clearFilesystemScenarioMocks(scenarioFolder);
  }

  for (const { filePath, data } of mockWrites) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const copy = { ...data, scenario: targetScenario } as MockData;
    fs.writeFileSync(filePath, JSON.stringify(copy, null, 2), 'utf-8');
    mocksWritten++;
  }

  if (applyDateConfig && bundleHadDateKey) {
    writeDateConfigFilesystem(scenarioFolder, bundle.dateManipulation);
    dateConfigApplied = true;
  }

  return { mocksWritten, dateConfigApplied, proxyConfigApplied };
}
