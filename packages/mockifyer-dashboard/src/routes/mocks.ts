import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getAllJsonFiles } from '../utils/json-files';
import { getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';

const router = express.Router();

type OverridePreview = { path: string; summary: string };
const SCENARIO_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

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

function readScenarioQuery(req: Request, res: Response): string | undefined | null {
  const raw = req.query.scenario;
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    res.status(400).json({ error: 'Scenario name must be a string' });
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (!SCENARIO_NAME_PATTERN.test(trimmed)) {
    res.status(400).json({
      error: `Invalid scenario name: "${trimmed}". Use only letters, numbers, hyphens, and underscores.`,
    });
    return null;
  }
  return trimmed;
}

/** Scenario from ?scenario= or Redis active key + filesystem fallback (matches proxy when body scenario is omitted). */
async function resolveRedisScenario(req: Request, res: Response, store: RedisMockStore): Promise<string | null> {
  const requested = readScenarioQuery(req, res);
  if (requested === null) return null;
  if (requested !== undefined) return requested;
  return store.getActiveScenario();
}

/** Scenario from ?scenario= or local scenario-config (align with GET /mocks list). */
function resolveFilesystemScenario(req: Request, res: Response, mockDataPath: string): string | null {
  const requested = readScenarioQuery(req, res);
  if (requested === null) return null;
  if (requested !== undefined) return requested;
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

// List all mock files (recursive)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const requestedScenario = readScenarioQuery(req, res);
    if (requestedScenario === null) return;
    const scenario = requestedScenario || getCurrentScenario(mockDataPath);

    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
      try {
        const items = await store.list(scenario);
        const files = items
          .map(({ hash, mockData, redisKey }) => {
            const payload = JSON.stringify(mockData);
            const ts = mockData.timestamp ? new Date(mockData.timestamp) : new Date();

            let endpoint: string | null = null;
            let graphqlInfo: any = null;
            let sessionId: string | null = null;
            let alwaysUseRealApi = false;
            const { hasOverrides, preview } = getOverridePreview(mockData);
            try {
              if (mockData.request?.url) endpoint = mockData.request.url;
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
                };
              }
              sessionId = (mockData as any).sessionId || null;
              alwaysUseRealApi = (mockData as any).alwaysUseRealApi === true;
            } catch {
              // ignore
            }

            // Use a stable pseudo-filename for UI routing. Must end with .json.
            const filename = `redis/${hash}.json`;
            return {
              filename,
              filePath: `redis://${redisKey}`,
              size: Buffer.byteLength(payload),
              created: ts.toISOString(),
              modified: ts.toISOString(),
              endpoint,
              graphqlInfo,
              sessionId,
              alwaysUseRealApi,
              hasResponseDateOverrides: hasOverrides,
              responseDateOverridesPreview: preview,
            };
          })
          .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
        return res.json({ files, mockDataPath, scenario });
      } catch (error: any) {
        console.error('[MocksRoute] Redis List - Error:', error);
        return res.status(500).json({ error: 'Failed to list Redis mocks', details: error.message });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);

    if (!fs.existsSync(mockDataPath) || !fs.existsSync(scenarioPath)) {
      return res.json({ files: [], mockDataPath, scenario });
    }

    const files = getAllJsonFiles(scenarioPath)
      .map(filePath => {
        const relativeName = path.relative(scenarioPath, filePath);
        const stats = fs.statSync(filePath);

        let endpoint = null;
        let graphqlInfo = null;
        let sessionId = null;
        let alwaysUseRealApi = false;
        let hasResponseDateOverrides = false;
        let responseDateOverridesPreview: OverridePreview[] = [];
        try {
          const mockData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          if (mockData.request?.url) {
            endpoint = mockData.request.url;
          }
          if (mockData.alwaysUseRealApi === true) {
            alwaysUseRealApi = true;
          }
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
              graphqlInfo = { query: bodyData.query, variables: bodyData.variables || null };
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
          graphqlInfo,
          sessionId,
          alwaysUseRealApi,
          hasResponseDateOverrides,
          responseDateOverridesPreview,
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());

    res.json({ files, mockDataPath, scenario });
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
    const requestedScenario = readScenarioQuery(req, res);
    if (requestedScenario === null) return;
    const scenario = requestedScenario || getCurrentScenario(mockDataPath);

    if (!q) {
      return res.json({ files: [], mockDataPath, scenario, query: '', truncated: false });
    }

    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });

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

      try {
        const mockData = JSON.parse(content);
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

// Get a specific mock file — filename may contain slashes (e.g. host/graphql/file.json)
router.get('/*', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);

    if (config.provider === 'redis') {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
      try {
        const scenario = await resolveRedisScenario(req, res, store);
        if (scenario === null) return;
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

    const scenario = resolveFilesystemScenario(req, res, mockDataPath);
    if (scenario === null) return;
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
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

    if (config.provider === 'redis') {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });
      if (!req.body || req.body.responseData === undefined) {
        return res.status(400).json({ error: 'Request body must contain responseData field' });
      }

      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
      try {
        const scenario = await resolveRedisScenario(req, res, store);
        if (scenario === null) return;
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

        if (Object.prototype.hasOwnProperty.call(req.body, 'alwaysUseRealApi')) {
          const v = req.body.alwaysUseRealApi;
          if (v === true) {
            (existingData as any).alwaysUseRealApi = true;
          } else if (v === false || v === null) {
            delete (existingData as any).alwaysUseRealApi;
          } else {
            return res.status(400).json({ error: 'alwaysUseRealApi must be true, false, or null' });
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

    const scenario = resolveFilesystemScenario(req, res, mockDataPath);
    if (scenario === null) return;
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

    if (Object.prototype.hasOwnProperty.call(req.body, 'alwaysUseRealApi')) {
      const v = req.body.alwaysUseRealApi;
      if (v === true) {
        existingData.alwaysUseRealApi = true;
      } else if (v === false || v === null) {
        delete existingData.alwaysUseRealApi;
      } else {
        return res.status(400).json({ error: 'alwaysUseRealApi must be true, false, or null' });
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

// Delete a mock file
router.delete('/*', async (req: Request, res: Response) => {
  try {
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);

    if (config.provider === 'redis') {
      const hash = parseRedisHashFromFilename(relativeName);
      if (!hash) return res.status(400).json({ error: 'Invalid filename' });
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
      try {
        const scenario = await resolveRedisScenario(req, res, store);
        if (scenario === null) return;
        await store.deleteByHash(hash, scenario);
        return res.json({ success: true, message: `Mock deleted successfully`, filename: relativeName });
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const scenario = resolveFilesystemScenario(req, res, mockDataPath);
    if (scenario === null) return;
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

// Duplicate a mock file
router.post('/*/duplicate', async (req: Request, res: Response) => {
  try {
    // params[0] captures everything between the leading / and /duplicate
    const relativeName = req.params[0];
    const { mockDataPath, config } = getDashboardContext(req);

    if (config.provider === 'redis') {
      // Redis provider keys are derived from request key hashes, so "duplicate" would overwrite the same key.
      return res.status(400).json({
        error: 'Duplicate is not supported for Redis-backed mocks (keys are deterministic per request).',
      });
    }

    const scenario = resolveFilesystemScenario(req, res, mockDataPath);
    if (scenario === null) return;
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
