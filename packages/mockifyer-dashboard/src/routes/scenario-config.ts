import express, { Request, Response } from 'express';
import { getCurrentScenario, listScenarios, createScenario, saveScenarioConfig, validateScenarioName } from '@sgedda/mockifyer-core';
import {
  setScenarioLockedFs,
  isScenarioLockedFs,
  findCaseInsensitiveScenarioConflict,
  SCENARIO_META_FILENAME,
} from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { createDashboardMockStore } from '../utils/create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from '../utils/dashboard-provider';
import { RedisMockStore } from '../utils/redis-mock-store';
import {
  applyScenarioImport,
  buildFilesystemScenarioBundle,
  buildRedisScenarioBundle,
  parseScenarioImportRequest,
} from '../utils/scenario-bundle';
import fs from 'fs';
import path from 'path';

const router = express.Router();

function sanitizeScenarioName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  return validateScenarioName(raw);
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
        const scenarioLocks: Record<string, boolean> = {};
        for (const name of scenarios) {
          scenarioLocks[name] = await store.isScenarioLocked(name);
        }
        res.json({
          currentScenario,
          scenarios,
          scenarioLocks,
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
        const scenarioLocks: Record<string, boolean> = {};
        for (const name of scenarios) {
          scenarioLocks[name] = await store.isScenarioLocked(name);
        }
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

export const scenarioConfigRouter = router;


