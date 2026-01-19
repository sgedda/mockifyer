import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getCurrentScenario, listScenarios, createScenario, saveScenarioConfig } from '@sgedda/mockifyer-core';

// Helper function to load date config for a scenario
function loadDateConfigForScenario(mockDataPath: string, scenario: string): any {
  // Try scenario-specific config first
  const scenarioConfigPath = path.join(mockDataPath, scenario, 'date-config.json');
  if (fs.existsSync(scenarioConfigPath)) {
    try {
      const fileContent = fs.readFileSync(scenarioConfigPath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      // Fall through to root config
    }
  }
  
  // Fallback to root config
  const rootConfigPath = path.join(mockDataPath, 'date-config.json');
  if (fs.existsSync(rootConfigPath)) {
    try {
      const fileContent = fs.readFileSync(rootConfigPath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      // Return default
    }
  }
  
  return { enabled: false };
}

// Helper function to update environment variables from date config
function updateEnvVarsFromDateConfig(config: any): void {
  if (config.enabled) {
    if (config.fixedDate) {
      process.env.MOCKIFYER_DATE = config.fixedDate;
      delete process.env.MOCKIFYER_DATE_OFFSET;
    } else if (config.offset !== null && config.offset !== undefined) {
      process.env.MOCKIFYER_DATE_OFFSET = config.offset.toString();
      delete process.env.MOCKIFYER_DATE;
    } else if (config.offsetDays !== undefined || config.offsetHours !== undefined || config.offsetMinutes !== undefined) {
      // Calculate offset from days/hours/minutes
      const days = parseInt(config.offsetDays || 0, 10);
      const hours = parseInt(config.offsetHours || 0, 10);
      const minutes = parseInt(config.offsetMinutes || 0, 10);
      const sign = config.offsetSign === '-' ? -1 : 1;
      const offsetMs = sign * (
        days * 24 * 60 * 60 * 1000 +
        hours * 60 * 60 * 1000 +
        minutes * 60 * 1000
      );
      process.env.MOCKIFYER_DATE_OFFSET = offsetMs.toString();
      delete process.env.MOCKIFYER_DATE;
    } else {
      delete process.env.MOCKIFYER_DATE;
      delete process.env.MOCKIFYER_DATE_OFFSET;
    }

    if (config.timezone) {
      process.env.MOCKIFYER_TIMEZONE = config.timezone;
    } else {
      delete process.env.MOCKIFYER_TIMEZONE;
    }
  } else {
    // Config is disabled, clear all env vars
    delete process.env.MOCKIFYER_DATE;
    delete process.env.MOCKIFYER_DATE_OFFSET;
    delete process.env.MOCKIFYER_TIMEZONE;
  }
}

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
    
    // Update environment variables to match the current scenario's date config
    // This ensures getCurrentDate() uses the correct scenario-specific date
    const dateConfig = loadDateConfigForScenario(mockDataPath, currentScenario);
    updateEnvVarsFromDateConfig(dateConfig);
    
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
    
    // Update environment variables to match the new scenario's date config
    const dateConfig = loadDateConfigForScenario(mockDataPath, sanitized);
    updateEnvVarsFromDateConfig(dateConfig);
    
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

