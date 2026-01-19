import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { detectMockDataPath } from '../utils/path-detector';
import { getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';
import { getMockDataPath as getGlobalMockDataPath } from '../server';

const router = express.Router();

const DATE_CONFIG_FILENAME = 'date-config.json';

// Get mock data directory path
function getMockDataPath(): string {
  // First try to use the path set by the server (from CLI argument)
  const globalPath = getGlobalMockDataPath();
  if (globalPath) {
    console.log(`[DateConfigRoute] Using CLI-provided mock data path: ${globalPath}`);
    return globalPath;
  }
  
  // Fallback to detection if not set
  try {
    const detectedPath = detectMockDataPath();
    console.log(`[DateConfigRoute] Using auto-detected mock data path: ${detectedPath}`);
    return detectedPath;
  } catch (error: any) {
    console.error('[DateConfigRoute] Error detecting mock data path:', error);
    // Fallback to default
    const fallbackPath = path.join(process.cwd(), 'mock-data');
    console.log(`[DateConfigRoute] Using fallback mock data path: ${fallbackPath}`);
    return fallbackPath;
  }
}

// Get date config file path (supports per-scenario)
function getDateConfigPath(scenario?: string): string {
  try {
    const mockDataPath = getMockDataPath();
    
    // If scenario is provided and not empty, use scenario-specific config
    // Always use scenario-specific path (even for 'default') to ensure per-scenario configs
    if (scenario && scenario.trim() !== '') {
      const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
      const fullPath = path.join(scenarioPath, DATE_CONFIG_FILENAME);
      console.log(`[DateConfigRoute] getDateConfigPath - Using scenario-specific path:`, {
        scenario,
        scenarioPath,
        fullPath
      });
      return fullPath;
    }
    
    // Fallback to root date-config.json (for backward compatibility only)
    // This should rarely be used - scenarios should always be specified
    const rootPath = path.join(mockDataPath, DATE_CONFIG_FILENAME);
    console.warn(`[DateConfigRoute] getDateConfigPath - No scenario provided, using root config path:`, rootPath);
    return rootPath;
  } catch (error: any) {
    console.error('[DateConfigRoute] Error getting config path:', error);
    // Fallback to default
    const fallbackPath = path.join(process.cwd(), 'mock-data', DATE_CONFIG_FILENAME);
    console.error(`[DateConfigRoute] Using fallback path:`, fallbackPath);
    return fallbackPath;
  }
}

// Load date config with fallback: scenario-specific -> root -> default
function loadDateConfig(scenario?: string): any {
  const mockDataPath = getMockDataPath();
  const currentScenario = scenario || getCurrentScenario(mockDataPath);
  
  console.log(`[DateConfigRoute] loadDateConfig called:`, {
    scenarioParam: scenario,
    scenarioParamType: typeof scenario,
    scenarioParamIsEmpty: !scenario || scenario.trim() === '',
    currentScenario: currentScenario,
    mockDataPath: mockDataPath
  });
  
  // If a specific scenario is requested, ONLY load that scenario's config
  // Don't fall back to root config - each scenario should have its own independent config
  if (scenario && scenario.trim() !== '') {
    const scenarioConfigPath = getDateConfigPath(scenario);
    if (fs.existsSync(scenarioConfigPath)) {
      try {
        const fileContent = fs.readFileSync(scenarioConfigPath, 'utf-8');
        const config = JSON.parse(fileContent);
        console.log(`[DateConfigRoute] Loaded scenario-specific config for "${scenario}" from: ${scenarioConfigPath}`);
        // Support both formats: { dateManipulation: {...} } and { enabled: true, fixedDate: ..., offset: ... }
        if (config.dateManipulation) {
          return config; // Old dashboard format
        } else if (config.enabled !== undefined) {
          // Main web format - convert to dashboard format for compatibility
          // Note: offset can be 0 (no change), so we check !== null && !== undefined, not truthiness
          const hasOffset = config.offset !== null && config.offset !== undefined;
          return {
            dateManipulation: config.enabled ? {
              fixedDate: config.fixedDate || undefined,
              offset: hasOffset ? config.offset : undefined,
              timezone: config.timezone || undefined
            } : null
          };
        }
        return config;
      } catch (error) {
        console.warn(`[DateConfigRoute] Could not read scenario config file (${scenarioConfigPath}):`, error);
      }
    }
    // Scenario was requested but doesn't have its own config - return empty config
    console.log(`[DateConfigRoute] No config file found for scenario "${scenario}", returning empty config`);
    return { dateManipulation: null };
  }
  
  // No scenario specified - use current scenario from config/environment
  // Try scenario-specific config first
  const scenarioConfigPath = getDateConfigPath(currentScenario);
  if (fs.existsSync(scenarioConfigPath)) {
    try {
      const fileContent = fs.readFileSync(scenarioConfigPath, 'utf-8');
      const config = JSON.parse(fileContent);
      console.log(`[DateConfigRoute] Loaded current scenario config for "${currentScenario}" from: ${scenarioConfigPath}`);
      // Support both formats: { dateManipulation: {...} } and { enabled: true, fixedDate: ..., offset: ... }
      if (config.dateManipulation) {
        return config; // Old dashboard format
      } else if (config.enabled !== undefined) {
        // Main web format - convert to dashboard format for compatibility
        // Note: offset can be 0 (no change), so we check !== null && !== undefined, not truthiness
        const hasOffset = config.offset !== null && config.offset !== undefined;
        return {
          dateManipulation: config.enabled ? {
            fixedDate: config.fixedDate || undefined,
            offset: hasOffset ? config.offset : undefined,
            timezone: config.timezone || undefined
          } : null
        };
      }
      return config;
    } catch (error) {
      console.warn(`[DateConfigRoute] Could not read scenario config file (${scenarioConfigPath}):`, error);
    }
  }
  
  // Fallback to root config (backward compatibility - only when no scenario specified)
  // This should NOT happen if scenario was provided - each scenario should have its own config
  console.warn(`[DateConfigRoute] Falling back to root config (scenario-specific not found):`, {
    scenarioParam: scenario,
    currentScenario: currentScenario,
    scenarioConfigPath: scenarioConfigPath,
    scenarioConfigExists: fs.existsSync(scenarioConfigPath)
  });
  const rootConfigPath = getDateConfigPath();
  if (fs.existsSync(rootConfigPath)) {
    try {
      const fileContent = fs.readFileSync(rootConfigPath, 'utf-8');
      const config = JSON.parse(fileContent);
      console.log(`[DateConfigRoute] Loaded root config from: ${rootConfigPath}`);
      // Support both formats
      if (config.dateManipulation) {
        return config; // Old dashboard format
      } else if (config.enabled !== undefined) {
        // Main web format - convert to dashboard format
        // Note: offset can be 0 (no change), so we check !== null && !== undefined, not truthiness
        const hasOffset = config.offset !== null && config.offset !== undefined;
        return {
          dateManipulation: config.enabled ? {
            fixedDate: config.fixedDate || undefined,
            offset: hasOffset ? config.offset : undefined,
            timezone: config.timezone || undefined
          } : null
        };
      }
      return config;
    } catch (error) {
      console.warn('[DateConfigRoute] Could not read root config file:', error);
    }
  }
  
  // Return default config
  return { dateManipulation: null };
}

// Get current date config
router.get('/', (req: Request, res: Response) => {
  try {
    // Support scenario query parameter (optional)
    const scenario = req.query.scenario as string | undefined;
    const mockDataPath = getMockDataPath();
    // Always use scenario from query if provided, otherwise get current scenario
    const currentScenario = (scenario && scenario.trim() !== '') 
      ? scenario.trim() 
      : getCurrentScenario(mockDataPath);
    
    console.log(`[DateConfigRoute] GET - Request received:`, {
      scenarioFromQuery: scenario,
      currentScenario: currentScenario,
      mockDataPath: mockDataPath
    });
    
    // Load config for the current scenario (not the query param, which might be undefined)
    // This ensures we always load the correct scenario's config
    const config = loadDateConfig(currentScenario);
    const dateManipulation = config.dateManipulation || null;
    
    // Update environment variables to match the scenario's config
    // This ensures getCurrentDate() uses the correct scenario-specific date
    if (dateManipulation) {
      if (dateManipulation.fixedDate) {
        process.env.MOCKIFYER_DATE = dateManipulation.fixedDate;
        delete process.env.MOCKIFYER_DATE_OFFSET;
      } else if (dateManipulation.offset !== undefined && dateManipulation.offset !== null) {
        process.env.MOCKIFYER_DATE_OFFSET = dateManipulation.offset.toString();
        delete process.env.MOCKIFYER_DATE;
      } else {
        delete process.env.MOCKIFYER_DATE;
        delete process.env.MOCKIFYER_DATE_OFFSET;
      }

      if (dateManipulation.timezone) {
        process.env.MOCKIFYER_TIMEZONE = dateManipulation.timezone;
      } else {
        delete process.env.MOCKIFYER_TIMEZONE;
      }
    } else {
      // No date manipulation, clear env vars
      delete process.env.MOCKIFYER_DATE;
      delete process.env.MOCKIFYER_DATE_OFFSET;
      delete process.env.MOCKIFYER_TIMEZONE;
    }
    
    // Calculate current date based on config
    let currentDate: Date;
    if (dateManipulation?.fixedDate) {
      currentDate = new Date(dateManipulation.fixedDate);
    } else if (dateManipulation?.offset !== undefined) {
      currentDate = new Date(Date.now() + dateManipulation.offset);
    } else {
      currentDate = new Date();
    }

    console.log(`[DateConfigRoute] GET - Success for scenario "${currentScenario}", returning:`, { dateManipulation, currentDate: currentDate.toISOString() });
    res.json({
      dateManipulation: dateManipulation,
      currentDate: currentDate.toISOString(),
      scenario: currentScenario
    });
  } catch (error: any) {
    console.error('[DateConfigRoute] GET - Error:', error);
    console.error('[DateConfigRoute] GET - Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to read date config', details: error.message });
  }
});

// Update date config
router.post('/', (req: Request, res: Response) => {
  try {
    const { fixedDate, offset, timezone, scenario } = req.body; // scenario is optional
    const mockDataPath = getMockDataPath();
    
    // CRITICAL: Always use scenario from body if provided, otherwise get current scenario
    // Ensure we have a valid scenario name (not empty string)
    // Even if scenario is undefined/null/empty, we should ALWAYS use a scenario-specific path
    let currentScenario: string;
    if (scenario && typeof scenario === 'string' && scenario.trim() !== '') {
      currentScenario = scenario.trim();
    } else {
      // Fallback to current scenario from config/environment
      currentScenario = getCurrentScenario(mockDataPath);
      console.log(`[DateConfigRoute] No scenario in request body, using currentScenario from config: "${currentScenario}"`);
    }
    
    // ALWAYS use scenario-specific path - never save to root
    // Even 'default' scenario should have its own folder
    const configPath = getDateConfigPath(currentScenario);
    
    console.log(`[DateConfigRoute] POST - Received data:`, { 
      fixedDate, 
      offset, 
      timezone, 
      scenarioFromBody: scenario,
      scenarioFromBodyType: typeof scenario,
      scenarioFromBodyIsEmpty: scenario === '' || scenario === null || scenario === undefined,
      currentScenario: currentScenario, 
      currentScenarioType: typeof currentScenario,
      offsetType: typeof offset,
      mockDataPath,
      configPath,
      willUseScenarioFolder: currentScenario && currentScenario.trim() !== ''
    });
    
    // Ensure mock data directory exists
    if (!fs.existsSync(mockDataPath)) {
      fs.mkdirSync(mockDataPath, { recursive: true });
    }
    
    // Always create scenario folder for scenario-specific configs
    // This ensures the folder exists before we try to save the file
    if (currentScenario && currentScenario.trim() !== '') {
      const scenarioPath = getScenarioFolderPath(mockDataPath, currentScenario);
      if (!fs.existsSync(scenarioPath)) {
        console.log(`[DateConfigRoute] Creating scenario folder: ${scenarioPath}`);
        fs.mkdirSync(scenarioPath, { recursive: true });
      } else {
        console.log(`[DateConfigRoute] Scenario folder already exists: ${scenarioPath}`);
      }
    } else {
      console.warn(`[DateConfigRoute] No valid scenario name, saving to root (backward compatibility)`);
    }

    // Validate input
    if (fixedDate !== undefined && fixedDate !== null && fixedDate !== '') {
      // Validate date format
      const testDate = new Date(fixedDate);
      if (isNaN(testDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format (e.g., 2024-12-25T00:00:00.000Z)' });
      }
    }

    // Convert offset to number if it's a string (from JSON parsing)
    let offsetValue: number | null | undefined = offset;
    if (offset !== undefined && offset !== null) {
      if (typeof offset === 'string') {
        offsetValue = parseInt(offset, 10);
        if (isNaN(offsetValue)) {
          return res.status(400).json({ error: 'Offset must be a valid number (milliseconds)' });
        }
      } else if (typeof offset !== 'number') {
        return res.status(400).json({ error: 'Offset must be a number (milliseconds)' });
      }
    }

    // Build config object
    const dateManipulation: any = {};
    
    if (fixedDate !== undefined && fixedDate !== null && fixedDate !== '') {
      dateManipulation.fixedDate = fixedDate;
      // Clear offset if fixedDate is set
      delete dateManipulation.offset;
    } else if (offsetValue !== undefined && offsetValue !== null) {
      // Allow offset of 0 (which is a valid offset - no change)
      dateManipulation.offset = offsetValue;
      // Clear fixedDate if offset is set
      delete dateManipulation.fixedDate;
      console.log(`[DateConfigRoute] POST - Setting offset:`, offsetValue);
    } else if (offset === null) {
      // Explicitly clear offset if null is sent
      dateManipulation.offset = null;
      delete dateManipulation.fixedDate;
    } else {
      // If both are cleared, remove date manipulation
      dateManipulation.fixedDate = null;
      dateManipulation.offset = undefined;
    }

    if (timezone !== undefined && timezone !== null && timezone !== '') {
      dateManipulation.timezone = timezone;
    } else {
      delete dateManipulation.timezone;
    }

    // If both fixedDate and offset are cleared, delete the config file
    if (!dateManipulation.fixedDate && dateManipulation.offset === undefined && !dateManipulation.timezone) {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      return res.json({
        success: true,
        message: 'Date manipulation cleared',
        dateManipulation: null,
        currentDate: new Date().toISOString()
      });
    }

    // Save config to file
    // Use the same format as main web route for consistency: { enabled: true, fixedDate: ..., offset: ..., timezone: ... }
    // Note: offset can be 0 (no change), so we check !== undefined, not truthiness
    const hasOffset = dateManipulation.offset !== undefined && dateManipulation.offset !== null;
    const enabled = !!(dateManipulation.fixedDate || hasOffset || dateManipulation.timezone);
    const config = {
      enabled,
      fixedDate: dateManipulation.fixedDate || null,
      offset: hasOffset ? dateManipulation.offset : null,
      timezone: dateManipulation.timezone || null,
      updatedAt: new Date().toISOString()
    };

    // Verify the path before writing
    const resolvedPath = path.resolve(configPath);
    console.log(`[DateConfigRoute] Saving date config:`, {
      scenario: currentScenario,
      configPath: configPath,
      resolvedPath: resolvedPath,
      mockDataPath: mockDataPath,
      scenarioFolder: getScenarioFolderPath(mockDataPath, currentScenario),
      fileExistsBefore: fs.existsSync(configPath)
    });
    
    // Ensure parent directory exists
    const parentDir = path.dirname(configPath);
    if (!fs.existsSync(parentDir)) {
      console.log(`[DateConfigRoute] Creating parent directory: ${parentDir}`);
      fs.mkdirSync(parentDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    // Verify file was written
    if (fs.existsSync(configPath)) {
      console.log(`[DateConfigRoute] ✓ Successfully saved date config for scenario "${currentScenario}" at: ${configPath}`);
    } else {
      console.error(`[DateConfigRoute] ✗ ERROR: File was not created at: ${configPath}`);
    }

    // Update environment variables to match the scenario's config
    // This ensures getCurrentDate() uses the correct scenario-specific date
    if (enabled) {
      if (dateManipulation.fixedDate) {
        process.env.MOCKIFYER_DATE = dateManipulation.fixedDate;
        delete process.env.MOCKIFYER_DATE_OFFSET;
      } else if (hasOffset) {
        // Allow offset of 0 (no change)
        process.env.MOCKIFYER_DATE_OFFSET = dateManipulation.offset.toString();
        delete process.env.MOCKIFYER_DATE;
      } else {
        delete process.env.MOCKIFYER_DATE;
        delete process.env.MOCKIFYER_DATE_OFFSET;
      }

      if (dateManipulation.timezone) {
        process.env.MOCKIFYER_TIMEZONE = dateManipulation.timezone;
      } else {
        delete process.env.MOCKIFYER_TIMEZONE;
      }
    } else {
      // Config is disabled, clear all env vars
      delete process.env.MOCKIFYER_DATE;
      delete process.env.MOCKIFYER_DATE_OFFSET;
      delete process.env.MOCKIFYER_TIMEZONE;
    }

    // Calculate current date based on config
    let currentDate: Date;
    if (dateManipulation.fixedDate) {
      currentDate = new Date(dateManipulation.fixedDate);
    } else if (dateManipulation.offset !== undefined) {
      currentDate = new Date(Date.now() + dateManipulation.offset);
    } else {
      currentDate = new Date();
    }

    console.log(`[DateConfigRoute] Updated date config for scenario "${currentScenario}":`, dateManipulation);
    res.json({
      success: true,
      message: `Date manipulation updated successfully for scenario "${currentScenario}"`,
      dateManipulation,
      currentDate: currentDate.toISOString(),
      scenario: currentScenario
    });
  } catch (error: any) {
    console.error('[DateConfigRoute] Update - Error:', error);
    res.status(500).json({ error: 'Failed to update date config', details: error.message });
  }
});

export const dateConfigRouter = router;

