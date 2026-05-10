import express, { Request, Response } from 'express';
import { getCurrentScenario, listScenarios, createScenario, saveScenarioConfig } from '@sgedda/mockifyer-core';
import {
  setScenarioLockedFs,
  isScenarioLockedFs,
  findCaseInsensitiveScenarioConflict,
  SCENARIO_META_FILENAME,
} from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';
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

// Get current scenario config
router.get('/', async (req: Request, res: Response) => {
  try {
    const { mockDataPath, config } = getDashboardContext(req);
    let currentScenario = getCurrentScenario(mockDataPath);
    let scenarios = listScenarios(mockDataPath);

    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
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
    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
      try {
        const redisScenarios = await store.listScenarios();
        scenarios = Array.from(new Set([...scenarios, ...redisScenarios])).sort();
      } finally {
        await store.close().catch(() => undefined);
      }
    }

    // In redis mode, allow switching to a scenario even if it doesn't exist yet (created on first write).
    if (config.provider !== 'redis' && !scenarios.includes(sanitized)) {
      return res.status(404).json({ 
        error: `Scenario "${sanitized}" does not exist. Create it first.` 
      });
    }

    // Save scenario config:
    // - filesystem/sqlite: local file
    // - redis: centralized key in Redis
    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
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
    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
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

    // Create scenario folder for filesystem flows; for redis it is optional but harmless.
    createScenario(mockDataPath, sanitized);

    // Optional: derive scenario data (copy mocks + date config) from an existing scenario.
    if (deriveFromScenario) {
      if (config.provider === 'redis') {
        const store = new RedisMockStore({
          redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
          keyPrefix: config.keyPrefix,
          mockDataPath,
        });
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
    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
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
    if (config.provider === 'redis') {
      const store = new RedisMockStore({
        redisUrl: config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '',
        keyPrefix: config.keyPrefix,
        mockDataPath,
      });
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

export const scenarioConfigRouter = router;


