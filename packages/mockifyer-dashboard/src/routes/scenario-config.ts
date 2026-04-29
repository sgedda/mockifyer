import express, { Request, Response } from 'express';
import { getCurrentScenario, listScenarios, createScenario, saveScenarioConfig } from '@sgedda/mockifyer-core';
import { getDashboardContext } from '../utils/dashboard-context';
import { RedisMockStore } from '../utils/redis-mock-store';

const router = express.Router();

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
      } finally {
        await store.close().catch(() => undefined);
      }
    }
    
    res.json({
      currentScenario,
      scenarios,
      success: true
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
    
    if (!scenario || typeof scenario !== 'string' || scenario.trim() === '') {
      return res.status(400).json({ error: 'Scenario name is required' });
    }

    // Validate scenario name
    const sanitized = scenario.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (sanitized !== scenario.trim()) {
      return res.status(400).json({ 
        error: `Invalid scenario name: "${scenario}". Use only letters, numbers, hyphens, and underscores.` 
      });
    }

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
    const { scenario } = req.body;
    const { mockDataPath, config } = getDashboardContext(req);
    
    if (!scenario || typeof scenario !== 'string' || scenario.trim() === '') {
      return res.status(400).json({ error: 'Scenario name is required' });
    }

    // Validate and sanitize scenario name
    const sanitized = scenario.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (sanitized !== scenario.trim()) {
      return res.status(400).json({ 
        error: `Invalid scenario name: "${scenario}". Use only letters, numbers, hyphens, and underscores.` 
      });
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

    if (scenarios.includes(sanitized)) {
      return res.status(409).json({
        error: `Scenario "${sanitized}" already exists`,
      });
    }

    // Create scenario folder for filesystem flows; for redis it is optional but harmless.
    createScenario(mockDataPath, sanitized);
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

export const scenarioConfigRouter = router;


