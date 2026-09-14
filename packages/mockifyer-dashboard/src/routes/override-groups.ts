import express, { Request, Response } from 'express';
import {
  OVERRIDE_GROUP_ID_PATTERN,
  deleteOverrideGroupFromDisk,
  deleteClientOverrideGroupConfig,
  getCurrentScenario,
  getScenarioFolderPath,
  hydrateOverrideGroupRuntimeFromScenarioPath,
  listOverrideGroupsFromDisk,
  listScenarios,
  normalizeMockOverrideGroup,
  readClientOverrideGroupConfig,
  readOverrideGroupConfig,
  readOverrideGroupFromDisk,
  upsertOverrideGroupEntry,
  ensureOverrideGroupEntry,
  validateMockOverrideGroup,
  writeClientOverrideGroupConfig,
  writeOverrideGroupConfig,
  writeOverrideGroupToDisk,
  type MockOverrideGroup,
  type MockOverrideGroupEntry,
} from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';

const router = express.Router();

function sanitizeScenarioCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (sanitized !== trimmed) return null;
  return sanitized;
}

async function resolveScenario(req: Request, mockDataPath: string): Promise<string> {
  const { config } = getDashboardContext(req);
  const raw =
    (typeof req.query.scenario === 'string' && req.query.scenario) ||
    (typeof req.body?.scenario === 'string' && req.body.scenario) ||
    '';
  if (raw) {
    const s = sanitizeScenarioCandidate(raw);
    if (s) {
      if (isCentralizedDashboardProvider(config.provider)) return s;
      const scenarios = listScenarios(mockDataPath);
      if (scenarios.includes(s)) return s;
    }
  }
  if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      return await store.getActiveScenario();
    } finally {
      await store.close().catch(() => undefined);
    }
  }
  return getCurrentScenario(mockDataPath);
}

function scenarioPathFor(mockDataPath: string, scenario: string): string {
  return getScenarioFolderPath(mockDataPath, scenario);
}


function readClientId(req: Request): string | null {
  const raw =
    (typeof req.query.clientId === 'string' && req.query.clientId) ||
    (typeof req.body?.clientId === 'string' && req.body.clientId) ||
    '';
  const trimmed = raw.trim();
  return trimmed || null;
}

async function resolveLaneOverrideGroup(
  req: Request,
  mockDataPath: string,
  clientId: string | null
): Promise<string | null> {
  if (!clientId) return null;
  const { config } = getDashboardContext(req);
  if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      return await store.getLaneOverrideGroup(clientId);
    } finally {
      await store.close().catch(() => undefined);
    }
  }
  return null;
}

async function writeLaneOverrideGroup(
  req: Request,
  mockDataPath: string,
  clientId: string,
  groupId: string | null
): Promise<void> {
  const { config } = getDashboardContext(req);
  if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      await store.setLaneOverrideGroup(clientId, groupId);
    } finally {
      await store.close().catch(() => undefined);
    }
  }
}

/** GET /api/override-groups — list groups + default/lane/effective selection */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = await resolveScenario(req, mockDataPath);
    const scenarioPath = scenarioPathFor(mockDataPath, scenario);
    if (!scenarioPath) return;
    const clientId = readClientId(req);
    const { config } = getDashboardContext(req);
    const redisLane = isCentralizedDashboardProvider(config.provider)
      ? await resolveLaneOverrideGroup(req, mockDataPath, clientId)
      : undefined;
    const hydrated = hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath, {
      clientId,
      ...(redisLane !== undefined ? { laneGroupId: redisLane } : {}),
    });
    const laneGroup = hydrated.laneGroup;
    res.json({
      scenario,
      clientId,
      defaultGroup: hydrated.defaultGroup,
      laneGroup,
      currentGroup: hydrated.currentGroup,
      source: hydrated.source,
      updatedAt: readOverrideGroupConfig(scenarioPath).updatedAt ?? null,
      groups: hydrated.groups.map((g) => ({
        id: g.id,
        label: g.label,
        updatedAt: g.updatedAt,
        entryCount: g.entries.length,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OverrideGroups] list - Error:', error);
    res.status(500).json({ error: 'Failed to list override groups', details: message });
  }
});

/** GET /api/override-groups/config?clientId= */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = await resolveScenario(req, mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const clientId = readClientId(req);
    const { config } = getDashboardContext(req);
    const redisLane = isCentralizedDashboardProvider(config.provider)
      ? await resolveLaneOverrideGroup(req, mockDataPath, clientId)
      : undefined;
    const hydrated = hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath, {
      clientId,
      ...(redisLane !== undefined ? { laneGroupId: redisLane } : {}),
    });
    res.json({
      scenario,
      clientId,
      defaultGroup: hydrated.defaultGroup,
      laneGroup: hydrated.laneGroup,
      currentGroup: hydrated.currentGroup,
      source: hydrated.source,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OverrideGroups] get config - Error:', error);
    res.status(500).json({ error: 'Failed to get override group config', details: message });
  }
});

/**
 * PUT /api/override-groups/config
 * Body: { currentGroup, clientId?, scope?: 'default' | 'lane' }
 * - With clientId (or scope=lane): sets per-lane selection (does not change scenario default)
 * - Without clientId: sets scenario default only
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config: dashConfig } = getDashboardContext(req);
    const scenario = await resolveScenario(req, mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const clientId = readClientId(req);
    const scopeRaw = typeof req.body?.scope === 'string' ? req.body.scope.trim() : '';
    const scope =
      scopeRaw === 'lane' || scopeRaw === 'default'
        ? scopeRaw
        : clientId
          ? 'lane'
          : 'default';

    const raw = req.body?.currentGroup;
    const currentGroup =
      raw === null || raw === undefined || raw === ''
        ? null
        : String(raw).trim();

    if (currentGroup != null) {
      if (!OVERRIDE_GROUP_ID_PATTERN.test(currentGroup)) {
        return res.status(400).json({ error: `currentGroup must match ${OVERRIDE_GROUP_ID_PATTERN}` });
      }
      const group = readOverrideGroupFromDisk(scenarioPath, currentGroup);
      if (!group) {
        return res.status(404).json({ error: `Override group not found: ${currentGroup}` });
      }
    }

    if (scope === 'lane') {
      if (!clientId) {
        return res.status(400).json({ error: 'clientId is required when setting a lane override group' });
      }
      if (isCentralizedDashboardProvider(dashConfig.provider)) {
        await writeLaneOverrideGroup(req, mockDataPath, clientId, currentGroup);
      } else if (currentGroup == null) {
        deleteClientOverrideGroupConfig(scenarioPath, clientId);
      } else {
        writeClientOverrideGroupConfig(scenarioPath, clientId, { currentGroup });
      }
      const redisLane = await resolveLaneOverrideGroup(req, mockDataPath, clientId);
      const hydrated = hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath, {
        clientId,
        ...(redisLane !== undefined ? { laneGroupId: redisLane } : {}),
      });
      return res.json({
        success: true,
        scenario,
        clientId,
        scope: 'lane',
        defaultGroup: hydrated.defaultGroup,
        laneGroup: hydrated.laneGroup,
        currentGroup: hydrated.currentGroup,
        source: hydrated.source,
      });
    }

    const config = writeOverrideGroupConfig(scenarioPath, { currentGroup });
    const hydrated = hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath, { clientId });
    res.json({
      success: true,
      scenario,
      clientId,
      scope: 'default',
      defaultGroup: config.currentGroup,
      laneGroup: hydrated.laneGroup,
      currentGroup: hydrated.currentGroup,
      source: hydrated.source,
      updatedAt: config.updatedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OverrideGroups] put config - Error:', error);
    res.status(500).json({ error: 'Failed to set active override group', details: message });
  }
});

/** GET /api/override-groups/:id */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = await resolveScenario(req, mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const id = String(req.params.id || '').trim();
    if (!OVERRIDE_GROUP_ID_PATTERN.test(id)) {
      return res.status(400).json({ error: `id must match ${OVERRIDE_GROUP_ID_PATTERN}` });
    }
    const group = readOverrideGroupFromDisk(scenarioPath, id);
    if (!group) {
      return res.status(404).json({ error: `Override group not found: ${id}` });
    }
    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);
    res.json({ scenario, group });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OverrideGroups] get - Error:', error);
    res.status(500).json({ error: 'Failed to get override group', details: message });
  }
});

/** PUT /api/override-groups/:id — create or replace full group document */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = await resolveScenario(req, mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const id = String(req.params.id || '').trim();
    if (!OVERRIDE_GROUP_ID_PATTERN.test(id)) {
      return res.status(400).json({ error: `id must match ${OVERRIDE_GROUP_ID_PATTERN}` });
    }

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Partial<MockOverrideGroup>;
    const candidate: MockOverrideGroup = {
      id,
      label: typeof body.label === 'string' ? body.label : id,
      updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : new Date().toISOString(),
      entries: Array.isArray(body.entries) ? (body.entries as MockOverrideGroupEntry[]) : [],
    };
    const err = validateMockOverrideGroup(candidate);
    if (err) {
      return res.status(400).json({ error: err });
    }

    const saved = writeOverrideGroupToDisk(scenarioPath, normalizeMockOverrideGroup(candidate));
    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);
    res.json({ success: true, scenario, group: saved });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OverrideGroups] put - Error:', error);
    res.status(500).json({ error: 'Failed to save override group', details: message });
  }
});

/**
 * PATCH /api/override-groups/:id/entries
 * Upsert or clear one mock's overlays inside the group.
 * Body: { filename, responseFieldOverrides?, responseDateOverrides?, clear?: boolean, ensure?: boolean }
 */
router.patch('/:id/entries', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = await resolveScenario(req, mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const id = String(req.params.id || '').trim();
    if (!OVERRIDE_GROUP_ID_PATTERN.test(id)) {
      return res.status(400).json({ error: `id must match ${OVERRIDE_GROUP_ID_PATTERN}` });
    }

    const group = readOverrideGroupFromDisk(scenarioPath, id);
    if (!group) {
      return res.status(404).json({ error: `Override group not found: ${id}` });
    }

    const filename =
      typeof req.body?.filename === 'string' ? req.body.filename.trim().replace(/\\/g, '/') : '';
    if (!filename || filename.includes('..') || !filename.endsWith('.json')) {
      return res.status(400).json({ error: 'filename must be a scenario-relative .json path' });
    }

    let next: MockOverrideGroup;
    if (req.body?.clear === true) {
      // Clear only field overrides, preserve date overlays
      const existing = group.entries.find((e) => e.filename === filename);
      next = upsertOverrideGroupEntry(group, {
        filename,
        responseFieldOverrides: [],
        responseDateOverrides: existing?.responseDateOverrides ?? [],
      });
    } else if (req.body?.ensure === true) {
      next = ensureOverrideGroupEntry(group, filename);
    } else {
      const entry: MockOverrideGroupEntry = {
        filename,
        responseFieldOverrides: Array.isArray(req.body?.responseFieldOverrides)
          ? req.body.responseFieldOverrides
          : undefined,
        responseDateOverrides: Array.isArray(req.body?.responseDateOverrides)
          ? req.body.responseDateOverrides
          : undefined,
      };
      // Preserve existing date overlays when only fields are sent (and vice versa).
      const existing = group.entries.find((e) => e.filename === filename);
      if (entry.responseFieldOverrides === undefined) {
        entry.responseFieldOverrides = existing?.responseFieldOverrides;
      }
      if (entry.responseDateOverrides === undefined) {
        entry.responseDateOverrides = existing?.responseDateOverrides;
      }
      next = upsertOverrideGroupEntry(group, entry);
    }

    const saved = writeOverrideGroupToDisk(scenarioPath, next);
    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);
    res.json({ success: true, scenario, group: saved });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OverrideGroups] patch entries - Error:', error);
    res.status(500).json({ error: 'Failed to update override group entry', details: message });
  }
});

/** DELETE /api/override-groups/:id */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { mockDataPath } = getDashboardContext(req);
    const scenario = await resolveScenario(req, mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    const id = String(req.params.id || '').trim();
    if (!OVERRIDE_GROUP_ID_PATTERN.test(id)) {
      return res.status(400).json({ error: `id must match ${OVERRIDE_GROUP_ID_PATTERN}` });
    }

    const deleted = deleteOverrideGroupFromDisk(scenarioPath, id);
    if (!deleted) {
      return res.status(404).json({ error: `Override group not found: ${id}` });
    }

    const config = readOverrideGroupConfig(scenarioPath);
    if (config.currentGroup === id) {
      writeOverrideGroupConfig(scenarioPath, { currentGroup: null });
    }
    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);
    res.json({ success: true, scenario, deleted: id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[OverrideGroups] delete - Error:', error);
    res.status(500).json({ error: 'Failed to delete override group', details: message });
  }
});

export default router;
