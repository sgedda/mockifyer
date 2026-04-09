import { MockifyerConfig, ENV_VARS } from '../types';
import { logger } from './logger';
import { getCurrentScenario, getScenarioFolderPath } from './scenario';

// Conditionally import fs and path - will be undefined in React Native
let fs: typeof import('fs') | undefined;
let path: typeof import('path') | undefined;

try {
  fs = require('fs');
  path = require('path');
} catch (e) {
  // fs/path not available (React Native environment)
  fs = undefined;
  path = undefined;
}

let currentConfig: MockifyerConfig | null = null;

/**
 * Read dateManipulation payload from a single date-config.json file.
 */
function readDateManipulationFromJsonFile(filePath: string): { dateManipulation?: any } | null {
  if (!fs) {
    return null;
  }
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(fileContent);
    if (config && typeof config === 'object' && 'dateManipulation' in config) {
      return { dateManipulation: config.dateManipulation };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Load date config from disk: per-scenario file first, then legacy root date-config.json.
 *
 * Scenario path: `{mockDataPath}/{currentScenario}/date-config.json`
 * Legacy path: `{mockDataPath}/date-config.json` (used when scenario-specific file is absent)
 *
 * If the scenario folder or per-scenario file does not exist yet, this falls through to the
 * legacy root file only (no error). If neither file exists, returns null.
 */
function loadDateConfigFromFile(mockDataPath?: string): { dateManipulation?: any } | null {
  // Skip file loading if fs/path are not available (React Native)
  if (!fs || !path) {
    return null;
  }

  try {
    if (mockDataPath && fs.existsSync(mockDataPath)) {
      const scenario = getCurrentScenario(mockDataPath);
      const scenarioDir = getScenarioFolderPath(mockDataPath, scenario);
      const scenarioPath = path.join(scenarioDir, 'date-config.json');
      if (fs.existsSync(scenarioPath)) {
        const parsed = readDateManipulationFromJsonFile(scenarioPath);
        if (parsed !== null) {
          return parsed;
        }
      }
      const rootPath = path.join(mockDataPath, 'date-config.json');
      if (fs.existsSync(rootPath)) {
        const parsed = readDateManipulationFromJsonFile(rootPath);
        if (parsed !== null) {
          return parsed;
        }
      }
      return null;
    }

    // No mockDataPath: probe common roots (same as before, with per-scenario first)
    const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '';
    const possibleRoots = [
      path.join(cwd, 'mock-data'),
      path.join(cwd, 'persisted', 'mock-data'),
    ];
    for (const root of possibleRoots) {
      if (!fs.existsSync(root)) {
        continue;
      }
      const scenario = getCurrentScenario(root);
      const scenarioPath = path.join(getScenarioFolderPath(root, scenario), 'date-config.json');
      if (fs.existsSync(scenarioPath)) {
        const parsed = readDateManipulationFromJsonFile(scenarioPath);
        if (parsed !== null) {
          return parsed;
        }
      }
      const legacyRoot = path.join(root, 'date-config.json');
      if (fs.existsSync(legacyRoot)) {
        const parsed = readDateManipulationFromJsonFile(legacyRoot);
        if (parsed !== null) {
          return parsed;
        }
      }
    }

    const relativeOnly = ['./mock-data/date-config.json', './persisted/mock-data/date-config.json'].find(p =>
      fs.existsSync(p)
    );
    if (relativeOnly) {
      return readDateManipulationFromJsonFile(relativeOnly);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate timezone offset in milliseconds
 */
function getTimezoneOffset(targetTimezone: string): number {
  try {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const targetTime = new Date(now.toLocaleString('en-US', { timeZone: targetTimezone }));
    const targetOffset = targetTime.getTime() - utcTime;
    return targetOffset;
  } catch (error) {
    logger.warn(`Invalid timezone: ${targetTimezone}. Using system timezone instead.`);
    return 0;
  }
}

/**
 * Initialize date manipulation with the given config
 * Note: For global Date manipulation (new Date(), Date.now()), use Sinon or Jest fake timers
 * This function stores the config for use by getCurrentDate()
 */
export function initializeDateManipulation(config: MockifyerConfig): void {
  currentConfig = config;

  // Config is stored and used by getCurrentDate() to return manipulated dates
  // For global Date manipulation (new Date(), Date.now()), use Sinon or Jest fake timers
  // See documentation for examples
}

/**
 * Get the current date taking into account any date manipulation settings
 * 
 * Note: This function returns a manipulated date object, but does NOT affect
 * global Date() or Date.now(). For global date manipulation, use Sinon or Jest fake timers.
 * See documentation for examples.
 */
export function getCurrentDate(): Date {
  // Check environment variables first (they take precedence)
  const envDate = process.env[ENV_VARS.MOCK_DATE];
  const envOffset = process.env[ENV_VARS.MOCK_DATE_OFFSET];
  const envTimezone = process.env[ENV_VARS.MOCK_TIMEZONE];

  // Environment variables take precedence over config
  if (envDate) {
    return new Date(envDate);
  }

  if (envOffset) {
    const offset = parseInt(envOffset, 10);
    if (!isNaN(offset)) {
      return new Date(Date.now() + offset);
    }
  }

  // Try to get date manipulation from current config
  let dateManipulation = currentConfig?.dateManipulation;

  // If no config, try to load from date-config.json file (per-scenario, then legacy root)
  if (!dateManipulation) {
    const fileConfig = loadDateConfigFromFile(currentConfig?.mockDataPath);
    if (fileConfig && 'dateManipulation' in fileConfig) {
      dateManipulation = fileConfig.dateManipulation;
    }
  }

  // If still no config, return actual current date
  if (!dateManipulation) {
    return new Date();
  }

  // Use config settings if no environment variables are set
  if (dateManipulation.fixedDate) {
    return typeof dateManipulation.fixedDate === 'string'
      ? new Date(dateManipulation.fixedDate)
      : new Date(dateManipulation.fixedDate);
  }

  if (dateManipulation.offset !== undefined) {
    return new Date(Date.now() + dateManipulation.offset);
  }

  // If timezone is specified, adjust the date
  const timezone = envTimezone || dateManipulation.timezone;
  if (timezone) {
    const date = new Date();
    try {
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}. Using system timezone instead.`);
    }
  }

  return new Date();
}

/**
 * Reset any date manipulation settings
 * Note: This does NOT restore fake timers if you're using Sinon/Jest fake timers
 * You need to restore those separately (clock.restore() or jest.useRealTimers())
 */
export function resetDateManipulation(): void {
  currentConfig = null;
}

/**
 * Format a date string in ISO format
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse a date string in various formats
 */
export function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  return date;
} 