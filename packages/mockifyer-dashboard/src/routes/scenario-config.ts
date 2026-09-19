import express, { Request, Response } from 'express';
import {
  getCurrentScenario,
  listScenarios,
  createScenario,
  saveScenarioConfig,
  DEFAULT_SCENARIO,
  SCRATCH_SCENARIO,
  isScratchScenario,
  getScratchScenarioTtlSec,
  scratchScenarioDisplayName,
  getScenarioFolderPath,
  hydrateOverrideGroupRuntimeFromScenarioPath,
  POOL_DIR_NAME,
} from '@sgedda/mockifyer-core';
import {
  setScenarioLockedFs,
  isScenarioLockedFs,
  findCaseInsensitiveScenarioConflict,
  SCENARIO_META_FILENAME,
} from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';
import {
  applyScenarioImport,
  buildFilesystemScenarioBundle,
  buildRedisScenarioBundle,
  clearScenarioMocks,
  deleteEntireScenario,
  renameEntireScenario,
  parseScenarioImportRequest,
} from '../utils/scenario-bundle';
import { getAtlasStore } from '../utils/atlas-store';
import { createNetworkLogStore } from '../utils/network-log-store';
import { resetReplayModesInScenarioFolder } from '../utils/scenario-clone-replay-mode';
import fs from 'fs';
import path from 'path';

const router = express.Router();

function sanitizeScenarioName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'Scenario name is required' };
  }
  const trimmed = raw.trim();
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (sanitized !== trimmed) {
    return {
      ok: false,
      error: `Invalid scenario name: "${trimmed}". Use only letters, numbers, hyphens, and underscores.`,
    };
  }
  return { ok: true, value: sanitized };
}

function copyDirectoryRecursive(
  srcDir: string,
  destDir: string,
  options?: { skipFilenames?: Set<string> }
): void {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Base scenario folder not found: ${srcDir}`);
  }
  const skip = options?.skipFilenames ?? new Set<string>();
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    // Skip common junk.
    if (entry.name === '.DS_Store') continue;
    if (entry.isFile() && skip.has(entry.name)) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(src, dest, options);
      continue;
    }
    if (entry.isFile()) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

function scratchScenarioPayload(currentScenario: string) {
  return {
    scratchScenario: SCRATCH_SCENARIO,
    scratchScenarioLabel: scratchScenarioDisplayName(),
    isScratchScenario: isScratchScenario(currentScenario),
    scratchTtlSec: getScratchScenarioTtlSec(),
  };
}

// Get current scenario config
router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    let currentScenario = getCurrentScenario(mockDataPath);
    let scenarios = listScenarios(mockDataPath);

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        currentScenario = await store.getActiveScenario();
        const redisScenarios = await store.listScenarios();
        scenarios = Array.from(new Set([...scenarios, ...redisScenarios])).sort();
        const scenarioLocks = await store.getScenarioLocks(scenarios);
        res.json({
          currentScenario,
          scenarios,
          scenarioLocks,
          ...scratchScenarioPayload(currentScenario),
          success: true,
        });
      } finally {
        await store.close().catch(() => undefined);
      }
      return;
    }

    const scenarioLocks: Record<string, boolean> = {};
    for (const name of scenarios) {
      scenarioLocks[name] = isScenarioLockedFs(mockDataPath, name);
    }

    res.json({
      currentScenario,
      scenarios,
      scenarioLocks,
      ...scratchScenarioPayload(currentScenario),
      success: true,
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Get - Error:', error);
    res.status(500).json({ error: 'Failed to read scenario config', details: error.message });
  }
});

// Set current scenario
router.post('/set', async (req: Request, res: Response) => {
  console.log('[ScenarioConfigRoute] POST /set received', { body: req.body, path: req.path });
  try {
    const { scenario } = req.body;
    const { mockDataPath, config } = getDashboardContext(req);
    
    const parsed = sanitizeScenarioName(scenario);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const sanitized = parsed.value;

    // Discover scenarios (filesystem + optionally Redis)
    let scenarios = listScenarios(mockDataPath);
    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const redisScenarios = await store.listScenarios();
        scenarios = Array.from(new Set([...scenarios, ...redisScenarios])).sort();
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    // Filesystem/sqlite: create missing scenario folders on switch (mirror Redis switch-first UX).
    if (!isCentralizedDashboardProvider(config.provider) && !scenarios.includes(sanitized)) {
      createScenario(mockDataPath, sanitized);
      scenarios = listScenarios(mockDataPath);
    }

    // Save scenario config:
    // - filesystem/sqlite: local file
    // - redis: centralized key in Redis
    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        await store.setActiveScenario(sanitized);
      } finally {
        await store.close().catch(() => undefined);
      }
    } else {
      saveScenarioConfig(mockDataPath, sanitized);
    }
    
    try {
      hydrateOverrideGroupRuntimeFromScenarioPath(getScenarioFolderPath(mockDataPath, sanitized));
    } catch {
      // Override groups are optional at scenario switch.
    }

    console.log(`[ScenarioConfigRoute] Set scenario to: ${sanitized}`);
    res.json({
      success: true,
      message: `Scenario switched to "${sanitized}"`,
      currentScenario: sanitized,
      scenarios: Array.from(new Set([...scenarios, sanitized])).sort(),
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Set - Error:', error);
    res.status(500).json({ error: 'Failed to set scenario', details: error.message });
  }
});

// Create new scenario
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { scenario, deriveFrom } = req.body as { scenario?: unknown; deriveFrom?: unknown };
    const { mockDataPath, config } = getDashboardContext(req);
    
    const parsedScenario = sanitizeScenarioName(scenario);
    if (!parsedScenario.ok) return res.status(400).json({ error: parsedScenario.error });
    const sanitized = parsedScenario.value;

    if (isScratchScenario(sanitized)) {
      return res.status(400).json({
        error:
          `"${sanitized}" is reserved for temporary unscoped traffic. ` +
          `Create a named scenario (e.g. "default") to keep mocks long-term.`,
      });
    }

    const parsedDerive =
      deriveFrom === undefined || deriveFrom === null || deriveFrom === ''
        ? null
        : sanitizeScenarioName(deriveFrom);
    if (parsedDerive !== null && !parsedDerive.ok) {
      return res.status(400).json({ error: parsedDerive.error });
    }
    const deriveFromScenario = parsedDerive === null ? null : parsedDerive.value;
    if (deriveFromScenario === sanitized) {
      return res.status(400).json({ error: 'deriveFrom must be different from the new scenario name' });
    }

    // Check if scenario already exists (filesystem + optionally Redis)
    let scenarios = listScenarios(mockDataPath);
    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const redisScenarios = await store.listScenarios();
        scenarios = Array.from(new Set([...scenarios, ...redisScenarios])).sort();
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    const nameConflict = findCaseInsensitiveScenarioConflict(sanitized, scenarios);
    if (nameConflict) {
      if (nameConflict === sanitized) {
        return res.status(409).json({
          error: `Scenario "${sanitized}" already exists`,
        });
      }
      return res.status(409).json({
        error: `Scenario name "${sanitized}" conflicts with existing "${nameConflict}" (names must be unique ignoring case)`,
      });
    }

    // Filesystem / sqlite: create on-disk scenario folder. Redis: scenarios materialize on first write — do not mkdir mockDataPath.
    if (!isCentralizedDashboardProvider(config.provider)) {
      createScenario(mockDataPath, sanitized);
    }

    // Optional: derive scenario data (copy mocks + date config) from an existing scenario.
    if (deriveFromScenario) {
      if (isCentralizedDashboardProvider(config.provider)) {
        const store = createDashboardMockStore(config, mockDataPath);
        try {
          const available = await store.listScenarios();
          if (!available.includes(deriveFromScenario)) {
            return res.status(404).json({
              error: `Base scenario "${deriveFromScenario}" does not exist in Redis`,
            });
          }
          await store.cloneScenario(deriveFromScenario, sanitized);
        } finally {
          await store.close().catch(() => undefined);
        }
      } else {
        const available = listScenarios(mockDataPath);
        if (!available.includes(deriveFromScenario)) {
          return res.status(404).json({
            error: `Base scenario "${deriveFromScenario}" does not exist`,
          });
        }
        const src = path.join(mockDataPath, deriveFromScenario);
        const dest = path.join(mockDataPath, sanitized);
        copyDirectoryRecursive(src, dest, {
          skipFilenames: new Set([SCENARIO_META_FILENAME]),
        });
        resetReplayModesInScenarioFolder(dest);
      }
    }

    // Also set the scenario immediately, provider-aware.
    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        await store.setActiveScenario(sanitized);
      } finally {
        await store.close().catch(() => undefined);
      }
    } else {
      saveScenarioConfig(mockDataPath, sanitized);
    }
    
    console.log(`[ScenarioConfigRoute] Created scenario: ${sanitized}`);
    res.json({
      success: true,
      message: `Scenario "${sanitized}" created successfully`,
      currentScenario: sanitized,
      scenarios: Array.from(new Set([...scenarios, sanitized])).sort(),
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Create - Error:', error);
    res.status(500).json({ error: 'Failed to create scenario', details: error.message });
  }
});

// Lock or unlock a scenario (blocks mock/date edits in dashboard & proxy record).
router.post('/lock', async (req: Request, res: Response) => {
  try {
    const { scenario, locked } = req.body as { scenario?: unknown; locked?: unknown };
    const { mockDataPath, config } = getDashboardContext(req);
    const parsed = sanitizeScenarioName(scenario);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const sanitized = parsed.value;
    const isLocked = locked === true || locked === 'true';

    let scenarios = listScenarios(mockDataPath);
    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const redisScenarios = await store.listScenarios();
        scenarios = Array.from(new Set([...scenarios, ...redisScenarios])).sort();
        if (!scenarios.some((s) => s === sanitized)) {
          return res.status(404).json({ error: `Scenario "${sanitized}" does not exist` });
        }
        await store.setScenarioLocked(sanitized, isLocked);

        console.log(`[ScenarioConfigRoute] Scenario "${sanitized}" locked=${isLocked}`);

        const currentScenario = await store.getActiveScenario();
        const scenarioLocks = await store.getScenarioLocks(scenarios);
        res.json({
          success: true,
          currentScenario,
          scenarios,
          scenarioLocks,
          scenario: sanitized,
          locked: isLocked,
        });
      } finally {
        await store.close().catch(() => undefined);
      }
      return;
    }

    if (!scenarios.includes(sanitized)) {
      return res.status(404).json({ error: `Scenario "${sanitized}" does not exist` });
    }
    setScenarioLockedFs(mockDataPath, sanitized, isLocked);

    console.log(`[ScenarioConfigRoute] Scenario "${sanitized}" locked=${isLocked}`);

    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioLocks: Record<string, boolean> = {};
    for (const name of scenarios) {
      scenarioLocks[name] = isScenarioLockedFs(mockDataPath, name);
    }
    res.json({
      success: true,
      currentScenario,
      scenarios,
      scenarioLocks,
      scenario: sanitized,
      locked: isLocked,
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Lock - Error:', error);
    res.status(500).json({ error: 'Failed to update scenario lock', details: error.message });
  }
});

// Export scenario as JSON (mocks + optional date/proxy settings)
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const raw = typeof req.query.scenario === 'string' ? req.query.scenario : undefined;
    const parsed = raw !== undefined && raw.trim() !== '' ? sanitizeScenarioName(raw) : null;
    const scenario = parsed !== null ? (parsed.ok ? parsed.value : null) : null;
    if (parsed !== null && !parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const effectiveScenario = scenario ?? getCurrentScenario(mockDataPath);

    if (isCentralizedDashboardProvider(config.provider)) {
      const bundle = await buildRedisScenarioBundle(
        mockDataPath,
        effectiveScenario,
        config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        config.keyPrefix,
        config.provider,
        config.redisCluster
      );
      return res.json(bundle);
    }

    const bundle = buildFilesystemScenarioBundle(mockDataPath, effectiveScenario, 'filesystem');
    return res.json(bundle);
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Export - Error:', error);
    res.status(500).json({ error: 'Failed to export scenario', details: error.message });
  }
});

// Import scenario from JSON (see SCENARIO_IMPORT_EXPORT.md)
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const { meta, bundle, bundleHadDateKey, bundleHadProxyKey } = parseScenarioImportRequest(req.body);

    const targetParsed = sanitizeScenarioName(meta.targetScenario ?? bundle.sourceScenario);
    if (!targetParsed.ok) {
      return res.status(400).json({ error: targetParsed.error });
    }
    const targetScenario = targetParsed.value;

    let scenarios = listScenarios(mockDataPath);
    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        const redisScenarios = await store.listScenarios();
        scenarios = Array.from(new Set([...scenarios, ...redisScenarios])).sort();
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    if (!scenarios.includes(targetScenario)) {
      if (!isCentralizedDashboardProvider(config.provider)) {
        createScenario(mockDataPath, targetScenario);
      }
      scenarios = Array.from(new Set([...scenarios, targetScenario])).sort();
    }

    const result = await applyScenarioImport({
      mockDataPath,
      targetScenario,
      bundle,
      replaceExistingMocks: meta.replaceExistingMocks,
      applyDateConfig: meta.applyDateConfig,
      bundleHadDateKey,
      applyProxyConfig: meta.applyProxyConfig,
      bundleHadProxyKey,
      provider: config.provider,
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL,
      keyPrefix: config.keyPrefix,
      redisCluster: config.redisCluster,
    });

    let scenariosOut = listScenarios(mockDataPath);
    if (isCentralizedDashboardProvider(config.provider)) {
      const storeAfter = createDashboardMockStore(config, mockDataPath);
      try {
        const redisScenarios = await storeAfter.listScenarios();
        scenariosOut = Array.from(new Set([...scenariosOut, ...redisScenarios])).sort();
      } finally {
        await storeAfter.close().catch(() => undefined);
      }
    }

    res.json({
      success: true,
      message: `Imported ${result.mocksWritten} mock(s) into "${targetScenario}"`,
      targetScenario,
      scenarios: scenariosOut,
      mocksWritten: result.mocksWritten,
      dateConfigApplied: result.dateConfigApplied,
      proxyConfigApplied: result.proxyConfigApplied,
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Import - Error:', error);
    const status = /must|required|Unsupported|Invalid/i.test(error.message) ? 400 : 500;
    res.status(status).json({ error: 'Failed to import scenario', details: error.message });
  }
});

const SCENARIO_MOCK_LOCKED_MESSAGE = 'Scenario is locked; mock data cannot be edited.';
const SCENARIO_DELETE_LOCKED_MESSAGE = 'Scenario is locked; unlock it before deleting.';
const SCENARIO_RENAME_LOCKED_MESSAGE = 'Scenario is locked; unlock it before renaming.';

function scenarioProtectedNameReason(name: string, verb: 'delete' | 'rename'): string | null {
  if (name === DEFAULT_SCENARIO) {
    return `Cannot ${verb} the default scenario`;
  }
  if (isScratchScenario(name)) {
    return verb === 'delete'
      ? 'Cannot delete the temporary unscoped scenario. Use Clear mocks to empty it.'
      : 'Cannot rename the temporary unscoped scenario.';
  }
  if (name === POOL_DIR_NAME) {
    return `Cannot ${verb} the fixture pool.`;
  }
  return null;
}

async function listDashboardScenarios(
  mockDataPath: string,
  config: ReturnType<typeof getDashboardContext>['config']
): Promise<string[]> {
  let scenarios = listScenarios(mockDataPath);
  if (!isCentralizedDashboardProvider(config.provider)) {
    return scenarios;
  }
  const store = createDashboardMockStore(config, mockDataPath);
  try {
    const redisScenarios = await store.listScenarios();
    return Array.from(new Set([...scenarios, ...redisScenarios])).sort();
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function getActiveScenarioName(
  mockDataPath: string,
  config: ReturnType<typeof getDashboardContext>['config']
): Promise<string> {
  if (!isCentralizedDashboardProvider(config.provider)) {
    return getCurrentScenario(mockDataPath);
  }
  const store = createDashboardMockStore(config, mockDataPath);
  try {
    return await store.getActiveScenario();
  } finally {
    await store.close().catch(() => undefined);
  }
}

async function setActiveScenarioName(
  mockDataPath: string,
  config: ReturnType<typeof getDashboardContext>['config'],
  scenario: string
): Promise<void> {
  if (isCentralizedDashboardProvider(config.provider)) {
    const store = createDashboardMockStore(config, mockDataPath);
    try {
      await store.setActiveScenario(scenario);
    } finally {
      await store.close().catch(() => undefined);
    }
    return;
  }
  saveScenarioConfig(mockDataPath, scenario);
}

async function clearEphemeralScenarioSidecars(
  scenario: string,
  config: ReturnType<typeof getDashboardContext>['config']
): Promise<void> {
  try {
    const atlas = getAtlasStore();
    atlas.clearDoc(scenario);
    atlas.clear({ scenario });
  } catch {
    // Atlas store is optional / in-memory.
  }
  try {
    const logStore = createNetworkLogStore(config);
    await logStore.clear({ scenario });
    await logStore.close();
  } catch {
    // Network log is optional.
  }
}

/**
 * Empty recorded mocks for a scenario. Keeps the scenario, date config, lock, and domain-path rules.
 * POST /api/scenario-config/clear-mocks  { scenario }
 */
router.post('/clear-mocks', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const parsed = sanitizeScenarioName(req.body?.scenario);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const sanitized = parsed.value;

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        if (await store.isScenarioLocked(sanitized)) {
          return res.status(423).json({ error: SCENARIO_MOCK_LOCKED_MESSAGE });
        }
      } finally {
        await store.close().catch(() => undefined);
      }
    } else if (isScenarioLockedFs(mockDataPath, sanitized)) {
      return res.status(423).json({ error: SCENARIO_MOCK_LOCKED_MESSAGE });
    }

    const result = await clearScenarioMocks({
      mockDataPath,
      scenario: sanitized,
      provider: config.provider,
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL,
      keyPrefix: config.keyPrefix,
      redisCluster: config.redisCluster,
    });

    return res.json({
      success: true,
      scenario: sanitized,
      mocksRemoved: result.mocksRemoved,
      message:
        result.mocksRemoved === 1
          ? `Removed 1 mock from "${sanitized}". The scenario is still available (empty).`
          : `Removed ${result.mocksRemoved} mocks from "${sanitized}". The scenario is still available (empty).`,
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Clear mocks - Error:', error);
    res.status(500).json({ error: 'Failed to clear scenario mocks', details: error.message });
  }
});

/**
 * Permanently delete a scenario (folder / Redis registry + mocks + metadata).
 * POST /api/scenario-config/delete  { scenario }
 */
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const parsed = sanitizeScenarioName(req.body?.scenario);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const sanitized = parsed.value;

    const blocked = scenarioProtectedNameReason(sanitized, 'delete');
    if (blocked) {
      return res.status(400).json({ error: blocked });
    }

    const scenarios = await listDashboardScenarios(mockDataPath, config);
    if (!scenarios.includes(sanitized)) {
      return res.status(404).json({ error: `Scenario "${sanitized}" does not exist` });
    }

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        if (await store.isScenarioLocked(sanitized)) {
          return res.status(423).json({ error: SCENARIO_DELETE_LOCKED_MESSAGE });
        }
      } finally {
        await store.close().catch(() => undefined);
      }
    } else if (isScenarioLockedFs(mockDataPath, sanitized)) {
      return res.status(423).json({ error: SCENARIO_DELETE_LOCKED_MESSAGE });
    }

    const wasActive = (await getActiveScenarioName(mockDataPath, config)) === sanitized;
    const result = await deleteEntireScenario({
      mockDataPath,
      scenario: sanitized,
      provider: config.provider,
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL,
      keyPrefix: config.keyPrefix,
      redisCluster: config.redisCluster,
    });

    let currentScenario = await getActiveScenarioName(mockDataPath, config);
    if (wasActive) {
      await setActiveScenarioName(mockDataPath, config, DEFAULT_SCENARIO);
      currentScenario = DEFAULT_SCENARIO;
    }

    await clearEphemeralScenarioSidecars(sanitized, config);

    const scenariosOut = (await listDashboardScenarios(mockDataPath, config)).filter(
      (name) => name !== sanitized
    );
    if (!scenariosOut.includes(DEFAULT_SCENARIO)) {
      scenariosOut.push(DEFAULT_SCENARIO);
    }
    if (!scenariosOut.includes(SCRATCH_SCENARIO)) {
      scenariosOut.push(SCRATCH_SCENARIO);
    }
    scenariosOut.sort();

    console.log(`[ScenarioConfigRoute] Deleted scenario: ${sanitized}`);
    return res.json({
      success: true,
      scenario: sanitized,
      currentScenario,
      scenarios: scenariosOut,
      mocksRemoved: result.mocksRemoved,
      lanesUnassigned: result.lanesUnassigned,
      message:
        wasActive
          ? `Scenario "${sanitized}" deleted. Switched to "${DEFAULT_SCENARIO}".`
          : `Scenario "${sanitized}" deleted.`,
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Delete - Error:', error);
    res.status(500).json({ error: 'Failed to delete scenario', details: error.message });
  }
});

/**
 * Rename a scenario. Moves folder / Redis keys and remaps lanes.
 * POST /api/scenario-config/rename  { scenario, newName }
 */
router.post('/rename', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    const parsedFrom = sanitizeScenarioName(req.body?.scenario);
    if (!parsedFrom.ok) {
      return res.status(400).json({ error: parsedFrom.error });
    }
    const from = parsedFrom.value;

    const parsedTo = sanitizeScenarioName(req.body?.newName);
    if (!parsedTo.ok) {
      return res.status(400).json({ error: parsedTo.error });
    }
    const to = parsedTo.value;

    const fromBlocked = scenarioProtectedNameReason(from, 'rename');
    if (fromBlocked) {
      return res.status(400).json({ error: fromBlocked });
    }
    const toBlocked = scenarioProtectedNameReason(to, 'rename');
    if (toBlocked) {
      return res.status(400).json({ error: toBlocked });
    }
    if (from === to) {
      return res.status(400).json({ error: 'New name must be different from the current name' });
    }

    const scenarios = await listDashboardScenarios(mockDataPath, config);
    if (!scenarios.includes(from)) {
      return res.status(404).json({ error: `Scenario "${from}" does not exist` });
    }
    const nameConflict = findCaseInsensitiveScenarioConflict(
      to,
      scenarios.filter((name) => name !== from)
    );
    if (nameConflict) {
      return res.status(409).json({
        error:
          nameConflict === to
            ? `Scenario "${to}" already exists`
            : `Scenario name "${to}" conflicts with existing "${nameConflict}" (names must be unique ignoring case)`,
      });
    }

    if (isCentralizedDashboardProvider(config.provider)) {
      const store = createDashboardMockStore(config, mockDataPath);
      try {
        if (await store.isScenarioLocked(from)) {
          return res.status(423).json({ error: SCENARIO_RENAME_LOCKED_MESSAGE });
        }
      } finally {
        await store.close().catch(() => undefined);
      }
    } else if (isScenarioLockedFs(mockDataPath, from)) {
      return res.status(423).json({ error: SCENARIO_RENAME_LOCKED_MESSAGE });
    }

    const wasActive = (await getActiveScenarioName(mockDataPath, config)) === from;
    const result = await renameEntireScenario({
      mockDataPath,
      scenario: from,
      newName: to,
      provider: config.provider,
      redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL,
      keyPrefix: config.keyPrefix,
      redisCluster: config.redisCluster,
    });

    let currentScenario = await getActiveScenarioName(mockDataPath, config);
    if (wasActive) {
      await setActiveScenarioName(mockDataPath, config, to);
      currentScenario = to;
    }

    await clearEphemeralScenarioSidecars(from, config);

    const scenariosOut = (await listDashboardScenarios(mockDataPath, config)).filter((name) => name !== from);
    if (!scenariosOut.includes(to)) {
      scenariosOut.push(to);
    }
    if (!scenariosOut.includes(DEFAULT_SCENARIO)) {
      scenariosOut.push(DEFAULT_SCENARIO);
    }
    if (!scenariosOut.includes(SCRATCH_SCENARIO)) {
      scenariosOut.push(SCRATCH_SCENARIO);
    }
    scenariosOut.sort();

    console.log(`[ScenarioConfigRoute] Renamed scenario: ${from} -> ${to}`);
    return res.json({
      success: true,
      scenario: from,
      newName: to,
      currentScenario,
      scenarios: scenariosOut,
      mocksMoved: result.mocksMoved,
      lanesRemapped: result.lanesRemapped,
      message: `Scenario "${from}" renamed to "${to}".`,
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Rename - Error:', error);
    const status = /already exists/i.test(error.message) ? 409 : 500;
    res.status(status).json({ error: 'Failed to rename scenario', details: error.message });
  }
});

export const scenarioConfigRouter = router;


