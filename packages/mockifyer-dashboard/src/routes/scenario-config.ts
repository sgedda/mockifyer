import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getCurrentScenario, listScenarios, createScenario, saveScenarioConfig } from '@sgedda/mockifyer-core';
import { getMockDataPath as getGlobalMockDataPath } from '../server';

const router = express.Router();

const SCENARIO_CONFIG_FILENAME = 'scenario-config.json';

// Get mock data directory path
function getMockDataPath(): string {
  // First try to use the path set by the server (from CLI argument)
  const globalPath = getGlobalMockDataPath();
  if (globalPath) {
    return globalPath;
  }
  
  // Fallback to detection if not set
  const detectedPath = detectMockDataPath();
  console.log(`[ScenarioConfigRoute] Detected mock data path: ${detectedPath}`);
  return detectedPath;
}

// Get current scenario config
router.get('/', (req: Request, res: Response) => {
  try {
    const mockDataPath = getMockDataPath();
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarios = listScenarios(mockDataPath);
    
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
router.post('/set', (req: Request, res: Response) => {
  console.log('[ScenarioConfigRoute] POST /set received', { body: req.body, path: req.path });
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
    
    console.log(`[ScenarioConfigRoute] Set scenario to: ${sanitized}`);
    res.json({
      success: true,
      message: `Scenario switched to "${sanitized}"`,
      currentScenario: sanitized,
      scenarios
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

    // Check if scenario already exists
    const scenarios = listScenarios(mockDataPath);
    if (scenarios.includes(sanitized)) {
      return res.status(409).json({ 
        error: `Scenario "${sanitized}" already exists` 
      });
    }

    // Create scenario folder
    createScenario(mockDataPath, sanitized);
    
    console.log(`[ScenarioConfigRoute] Created scenario: ${sanitized}`);
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

export const scenarioConfigRouter = router;


