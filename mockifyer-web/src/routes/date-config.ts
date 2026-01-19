import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getCurrentDate, getCurrentScenario, getScenarioFolderPath } from '@sgedda/mockifyer-core';

const router = express.Router();

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

// Path to store date configuration (supports per-scenario)
const getConfigPath = (scenario?: string) => {
  const mockDataPath = getMockDataPath();
  
  // If scenario is provided, use scenario-specific config
  if (scenario) {
    const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
    return path.join(scenarioPath, 'date-config.json');
  }
  
  // Fallback to root date-config.json (for backward compatibility)
  return path.join(mockDataPath, 'date-config.json');
};

// Load date config with fallback: scenario-specific -> root -> default
function loadDateConfig(scenario?: string): any {
  const mockDataPath = getMockDataPath();
  const currentScenario = scenario || getCurrentScenario(mockDataPath);
  
  // Try scenario-specific config first
  const scenarioConfigPath = getConfigPath(currentScenario);
  if (fs.existsSync(scenarioConfigPath)) {
    try {
      const fileContent = fs.readFileSync(scenarioConfigPath, 'utf-8');
      const config = JSON.parse(fileContent);
      return config;
    } catch (error) {
      console.warn(`[DateConfig] Could not read scenario config file (${scenarioConfigPath}):`, error);
    }
  }
  
  // Fallback to root config (backward compatibility)
  const rootConfigPath = getConfigPath();
  if (fs.existsSync(rootConfigPath)) {
    try {
      const fileContent = fs.readFileSync(rootConfigPath, 'utf-8');
      const config = JSON.parse(fileContent);
      return config;
    } catch (error) {
      console.warn('[DateConfig] Could not read root config file:', error);
    }
  }
  
  // Return default config
  return {
    fixedDate: null,
    offset: null,
    offsetDays: null,
    offsetHours: null,
    offsetMinutes: null,
    timezone: null,
    enabled: false
  };
};

// Get current date configuration
router.get('/', (req: Request, res: Response) => {
  try {
    // Support scenario query parameter (optional)
    const scenario = req.query.scenario as string | undefined;
    const mockDataPath = getMockDataPath();
    const currentScenario = scenario || getCurrentScenario(mockDataPath);
    
    // Load config (with fallback: scenario-specific -> root -> default)
    let config = loadDateConfig(scenario);

    // Update environment variables to match the scenario's config
    // This ensures getCurrentDate() uses the correct scenario-specific date
    if (config.enabled) {
      if (config.fixedDate) {
        process.env.MOCKIFYER_DATE = config.fixedDate;
        delete process.env.MOCKIFYER_DATE_OFFSET;
      } else if (config.offset !== null && config.offset !== undefined) {
        process.env.MOCKIFYER_DATE_OFFSET = config.offset.toString();
        delete process.env.MOCKIFYER_DATE;
      } else if (config.offsetDays !== undefined || config.offsetHours !== undefined || config.offsetMinutes !== undefined) {
        // Calculate offset from days/hours/minutes if offset not directly set
        const days = parseInt(config.offsetDays || 0, 10);
        const hours = parseInt(config.offsetHours || 0, 10);
        const minutes = parseInt(config.offsetMinutes || 0, 10);
        const sign = config.offsetSign === '-' ? -1 : 1;
        const offsetMs = sign * (
          days * 24 * 60 * 60 * 1000 +
          hours * 60 * 60 * 1000 +
          minutes * 60 * 1000
        );
        config.offset = offsetMs;
        process.env.MOCKIFYER_DATE_OFFSET = offsetMs.toString();
        delete process.env.MOCKIFYER_DATE;
      } else {
        // No date manipulation, clear env vars
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

    // Get current effective date (now that env vars are set correctly)
    const currentDate = getCurrentDate();
    config.currentDate = currentDate.toISOString();
    config.currentDateFormatted = currentDate.toLocaleString();
    config.scenario = currentScenario; // Include scenario info in response

    res.json(config);
  } catch (error: any) {
    console.error('[DateConfig] GET Error:', error);
    res.status(500).json({ error: 'Failed to get date configuration', details: error.message });
  }
});

// Update date configuration
router.put('/', (req: Request, res: Response) => {
  try {
    const {
      fixedDate,
      offsetDays,
      offsetHours,
      offsetMinutes,
      offsetSign,
      timezone,
      enabled,
      scenario // Optional: save to scenario-specific config
    } = req.body;

    const mockDataPath = getMockDataPath();
    const currentScenario = scenario || getCurrentScenario(mockDataPath);
    const configPath = getConfigPath(currentScenario);
    const configDir = path.dirname(configPath);
    
    // Ensure scenario folder exists if using scenario-specific config
    if (scenario) {
      const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
      if (!fs.existsSync(scenarioPath)) {
        fs.mkdirSync(scenarioPath, { recursive: true });
      }
    }

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    let config: any = {};

    if (!enabled) {
      // Disable date manipulation
      config = {
        enabled: false,
        fixedDate: null,
        offset: null,
        timezone: null
      };
    } else if (fixedDate) {
      // Use fixed date
      config = {
        enabled: true,
        fixedDate,
        offset: null,
        timezone: timezone || null
      };
    } else if (offsetDays !== undefined || offsetHours !== undefined || offsetMinutes !== undefined) {
      // Calculate offset in milliseconds
      const days = parseInt(offsetDays || 0, 10);
      const hours = parseInt(offsetHours || 0, 10);
      const minutes = parseInt(offsetMinutes || 0, 10);
      const sign = offsetSign === '-' ? -1 : 1;
      
      const offsetMs = sign * (
        days * 24 * 60 * 60 * 1000 +
        hours * 60 * 60 * 1000 +
        minutes * 60 * 1000
      );

      config = {
        enabled: true,
        fixedDate: null,
        offset: offsetMs,
        offsetDays: days,
        offsetHours: hours,
        offsetMinutes: minutes,
        offsetSign: sign === -1 ? '-' : '+',
        timezone: timezone || null
      };
    } else if (timezone) {
      // Use timezone only
      config = {
        enabled: true,
        fixedDate: null,
        offset: null,
        timezone
      };
    } else {
      return res.status(400).json({ error: 'Invalid configuration. Provide fixedDate, offset, or timezone.' });
    }

    // Save to config file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Update environment variables (these take precedence in getCurrentDate)
    if (config.fixedDate) {
      process.env.MOCKIFYER_DATE = config.fixedDate;
      delete process.env.MOCKIFYER_DATE_OFFSET;
    } else if (config.offset !== null) {
      process.env.MOCKIFYER_DATE_OFFSET = config.offset.toString();
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

    // Get updated current date
    const currentDate = getCurrentDate();
    config.currentDate = currentDate.toISOString();
    config.currentDateFormatted = currentDate.toLocaleString();
    config.scenario = currentScenario; // Include scenario info in response

    console.log(`[DateConfig] Updated date configuration for scenario "${currentScenario}":`, config);
    res.json({ 
      success: true, 
      message: `Date configuration updated successfully for scenario "${currentScenario}"`,
      config 
    });
  } catch (error: any) {
    console.error('[DateConfig] PUT Error:', error);
    res.status(500).json({ error: 'Failed to update date configuration', details: error.message });
  }
});

export { router as dateConfigRouter };

