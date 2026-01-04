import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getCurrentScenario, listScenarios, createScenario, saveScenarioConfig } from '@sgedda/mockifyer-core';

const router = express.Router();

const MAX_SCENARIOS = process.env.MOCKIFYER_MAX_SCENARIOS 
  ? parseInt(process.env.MOCKIFYER_MAX_SCENARIOS, 10) 
  : undefined;
const MAX_REQUESTS_PER_SCENARIO = process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO 
  ? parseInt(process.env.MOCKIFYER_MAX_REQUESTS_PER_SCENARIO, 10) 
  : undefined;

// Get mock data directory path
function getMockDataPath(): string {
  if (process.env.MOCKIFYER_PATH) {
    return path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
  } else if (process.env.RAILWAY_ENVIRONMENT || fs.existsSync('/persisted/mock-data')) {
    return '/persisted/mock-data';
  } else {
    return path.join(process.cwd(), 'persisted', 'mock-data');
  }
}

// Count files in a scenario directory
function countScenarioFiles(scenarioPath: string): number {
  if (!fs.existsSync(scenarioPath)) {
    return 0;
  }
  try {
    const files = fs.readdirSync(scenarioPath);
    return files.filter(file => 
      file.endsWith('.json') && 
      file !== 'scenario-config.json' && 
      file !== 'date-config.json'
    ).length;
  } catch (error) {
    console.warn('[ScenarioConfigRoute] Error counting files:', error);
    return 0;
  }
}

// Get current scenario config
router.get('/', (req: Request, res: Response) => {
  try {
    const mockDataPath = getMockDataPath();
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarios = listScenarios(mockDataPath);
    
    // Get request counts for each scenario
    const scenariosWithCounts = scenarios.map(scenario => {
      const scenarioPath = path.join(mockDataPath, scenario);
      const requestCount = countScenarioFiles(scenarioPath);
      return {
        name: scenario,
        requestCount,
        isCurrent: scenario === currentScenario,
      };
    });
    
    res.json({
      currentScenario,
      scenarios: scenarios.map(s => s),
      scenariosWithCounts,
      maxScenarios: MAX_SCENARIOS,
      maxRequestsPerScenario: MAX_REQUESTS_PER_SCENARIO,
      success: true
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Get - Error:', error);
    res.status(500).json({ error: 'Failed to read scenario config', details: error.message });
  }
});

// Set current scenario
router.post('/set', (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const mockDataPath = getMockDataPath();
    
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

    // Check if scenario exists
    const scenarios = listScenarios(mockDataPath);
    if (!scenarios.includes(sanitized)) {
      return res.status(404).json({ 
        error: `Scenario "${sanitized}" does not exist. Create it first.` 
      });
    }

    // Save scenario config
    saveScenarioConfig(mockDataPath, sanitized);
    
    res.json({
      success: true,
      message: `Scenario switched to "${sanitized}"`,
      currentScenario: sanitized,
      scenarios: listScenarios(mockDataPath)
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Set - Error:', error);
    res.status(500).json({ error: 'Failed to set scenario', details: error.message });
  }
});

// Create new scenario
router.post('/create', (req: Request, res: Response) => {
  try {
    const { scenario } = req.body;
    const mockDataPath = getMockDataPath();
    
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

    // Check max scenarios limit (only if limit is set via env var)
    const scenarios = listScenarios(mockDataPath);
    if (MAX_SCENARIOS !== undefined && scenarios.length >= MAX_SCENARIOS) {
      return res.status(400).json({ 
        error: `Maximum ${MAX_SCENARIOS} scenarios allowed. Please delete a scenario first.` 
      });
    }

    // Check if scenario already exists
    if (scenarios.includes(sanitized)) {
      return res.status(409).json({ 
        error: `Scenario "${sanitized}" already exists` 
      });
    }

    // Create scenario folder
    createScenario(mockDataPath, sanitized);
    
    res.json({
      success: true,
      message: `Scenario "${sanitized}" created successfully`,
      currentScenario: getCurrentScenario(mockDataPath),
      scenarios: listScenarios(mockDataPath)
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Create - Error:', error);
    res.status(500).json({ error: 'Failed to create scenario', details: error.message });
  }
});

// Delete scenario
router.delete('/:scenario', (req: Request, res: Response) => {
  try {
    const { scenario } = req.params;
    const mockDataPath = getMockDataPath();
    
    if (!scenario || scenario.trim() === '') {
      return res.status(400).json({ error: 'Scenario name is required' });
    }

    // Validate scenario name
    const sanitized = scenario.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Don't allow deleting 'default' scenario
    if (sanitized === 'default') {
      return res.status(400).json({ 
        error: 'Cannot delete the default scenario' 
      });
    }

    // Check if scenario exists
    const scenarios = listScenarios(mockDataPath);
    if (!scenarios.includes(sanitized)) {
      return res.status(404).json({ 
        error: `Scenario "${sanitized}" does not exist` 
      });
    }

    // Check if it's the current scenario
    const currentScenario = getCurrentScenario(mockDataPath);
    if (sanitized === currentScenario) {
      return res.status(400).json({ 
        error: 'Cannot delete the currently active scenario. Switch to another scenario first.' 
      });
    }

    // Delete scenario folder
    const scenarioPath = path.join(mockDataPath, sanitized);
    if (fs.existsSync(scenarioPath)) {
      fs.rmSync(scenarioPath, { recursive: true, force: true });
    }
    
    res.json({
      success: true,
      message: `Scenario "${sanitized}" deleted successfully`,
      scenarios: listScenarios(mockDataPath)
    });
  } catch (error: any) {
    console.error('[ScenarioConfigRoute] Delete - Error:', error);
    res.status(500).json({ error: 'Failed to delete scenario', details: error.message });
  }
});

export { router as scenarioConfigRouter };

