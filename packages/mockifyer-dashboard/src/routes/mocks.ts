import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getAllJsonFiles } from '../utils/json-files';
import {
  getCurrentScenario,
  getScenarioFolderPath,
  buildSimilarMockGroups,
  MockListEntryForSimilarity,
  applyCapturedResponse,
  buildMockDataAfterLiveCapture,
  type MockData,
  type DomainPathRulesMap,
  buildAiContext,
  getMockEndpointKey,
  type AiContextMode,
  validateResponseFieldOverrides,
  copyArrayItemInResponseData,
  type MockResponseFieldOverride,
  isScenarioLockedFs,
  validatePoolRef,
  applyResponseFieldOverridesToData,
  type PoolRef,
} from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import {
  createDashboardMockStore,
  toDashboardRedisStoreConfig,
  type DashboardRedisConfig,
} from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';
import { RedisMockStore } from '../utils/redis-mock-store';
import {
  bulkCaptureResponsesForDomain,
  bulkSetLiveApiForDomain,
} from '../utils/bulk-domain-mocks';
import { applyReplayModeFieldsFromBody, getMockReplayModeListFlags } from '../utils/mock-replay-mode-patch';
import { fetchUpstreamResponse } from '../utils/capture-upstream-response';
import {
  readDomainPathRulesFile,
  writeDomainPathRulesFile,
} from '../utils/domain-path-rules-store';

const router = express.Router();

/** HTTP 423: scenario lock — mock writes are forbidden while locked. */
const SCENARIO_MOCK_LOCKED_MESSAGE = 'Scenario is locked; mock data cannot be edited.';

type OverridePreview = { path: string; summary: string };

function extractMockCorrelationIds(mockData: unknown): {
  requestId: string | null;
  parentRequestId: string | null;
} {
  const m = mockData as {
    requestId?: unknown;
    parentRequestId?: unknown;
    data?: { requestId?: unknown; parentRequestId?: unknown };
  };
  const requestIdRaw = m.requestId ?? m.data?.requestId;
  const parentRaw = m.parentRequestId ?? m.data?.parentRequestId;
  const requestId =
    typeof requestIdRaw === 'string' && requestIdRaw.trim() ? requestIdRaw.trim() : null;
  const parentRequestId =
    typeof parentRaw === 'string' && parentRaw.trim() ? parentRaw.trim() : null;
  return { requestId, parentRequestId };
}

function extractMockActivationFlags(mockData: unknown): {
  alwaysUseRealApi: boolean;
  responsePending: boolean;
  replayMode: ReturnType<typeof getMockReplayModeListFlags>['replayMode'];
  refreshOnNextRequest: boolean;
  alwaysRefreshFromLive: boolean;
} {
  const m = mockData as { alwaysUseRealApi?: boolean; responsePending?: boolean };
  const replay = getMockReplayModeListFlags(mockData);
  return {
    alwaysUseRealApi: m.alwaysUseRealApi === true,
    responsePending: m.responsePending === true,
    replayMode: replay.replayMode,
    refreshOnNextRequest: replay.refreshOnNextRequest,
    alwaysRefreshFromLive: replay.alwaysRefreshFromLive,
  };
}

function getMockDataPath(): string {
  return detectMockDataPath();
}

function parseRedisHashFromFilename(relativeName: string): string | null {
  // Expected format: redis/<hash>.json
  if (!relativeName.startsWith('redis/')) return null;
  if (!relativeName.endsWith('.json')) return null;
  const hash = relativeName.slice('redis/'.length, -'.json'.length);
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
  return hash;
}

/** Scenario from ?scenario= or Redis active key + filesystem fallback (matches proxy when body scenario is omitted). */
async function resolveRedisScenario(req: Request, store: RedisMockStore): Promise<string> {
  const raw = req.query.scenario;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return store.getActiveScenario();
}

/** Scenario from ?scenario= or local scenario-config (align with GET /mocks list). */
function resolveFilesystemScenario(req: Request, mockDataPath: string): string {
  const raw = req.query.scenario;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return getCurrentScenario(mockDataPath);
}

function buildOverrideSummary(override: Record<string, unknown>): string {
  const pieces: string[] = [];
  const offsetDays = override.offsetDays;
  const offsetHours = override.offsetHours;
  const offsetMinutes = override.offsetMinutes;
  const offsetMs = override.offsetMs;

  if (typeof offsetDays === 'number' && offsetDays !== 0) pieces.push(`${offsetDays}d`);
  if (typeof offsetHours === 'number' && offsetHours !== 0) pieces.push(`${offsetHours}h`);
  if (typeof offsetMinutes === 'number' && offsetMinutes !== 0) pieces.push(`${offsetMinutes}m`);
  if (typeof offsetMs === 'number' && offsetMs !== 0) pieces.push(`${offsetMs}ms`);

  const format = override.format;
  if (typeof format === 'string' && format) pieces.push(`format=${format}`);

  if (pieces.length === 0) return 'no offset';
  return pieces.join(' ');
}

function getOverridePreview(mockData: any): { hasOverrides: boolean; preview: OverridePreview[] } {
  const overrides = mockData?.responseDateOverrides;
  if (!Array.isArray(overrides) || overrides.length === 0) {
    return { hasOverrides: false, preview: [] };
  }
  const preview: OverridePreview[] = [];
  for (const o of overrides) {
    if (!o || typeof o !== 'object') continue;
    const pathVal = (o as any).path;
    if (typeof pathVal !== 'string' || !pathVal.trim()) continue;
    preview.push({ path: pathVal, summary: buildOverrideSummary(o as Record<string, unknown>) });
    if (preview.length >= 3) break;
  }
  return { hasOverrides: preview.length > 0, preview };
}

function normalizeSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

function parseLimit(raw: unknown, fallback: number): number {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

function parseSimilarGroupsQuery(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const s = raw.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function parseSimilarThresholdQuery(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(0.999, Math.max(0.5, n));
}

function parseAiContextMode(raw: unknown): AiContextMode {
  if (typeof raw !== 'string') return 'profile';
  const mode = raw.trim().toLowerCase();
  if (mode === 'profile' || mode === 'schema' || mode === 'suggest' || mode === 'full') {
    return mode;
  }
  return 'profile';
}

function parseCsvQuery(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const MAX_RELATED_MOCKS_FOR_AI = 30;

async function loadRelatedMocksForEndpoint(params: {
  primary: MockData;
  scenario: string;
  mockDataPath: string;
  provider: 'filesystem' | 'sqlite' | 'redis';
  redisUrl?: string;
  keyPrefix?: string;
  redisCluster?: boolean;
  excludeFilename: string;
}): Promise<MockData[]> {
  const endpointKey = getMockEndpointKey(params.primary);
  const related: MockData[] = [];

  if (isCentralizedDashboardProvider(params.provider)) {
    const store = createDashboardMockStore(
      toDashboardRedisStoreConfig(params as DashboardRedisConfig),
      params.mockDataPath
    );
    try {
      const items = await store.list(params.scenario);
      for (const { hash, mockData } of items) {
        const filename = `redis/${hash}.json`;
        if (filename === params.excludeFilename) continue;
        if (getMockEndpointKey(mockData) !== endpointKey) continue;
        related.push(mockData);
        if (related.length >= MAX_RELATED_MOCKS_FOR_AI) break;
      }
    } finally {
      await store.close().catch(() => undefined);
    }
    return related;
  }

  const scenarioPath = getScenarioFolderPath(params.mockDataPath, params.scenario);
  if (!fs.existsSync(scenarioPath)) return related;

  for (const filePath of getAllJsonFiles(scenarioPath)) {
    const relativeName = path.relative(scenarioPath, filePath);
    if (relativeName === params.excludeFilename) continue;
    try {
      const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
      if (getMockEndpointKey(mockData) !== endpointKey) continue;
      related.push(mockData);
      if (related.length >= MAX_RELATED_MOCKS_FOR_AI) break;
    } catch {
      // skip unreadable files
    }
  }

  return related;
}

/**
 * When `similarGroups=1`, clusters GraphQL mocks with the same URL, method, operation, and variables
 * whose query documents differ only slightly (token Jaccard). Mutates each file with `similarBodyGroup`.
 */
function maybeAttachSimilarBodyGroups(files: any[], req: Request): { similarBodyGroups?: unknown[] } {
  if (!parseSimilarGroupsQuery(req.query.similarGroups)) return {};
  const threshold = parseSimilarThresholdQuery(req.query.similarThreshold);
  const entries: MockListEntryForSimilarity[] = files.map((f) => ({
    filename: String(f.filename),
    endpoint: f.endpoint ?? null,
    method: f.method ?? null,
    graphqlInfo: f.graphqlInfo,
  }));
  const groups = buildSimilarMockGroups(entries, threshold !== undefined ? { threshold } : undefined);
  const byFile = new Map<string, { id: string; size: number; minSimilarity: number }>();
  for (const g of groups) {
    for (const fn of g.filenames) {
      byFile.set(fn, { id: g.id, size: g.filenames.length, minSimilarity: g.minSimilarity });
    }
  }
  for (const f of files) {
    f.similarBodyGroup = byFile.get(String(f.filename)) ?? null;
  }
  return {
    similarBodyGroups: groups.map((g) => ({
      id: g.id,
      operationName: g.operationName ?? null,
      minSimilarity: g.minSimilarity,
      filenames: g.filenames,
      size: g.filenames.length,
    })),
  };
}

// List all mock files (recursive)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const requestedScenario = req.query.scenario as string | undefined;
    const scenario = requestedScenario || getCurrentScenario(mockDataPath);

    if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
      try {
        const items = await store.list(scenario);
        const files = items
          .map(({ hash, mockData, redisKey }) => {
            const payload = JSON.stringify(mockData);
            const ts = mockData.timestamp ? new Date(mockData.timestamp) : new Date();

            let endpoint: string | null = null;
            let graphqlInfo: any = null;
            let method: string | null = null;
            let sessionId: string | null = null;
            let activation = extractMockActivationFlags({});
            const { hasOverrides, preview } = getOverridePreview(mockData);
            try {
              if (mockData.request?.url) endpoint = mockData.request.url;
              if (mockData.request?.method) {
                method = String(mockData.request.method).toUpperCase();
              }
              // Best-effort query params formatting, matching filesystem route behavior.
              if (mockData.request?.queryParams && Object.keys(mockData.request.queryParams).length > 0) {
                const params = new URLSearchParams();
                Object.entries(mockData.request.queryParams).forEach(([key, value]) => {
                  if (value != null) params.append(key, String(value));
                });
                const qs = params.toString();
                if (qs && endpoint) endpoint += '?' + qs;
              }
              // GraphQL heuristic
              const body = (mockData.request as any)?.data;
              const parsedBody =
                typeof body === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(body);
                      } catch {
                        return body;
                      }
                    })()
                  : body;
              if (
                parsedBody &&
                typeof parsedBody === 'object' &&
                typeof (parsedBody as any).query === 'string'
              ) {
                graphqlInfo = {
                  query: (parsedBody as any).query,
                  variables: (parsedBody as any).variables || null,
                  operationName:
                    typeof (parsedBody as any).operationName === 'string'
                      ? (parsedBody as any).operationName
                      : null,
                };
              }
              sessionId = (mockData as any).sessionId || null;
              activation = extractMockActivationFlags(mockData);
            } catch {
              // ignore
            }
            const correlation = extractMockCorrelationIds(mockData);

            // Use a stable pseudo-filename for UI routing. Must end with .json.
            const filename = `redis/${hash}.json`;
            return {
              filename,
              filePath: `redis://${redisKey}`,
              size: Buffer.byteLength(payload),
              created: ts.toISOString(),
              modified: ts.toISOString(),
              endpoint,
              method,
              graphqlInfo,
              sessionId,
              requestId: correlation.requestId,
              parentRequestId: correlation.parentRequestId,
              ...activation,
              hasResponseDateOverrides: hasOverrides,
              responseDateOverridesPreview: preview,
            };
          })
          .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
        const similarExtras = maybeAttachSimilarBodyGroups(files, req);
        return res.json({ files, mockDataPath, scenario, ...similarExtras });
      } catch (error: any) {
        console.error('[MocksRoute] Redis List - Error:', error);
        return res.status(500).json({ error: 'Failed to list Redis mocks', details: error.message });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);

    if (!fs.existsSync(mockDataPath) || !fs.existsSync(scenarioPath)) {
      const emptyFiles: any[] = [];
      return res.json({ files: emptyFiles, mockDataPath, scenario, ...maybeAttachSimilarBodyGroups(emptyFiles, req) });
    }

    const files = getAllJsonFiles(scenarioPath)
      .map(filePath => {
        const relativeName = path.relative(scenarioPath, filePath);
        const stats = fs.statSync(filePath);

        let endpoint = null;
        let graphqlInfo = null;
        let method: string | null = null;
        let sessionId = null;
        let activation = extractMockActivationFlags({});
        let hasResponseDateOverrides = false;
        let responseDateOverridesPreview: OverridePreview[] = [];
        let requestId: string | null = null;
        let parentRequestId: string | null = null;
        try {
          const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const correlation = extractMockCorrelationIds(mockData);
          requestId = correlation.requestId;
          parentRequestId = correlation.parentRequestId;
          if (mockData.request?.url) {
            endpoint = mockData.request.url;
          }
          if (mockData.request?.method) {
            method = String(mockData.request.method).toUpperCase();
          }
          activation = extractMockActivationFlags(mockData);
          if (mockData.sessionId) sessionId = mockData.sessionId;
          else if (mockData.data?.sessionId) sessionId = mockData.data.sessionId;

          const overrideInfo = getOverridePreview(mockData);
          hasResponseDateOverrides = overrideInfo.hasOverrides;
          responseDateOverridesPreview = overrideInfo.preview;

          if (mockData.request?.data) {
            let bodyData = mockData.request.data;
            if (typeof bodyData === 'string') {
              try { bodyData = JSON.parse(bodyData); } catch { /* not JSON */ }
            }
            if (typeof bodyData === 'object' && bodyData !== null && typeof bodyData.query === 'string') {
              graphqlInfo = {
                query: bodyData.query,
                variables: bodyData.variables || null,
                operationName:
                  typeof (bodyData as any).operationName === 'string'
                    ? (bodyData as any).operationName
                    : null,
              };
            }
          }

          if (!graphqlInfo && mockData.request?.queryParams && Object.keys(mockData.request.queryParams).length > 0) {
            const params = new URLSearchParams();
            Object.entries(mockData.request.queryParams).forEach(([key, value]) => {
              if (value != null) params.append(key, String(value));
            });
            const qs = params.toString();
            if (qs) endpoint += '?' + qs;
          }
        } catch (error) {
          console.warn(`[MocksRoute] Could not extract endpoint from ${relativeName}:`, error);
        }

        return {
          filename: relativeName,
          filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          endpoint,
          method,
          graphqlInfo,
          sessionId,
          requestId,
          parentRequestId,
          ...activation,
          hasResponseDateOverrides,
          responseDateOverridesPreview,
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());

    const similarExtras = maybeAttachSimilarBodyGroups(files, req);
    res.json({ files, mockDataPath, scenario, ...similarExtras });
  } catch (error: any) {
    console.error('[MocksRoute] List - Error:', error);
    res.status(500).json({ error: 'Failed to list mock files', details: error.message });
  }
});

// Search mock files by free-text query (filename/endpoint/method/graphql + response data)
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const q = normalizeSearchQuery(req.query.q);
    const limit = parseLimit(req.query.limit, 200);
    const requestedScenario = req.query.scenario as string | undefined;
    const scenario = requestedScenario || getCurrentScenario(mockDataPath);

    if (!q) {
      return res.json({ files: [], mockDataPath, scenario, query: '', truncated: false });
    }

    if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);

      try {
        const items = await store.list(scenario);
        const files: any[] = [];
        for (const { hash, mockData, redisKey } of items) {
          if (!mockData || typeof mockData !== 'object') continue;
          const raw = JSON.stringify(mockData).toLowerCase();
          if (!raw.includes(q)) continue;

          const payload = JSON.stringify(mockData);
          const ts = mockData.timestamp ? new Date(mockData.timestamp) : new Date();

          let endpoint: string | null = null;
          let graphqlInfo: any = null;
          let sessionId: string | null = null;
          let method: string | null = null;
          let alwaysUseRealApi = false;
          const { hasOverrides, preview } = getOverridePreview(mockData);

          try {
            if (mockData.request?.url) endpoint = mockData.request.url;
            if (mockData.request?.method) method = String(mockData.request.method);

            if (mockData.request?.queryParams && Object.keys(mockData.request.queryParams).length > 0) {
              const params = new URLSearchParams();
              Object.entries(mockData.request.queryParams).forEach(([key, value]) => {
                if (value != null) params.append(key, String(value));
              });
              const qs = params.toString();
              if (qs && endpoint) endpoint += '?' + qs;
            }

            const body = (mockData.request as any)?.data;
            const parsedBody =
              typeof body === 'string'
                ? (() => {
                    try {
                      return JSON.parse(body);
                    } catch {
                      return body;
                    }
                  })()
                : body;
            if (
              parsedBody &&
              typeof parsedBody === 'object' &&
              typeof (parsedBody as any).query === 'string'
            ) {
              graphqlInfo = {
                query: (parsedBody as any).query,
                variables: (parsedBody as any).variables || null,
              };
            }
            sessionId = (mockData as any).sessionId || null;
            alwaysUseRealApi = (mockData as any).alwaysUseRealApi === true;
          } catch {
            // ignore best-effort extraction errors
          }
          const correlation = extractMockCorrelationIds(mockData);

          files.push({
            filename: `redis/${hash}.json`,
            filePath: `redis://${redisKey}`,
            size: Buffer.byteLength(payload),
            created: ts.toISOString(),
            modified: ts.toISOString(),
            endpoint,
            method,
            graphqlInfo,
            sessionId,
            requestId: correlation.requestId,
            parentRequestId: correlation.parentRequestId,
            alwaysUseRealApi,
            hasResponseDateOverrides: hasOverrides,
            responseDateOverridesPreview: preview,
          });

          if (files.length >= limit) {
            return res.json({ files, mockDataPath, scenario, query: q, truncated: true });
          }
        }
        return res.json({ files, mockDataPath, scenario, query: q, truncated: false });
      } catch (error: any) {
        console.error('[MocksRoute] Redis Search - Error:', error);
        return res.status(500).json({ error: 'Failed to search Redis mocks', details: error.message });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    if (!fs.existsSync(mockDataPath) || !fs.existsSync(scenarioPath)) {
      return res.json({ files: [], mockDataPath, scenario, query: q, truncated: false });
    }

    const files: any[] = [];
    const all = getAllJsonFiles(scenarioPath);

    for (const filePath of all) {
      if (files.length >= limit) break;

      const relativeName = path.relative(scenarioPath, filePath);
      const lowerRel = relativeName.toLowerCase();
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const lowerContent = content.toLowerCase();
      if (!lowerRel.includes(q) && !lowerContent.includes(q)) continue;

      const stats = fs.statSync(filePath);
      let endpoint: string | null = null;
      let graphqlInfo: any = null;
      let sessionId: string | null = null;
      let method: string | null = null;
      let alwaysUseRealApi = false;
      let hasResponseDateOverrides = false;
      let responseDateOverridesPreview: OverridePreview[] = [];
      let requestId: string | null = null;
      let parentRequestId: string | null = null;

      try {
        const mockData = JSON.parse(content);
        const correlation = extractMockCorrelationIds(mockData);
        requestId = correlation.requestId;
        parentRequestId = correlation.parentRequestId;
        if (mockData.request?.url) endpoint = mockData.request.url;
        if (mockData.request?.method) method = String(mockData.request.method);
        if (mockData.alwaysUseRealApi === true) alwaysUseRealApi = true;
        if (mockData.sessionId) sessionId = mockData.sessionId;
        else if (mockData.data?.sessionId) sessionId = mockData.data.sessionId;

        const overrideInfo = getOverridePreview(mockData);
        hasResponseDateOverrides = overrideInfo.hasOverrides;
        responseDateOverridesPreview = overrideInfo.preview;

        if (mockData.request?.data) {
          let bodyData = mockData.request.data;
          if (typeof bodyData === 'string') {
            try {
              bodyData = JSON.parse(bodyData);
            } catch {
              /* not JSON */
            }
          }
          if (typeof bodyData === 'object' && bodyData !== null && typeof bodyData.query === 'string') {
            graphqlInfo = { query: bodyData.query, variables: bodyData.variables || null };
          }
        }

        if (!graphqlInfo && mockData.request?.queryParams && Object.keys(mockData.request.queryParams).length > 0) {
          const params = new URLSearchParams();
          Object.entries(mockData.request.queryParams).forEach(([key, value]) => {
            if (value != null) params.append(key, String(value));
          });
          const qs = params.toString();
          if (qs && endpoint) endpoint += '?' + qs;
        }
      } catch (error) {
        console.warn(`[MocksRoute] Search parse failed for ${relativeName}:`, error);
      }

      files.push({
        filename: relativeName,
        filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        endpoint,
        method,
        graphqlInfo,
        sessionId,
        requestId,
        parentRequestId,
        alwaysUseRealApi,
        hasResponseDateOverrides,
        responseDateOverridesPreview,
      });
    }

    res.json({ files, mockDataPath, scenario, query: q, truncated: files.length >= limit });
  } catch (error: any) {
    console.error('[MocksRoute] Search - Error:', error);
    res.status(500).json({ error: 'Failed to search mocks', details: error.message });
  }
});

/** Resolve and validate a relative filename (may contain slashes) within the scenario path. */
function resolveFilePath(scenarioPath: string, relativeName: string): string | null {
  if (!relativeName.endsWith('.json')) return null;
  const resolved = path.resolve(scenarioPath, relativeName);
  if (!resolved.startsWith(path.resolve(scenarioPath) + path.sep) &&
      resolved !== path.resolve(scenarioPath)) return null;
  return resolved;
}

router.get('/domain-path-rules', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const dataPath = mockDataPath || detectMockDataPath();

    if (!isCentralizedDashboardProvider(config.provider)) {
      const scenario = resolveFilesystemScenario(req, dataPath);
      const rules = readDomainPathRulesFile(dataPath, scenario);
      return res.json({ scenario, rules });
    }

    const store = createDashboardMockStore(config, dataPath);
    try {
      const scenario = await resolveRedisScenario(req, store);
      const fromRedis = await store.getDomainPathRules(scenario);
      const fromFile = readDomainPathRulesFile(dataPath, scenario);
      const rules = { ...fromFile, ...fromRedis };
      return res.json({ scenario, rules });
    } finally {
      await store.close().catch(() => undefined);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message || 'domain-path-rules GET failed' });
  }
});

router.post('/domain-path-rules', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const dataPath = mockDataPath || detectMockDataPath();
    const { scenario, domainPath, rule } = req.body || {};
    if (typeof scenario !== 'string' || !scenario.trim()) {
      return res.status(400).json({ error: 'scenario is required' });
    }
    if (typeof domainPath !== 'string' || !domainPath.trim()) {
      return res.status(400).json({ error: 'domainPath is required (host or host/path prefix)' });
    }
    if (rule !== null && (typeof rule !== 'object' || typeof rule.recordResponses !== 'boolean')) {
      return res.status(400).json({ error: 'rule must be null or { recordResponses: boolean, autoMock?: boolean }' });
    }

    const scenarioName = scenario.trim();
    const normalizedRule =
      rule === null
        ? null
        : { recordResponses: rule.recordResponses, autoMock: rule.autoMock === true };

    let rules: DomainPathRulesMap;

    if (!isCentralizedDashboardProvider(config.provider)) {
      rules = readDomainPathRulesFile(dataPath, scenarioName);
      const normalizedPath = domainPath.trim().replace(/^\/+|\/+$/g, '');
      if (normalizedRule === null) {
        delete rules[normalizedPath];
      } else {
        rules[normalizedPath] = {
          ...normalizedRule,
          updatedAt: new Date().toISOString(),
        };
      }
      writeDomainPathRulesFile(dataPath, scenarioName, rules);
      return res.json({ scenario: scenarioName, domainPath: domainPath.trim(), rules });
    }

    const store = createDashboardMockStore(config, dataPath);
    try {
      rules = await store.setDomainPathRule(scenarioName, domainPath.trim(), normalizedRule);
      writeDomainPathRulesFile(dataPath, scenarioName, rules);
      return res.json({ scenario: scenarioName, domainPath: domainPath.trim(), rules });
    } finally {
      await store.close().catch(() => undefined);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message || 'domain-path-rules POST failed' });
  }
});

// Lightweight AI/MCP projection — must be registered before GET /*
router.get('/*/ai-context', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);
    const mode = parseAiContextMode(req.query.mode);
    const includePaths = parseCsvQuery(req.query.includePaths);
    const excludePaths = parseCsvQuery(req.query.excludePaths);
    const maxPaths = parseLimit(req.query.maxPaths as string | undefined, 25);
    const includeRelated = req.query.includeRelated !== '0' && req.query.includeRelated !== 'false';

    let primaryMock: MockData | null = null;
    let scenario = '';

    if (isCentralizedDashboardProvider(config.provider)) {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });

    const store = createDashboardMockStore(config, mockDataPath);
      try {
        scenario = await resolveRedisScenario(req, store);
        primaryMock = (await store.getByHash(hash, scenario)) as MockData | null;
      } finally {
        await store.close().catch(() => undefined);
      }
    } else {
      scenario = resolveFilesystemScenario(req, mockDataPath);
      const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
      const filePath = resolveFilePath(scenarioPath, relativeName);
      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Mock file not found' });
      }
      primaryMock = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
    }

    if (!primaryMock) {
      return res.status(404).json({ error: 'Mock not found' });
    }

    const relatedMocks = includeRelated
      ? await loadRelatedMocksForEndpoint({
          primary: primaryMock,
          scenario,
          mockDataPath,
          provider: isCentralizedDashboardProvider(config.provider) ? config.provider : 'filesystem',
          redisUrl: config.redisUrl,
          keyPrefix: config.keyPrefix,
          redisCluster: config.redisCluster,
          excludeFilename: relativeName,
        })
      : [];

    const aiContext = buildAiContext(primaryMock, relatedMocks, {
      mode,
      maxPaths,
      includePaths: includePaths.length > 0 ? includePaths : undefined,
      excludePaths: excludePaths.length > 0 ? excludePaths : undefined,
    });

    return res.json({
      filename: relativeName,
      scenario,
      ...aiContext,
    });
  } catch (error: unknown) {
    console.error('[MocksRoute] ai-context - Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to build AI context', details: message });
  }
});

// Replay-time field overrides (no full responseData required)
router.patch('/*/field-overrides', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);

    if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, 'responseFieldOverrides')) {
      return res.status(400).json({ error: 'Request body must contain responseFieldOverrides' });
    }

    const validationError = validateResponseFieldOverrides(req.body.responseFieldOverrides);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const merge = req.body.merge === true;
    const incoming = req.body.responseFieldOverrides as MockResponseFieldOverride[] | null;

    if (isCentralizedDashboardProvider(config.provider)) {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });

    const store = createDashboardMockStore(config, mockDataPath);
      try {
        const scenario = await resolveRedisScenario(req, store);
        const existingData = (await store.getByHash(hash, scenario)) as MockData | null;
        if (!existingData) return res.status(404).json({ error: 'Mock not found' });

        if (incoming === null || incoming.length === 0) {
          delete (existingData as any).responseFieldOverrides;
        } else if (merge && Array.isArray(existingData.responseFieldOverrides)) {
          existingData.responseFieldOverrides = [...existingData.responseFieldOverrides, ...incoming];
        } else {
          existingData.responseFieldOverrides = incoming;
        }

        existingData.timestamp = new Date().toISOString();
        await store.setByHash(hash, existingData, scenario);

        return res.json({
          success: true,
          filename: relativeName,
          scenario,
          responseFieldOverrides: existingData.responseFieldOverrides ?? [],
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenarioPath = getScenarioFolderPath(mockDataPath, resolveFilesystemScenario(req, mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Mock file not found' });
    }

    const existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;

    if (incoming === null || incoming.length === 0) {
      delete (existingData as any).responseFieldOverrides;
    } else if (merge && Array.isArray(existingData.responseFieldOverrides)) {
      existingData.responseFieldOverrides = [...existingData.responseFieldOverrides, ...incoming];
    } else {
      existingData.responseFieldOverrides = incoming;
    }

    existingData.timestamp = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');

    return res.json({
      success: true,
      filename: relativeName,
      scenario: resolveFilesystemScenario(req, mockDataPath),
      responseFieldOverrides: existingData.responseFieldOverrides ?? [],
    });
  } catch (error: unknown) {
    console.error('[MocksRoute] field-overrides PATCH - Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to update field overrides', details: message });
  }
});

/**
 * PATCH /api/mocks/.../pool-ref
 * Embed a `$pool` ref node into the mock response body (entire body or at a JSON path).
 */
router.patch('/*/pool-ref', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);
    const body = req.body ?? {};

    if (!Object.prototype.hasOwnProperty.call(body, 'pool')) {
      return res.status(400).json({ error: 'Request body must contain pool' });
    }

    const pool = body.pool as PoolRef;
    const validationError = validatePoolRef(pool);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const targetPath =
      typeof body.path === 'string' ? body.path.trim() : body.path === null ? '' : '';
    const poolNode = { $pool: pool };

    const applyPoolRefToMock = (existingData: MockData): void => {
      if (!targetPath) {
        existingData.response = {
          ...existingData.response,
          data: poolNode,
        };
      } else {
        existingData.response = {
          ...existingData.response,
          data: applyResponseFieldOverridesToData(existingData.response.data, [
            { path: targetPath, value: poolNode },
          ]),
        };
      }
      existingData.timestamp = new Date().toISOString();
    };

    if (isCentralizedDashboardProvider(config.provider)) {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });

      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const scenario = await resolveRedisScenario(req, store);
        const existingData = (await store.getByHash(hash, scenario)) as MockData | null;
        if (!existingData) return res.status(404).json({ error: 'Mock not found' });

        applyPoolRefToMock(existingData);
        await store.setByHash(hash, existingData, scenario);

        return res.json({
          success: true,
          filename: relativeName,
          scenario,
          path: targetPath || null,
          pool,
          responseData: existingData.response.data,
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenarioPath = getScenarioFolderPath(mockDataPath, resolveFilesystemScenario(req, mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Mock file not found' });
    }

    const existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
    applyPoolRefToMock(existingData);
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');

    return res.json({
      success: true,
      filename: relativeName,
      scenario: resolveFilesystemScenario(req, mockDataPath),
      path: targetPath || null,
      pool,
      responseData: existingData.response.data,
    });
  } catch (error: unknown) {
    console.error('[MocksRoute] pool-ref PATCH - Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: 'Failed to set pool ref', details: message });
  }
});

// Copy an array item with optional field overrides (persists to response.data)
router.post('/*/copy-array-item', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);
    const body = req.body ?? {};

    if (typeof body.arrayPath !== 'string' || !body.arrayPath.trim()) {
      return res.status(400).json({ error: 'arrayPath is required' });
    }
    if (typeof body.fromIndex !== 'number' || !Number.isInteger(body.fromIndex) || body.fromIndex < 0) {
      return res.status(400).json({ error: 'fromIndex must be a non-negative integer' });
    }

    const copyParams = {
      arrayPath: body.arrayPath.trim(),
      fromIndex: body.fromIndex,
      itemOverrides:
        body.itemOverrides && typeof body.itemOverrides === 'object' && !Array.isArray(body.itemOverrides)
          ? (body.itemOverrides as Record<string, unknown>)
          : undefined,
      insertAt: body.insertAt as 'append' | 'prepend' | number | undefined,
    };

    if (isCentralizedDashboardProvider(config.provider)) {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });

    const store = createDashboardMockStore(config, mockDataPath);
      try {
        const scenario = await resolveRedisScenario(req, store);
        const existingData = (await store.getByHash(hash, scenario)) as MockData | null;
        if (!existingData?.response) return res.status(404).json({ error: 'Mock not found' });

        const copyResult = copyArrayItemInResponseData(existingData.response.data, copyParams);
        existingData.response.data = copyResult.data;
        existingData.timestamp = new Date().toISOString();
        await store.setByHash(hash, existingData, scenario);

        return res.json({
          success: true,
          filename: relativeName,
          scenario,
          arrayPath: copyParams.arrayPath,
          newItemIndex: copyResult.newItemIndex,
          arrayLength: copyResult.arrayLength,
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenarioPath = getScenarioFolderPath(mockDataPath, resolveFilesystemScenario(req, mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Mock file not found' });
    }

    const existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
    if (!existingData.response) {
      existingData.response = { status: 200, data: {}, headers: {} };
    }

    const copyResult = copyArrayItemInResponseData(existingData.response.data, copyParams);
    existingData.response.data = copyResult.data;
    existingData.timestamp = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');

    return res.json({
      success: true,
      filename: relativeName,
      scenario: resolveFilesystemScenario(req, mockDataPath),
      arrayPath: copyParams.arrayPath,
      newItemIndex: copyResult.newItemIndex,
      arrayLength: copyResult.arrayLength,
    });
  } catch (error: unknown) {
    console.error('[MocksRoute] copy-array-item - Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(400).json({ error: message || 'Failed to copy array item' });
  }
});

// Get a specific mock file — filename may contain slashes (e.g. host/graphql/file.json)
router.get('/*', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);

    if (isCentralizedDashboardProvider(config.provider)) {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });
    const store = createDashboardMockStore(config, mockDataPath);
      try {
        const scenario = await resolveRedisScenario(req, store);
        const data = await store.getByHash(hash, scenario);
        if (!data) return res.status(404).json({ error: 'Mock not found' });
        const payload = JSON.stringify(data);
        const ts = data.timestamp ? new Date(data.timestamp) : new Date();
        return res.json({
          filename: relativeName,
          data,
          metadata: {
            size: Buffer.byteLength(payload),
            created: ts.toISOString(),
            modified: ts.toISOString(),
          },
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenarioPath = getScenarioFolderPath(mockDataPath, resolveFilesystemScenario(req, mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);

    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });

    const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const stats = fs.statSync(filePath);
    res.json({
      filename: relativeName,
      data: mockData,
      metadata: { size: stats.size, created: stats.birthtime, modified: stats.mtime },
    });
  } catch (error: any) {
    console.error('[MocksRoute] Get - Error:', error);
    res.status(500).json({ error: 'Failed to read mock file', details: error.message });
  }
});

// Update a mock file
router.put('/*', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);

    if (isCentralizedDashboardProvider(config.provider)) {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });
      if (!req.body || req.body.responseData === undefined) {
        return res.status(400).json({ error: 'Request body must contain responseData field' });
      }

    const store = createDashboardMockStore(config, mockDataPath);
      try {
        const scenario = await resolveRedisScenario(req, store);
        if (await store.isScenarioLocked(scenario)) {
          return res.status(423).json({ error: SCENARIO_MOCK_LOCKED_MESSAGE });
        }
        const existingData = await store.getByHash(hash, scenario);
        if (!existingData) return res.status(404).json({ error: 'Mock not found' });

        let parsedResponseData: any;
        try {
          parsedResponseData =
            typeof req.body.responseData === 'string'
              ? JSON.parse(req.body.responseData)
              : req.body.responseData;
        } catch (e: any) {
          return res.status(400).json({ error: 'Invalid JSON', details: e.message });
        }

        if (!(existingData as any).response) (existingData as any).response = { status: 200, data: {}, headers: {} };
        (existingData as any).response.data = parsedResponseData;

        // In Redis mode, the dashboard "Recent (last 5 saved)" list is derived from `mockData.timestamp`.
        // Update it on every save so recent edits are reflected in the UI ordering.
        (existingData as any).timestamp = new Date().toISOString();

        // Keep behavior consistent with filesystem provider: allow saving responseDateOverrides.
        if (Object.prototype.hasOwnProperty.call(req.body, 'responseDateOverrides')) {
          const raw = req.body.responseDateOverrides;
          if (raw === null) {
            delete (existingData as any).responseDateOverrides;
          } else if (Array.isArray(raw)) {
            for (const item of raw) {
              if (!item || typeof item !== 'object' || typeof (item as any).path !== 'string' || !(item as any).path.trim()) {
                return res.status(400).json({
                  error: 'Each responseDateOverrides entry must be an object with a non-empty path string',
                });
              }
              if (
                (item as any).base !== undefined &&
                (item as any).base !== 'now' &&
                (item as any).base !== 'response'
              ) {
                return res.status(400).json({
                  error: "responseDateOverrides.base must be 'now' or 'response' when provided",
                });
              }
            }
            if (raw.length === 0) {
              delete (existingData as any).responseDateOverrides;
            } else {
              (existingData as any).responseDateOverrides = raw;
            }
          } else {
            return res.status(400).json({ error: 'responseDateOverrides must be an array or null' });
          }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'alwaysUseRealApi') ||
            Object.prototype.hasOwnProperty.call(req.body, 'refreshOnNextRequest') ||
            Object.prototype.hasOwnProperty.call(req.body, 'alwaysRefreshFromLive') ||
            Object.prototype.hasOwnProperty.call(req.body, 'replayMode')) {
          const replayErr = applyReplayModeFieldsFromBody(existingData as MockData, req.body);
          if (replayErr) {
            return res.status(400).json({ error: replayErr });
          }
        }

        await store.setByHash(hash, existingData as any, scenario);
        const payload = JSON.stringify(existingData);
        const ts = (existingData as any).timestamp ? new Date((existingData as any).timestamp) : new Date();
        return res.json({
          success: true,
          message: `Mock updated successfully`,
          filename: relativeName,
          metadata: { size: Buffer.byteLength(payload), modified: ts.toISOString() },
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenario = resolveFilesystemScenario(req, mockDataPath);
    if (isScenarioLockedFs(mockDataPath, scenario)) {
      return res.status(423).json({ error: SCENARIO_MOCK_LOCKED_MESSAGE });
    }
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const filePath = resolveFilePath(scenarioPath, relativeName);

    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });
    if (!req.body || req.body.responseData === undefined) {
      return res.status(400).json({ error: 'Request body must contain responseData field' });
    }

    let existingData: any;
    try { existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch { return res.status(400).json({ error: 'Existing file is not valid JSON' }); }

    let parsedResponseData;
    try {
      parsedResponseData = typeof req.body.responseData === 'string'
        ? JSON.parse(req.body.responseData) : req.body.responseData;
    } catch (e: any) {
      return res.status(400).json({ error: 'Invalid JSON', details: e.message });
    }

    if (!existingData.response) existingData.response = { status: 200, data: {}, headers: {} };
    existingData.response.data = parsedResponseData;

    if (Object.prototype.hasOwnProperty.call(req.body, 'responseDateOverrides')) {
      const raw = req.body.responseDateOverrides;
      if (raw === null) {
        delete existingData.responseDateOverrides;
      } else if (Array.isArray(raw)) {
        for (const item of raw) {
          if (!item || typeof item !== 'object' || typeof item.path !== 'string' || !item.path.trim()) {
            return res.status(400).json({
              error: 'Each responseDateOverrides entry must be an object with a non-empty path string',
            });
          }
          if (item.base !== undefined && item.base !== 'now' && item.base !== 'response') {
            return res.status(400).json({
              error: "responseDateOverrides.base must be 'now' or 'response' when provided",
            });
          }
        }
        if (raw.length === 0) {
          delete existingData.responseDateOverrides;
        } else {
          existingData.responseDateOverrides = raw;
        }
      } else {
        return res.status(400).json({ error: 'responseDateOverrides must be an array or null' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'alwaysUseRealApi') ||
        Object.prototype.hasOwnProperty.call(req.body, 'refreshOnNextRequest') ||
        Object.prototype.hasOwnProperty.call(req.body, 'alwaysRefreshFromLive') ||
        Object.prototype.hasOwnProperty.call(req.body, 'replayMode')) {
      const replayErr = applyReplayModeFieldsFromBody(existingData as MockData, req.body);
      if (replayErr) {
        return res.status(400).json({ error: replayErr });
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8');

    const stats = fs.statSync(filePath);
    console.log(`[MocksRoute] Updated mock file: ${relativeName}`);
    res.json({ success: true, message: `Mock file updated successfully`, filename: relativeName, metadata: { size: stats.size, modified: stats.mtime } });
  } catch (error: any) {
    console.error('[MocksRoute] Update - Error:', error);
    res.status(500).json({ error: 'Failed to update mock file', details: error.message });
  }
});

router.post('/bulk-live-api', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const { scenario, domainPath, useLiveApi } = req.body || {};
    if (typeof scenario !== 'string' || !scenario.trim()) {
      return res.status(400).json({ error: 'scenario is required' });
    }
    if (typeof domainPath !== 'string' || !domainPath.trim()) {
      return res.status(400).json({ error: 'domainPath is required (host or host/path prefix)' });
    }
    if (typeof useLiveApi !== 'boolean') {
      return res.status(400).json({ error: 'useLiveApi must be a boolean' });
    }

    const result = await bulkSetLiveApiForDomain({
      provider: config.provider,
      mockDataPath,
      scenario: scenario.trim(),
      domainPath: domainPath.trim(),
      useLiveApi,
      redisUrl: config.redisUrl,
      keyPrefix: config.keyPrefix,
      redisCluster: config.redisCluster,
    });
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message || 'bulk-live-api failed' });
  }
});

/** Bulk capture upstream responses for pending mocks under a domain-tree path prefix. */
router.post('/bulk-capture-responses', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const { scenario, domainPath, clientId } = req.body || {};
    if (typeof scenario !== 'string' || !scenario.trim()) {
      return res.status(400).json({ error: 'scenario is required' });
    }
    if (typeof domainPath !== 'string' || !domainPath.trim()) {
      return res.status(400).json({ error: 'domainPath is required (host or host/path prefix)' });
    }
    if (clientId !== undefined && typeof clientId !== 'string') {
      return res.status(400).json({ error: 'clientId must be a string when provided' });
    }

    const result = await bulkCaptureResponsesForDomain({
      provider: config.provider,
      mockDataPath,
      scenario: scenario.trim(),
      domainPath: domainPath.trim(),
      clientId: typeof clientId === 'string' && clientId.trim() ? clientId.trim() : undefined,
      redisUrl: config.redisUrl,
      keyPrefix: config.keyPrefix,
      redisCluster: config.redisCluster,
    });
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message || 'bulk-capture-responses failed' });
  }
});

// Delete a mock file
router.delete('/*', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);

    if (isCentralizedDashboardProvider(config.provider)) {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });
    const store = createDashboardMockStore(config, mockDataPath);
      try {
        const scenario = await resolveRedisScenario(req, store);
        if (await store.isScenarioLocked(scenario)) {
          return res.status(423).json({ error: SCENARIO_MOCK_LOCKED_MESSAGE });
        }
        await store.deleteByHash(hash, scenario);
        return res.json({ success: true, message: `Mock deleted successfully`, filename: relativeName });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenario = resolveFilesystemScenario(req, mockDataPath);
    if (isScenarioLockedFs(mockDataPath, scenario)) {
      return res.status(423).json({ error: SCENARIO_MOCK_LOCKED_MESSAGE });
    }
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const filePath = resolveFilePath(scenarioPath, relativeName);

    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });

    fs.unlinkSync(filePath);
    console.log(`[MocksRoute] Deleted mock file: ${relativeName}`);
    res.json({ success: true, message: `Mock file deleted successfully`, filename: relativeName });
  } catch (error: any) {
    console.error('[MocksRoute] Delete - Error:', error);
    res.status(500).json({ error: 'Failed to delete mock file', details: error.message });
  }
});

router.post('/*/refresh-from-live', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);
    const clientId =
      typeof req.body?.clientId === 'string' && req.body.clientId.trim()
        ? req.body.clientId.trim()
        : undefined;

    if (isCentralizedDashboardProvider(config.provider)) {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });

    const store = createDashboardMockStore(config, mockDataPath);
      try {
        const scenario = await resolveRedisScenario(req, store);
        const existingData = (await store.getByHash(hash, scenario)) as MockData | null;
        if (!existingData?.request?.url) {
          return res.status(404).json({ error: 'Mock not found' });
        }

        const { response, durationMs } = await fetchUpstreamResponse(existingData.request, { clientId });
        const updated = buildMockDataAfterLiveCapture(existingData, response, durationMs);
        await store.setByHash(hash, updated, scenario);

        return res.json({
          success: true,
          message: 'Mock refreshed from live API',
          filename: relativeName,
          data: updated,
        });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenarioPath = getScenarioFolderPath(mockDataPath, resolveFilesystemScenario(req, mockDataPath));
    const filePath = resolveFilePath(scenarioPath, relativeName);
    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });

    const existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MockData;
    if (!existingData?.request?.url) {
      return res.status(400).json({ error: 'Mock has no request URL' });
    }

    const { response, durationMs } = await fetchUpstreamResponse(existingData.request, { clientId });
    const updated = buildMockDataAfterLiveCapture(existingData, response, durationMs);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');

    return res.json({
      success: true,
      message: 'Mock refreshed from live API',
      filename: relativeName,
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[MocksRoute] refresh-from-live - Error:', error);
    return res.status(500).json({ error: 'Failed to refresh mock from live API', details: message });
  }
});

// Duplicate a mock file
router.post('/*/duplicate', async (req: Request, res: Response) => {
  try {
    // params[0] captures everything between the leading / and /duplicate
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);

    if (isCentralizedDashboardProvider(config.provider)) {
      // Redis provider keys are derived from request key hashes, so "duplicate" would overwrite the same key.
      return res.status(400).json({
        error: 'Duplicate is not supported for Redis-backed mocks (keys are deterministic per request).',
      });
    }

    const scenario = resolveFilesystemScenario(req, mockDataPath);
    if (isScenarioLockedFs(mockDataPath, scenario)) {
      return res.status(423).json({ error: SCENARIO_MOCK_LOCKED_MESSAGE });
    }
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const filePath = resolveFilePath(scenarioPath, relativeName);

    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Mock file not found' });

    const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dir = path.dirname(filePath);
    const base = path.basename(relativeName, '.json');
    const newFilename = `${timestamp}_${base}_copy.json`;
    const newFilePath = path.join(dir, newFilename);
    mockData.timestamp = new Date().toISOString();
    fs.writeFileSync(newFilePath, JSON.stringify(mockData, null, 2), 'utf-8');

    const newRelative = path.relative(scenarioPath, newFilePath);
    res.json({ success: true, message: 'Mock file duplicated successfully', originalFilename: relativeName, newFilename: newRelative });
  } catch (error: any) {
    console.error('[MocksRoute] Duplicate - Error:', error);
    res.status(500).json({ error: 'Failed to duplicate mock file', details: error.message });
  }
});

export const mocksRouter = router;
