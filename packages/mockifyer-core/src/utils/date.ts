import { MockifyerConfig, ENV_VARS } from '../types';
import { logger } from './logger';
import { getCurrentScenario, getScenarioFolderPath } from './scenario';
import {
  getRuntimeDateManipulation,
  stopRuntimeDateSync,
} from './runtime-date-sync';

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

/** Optional context when resolving date manipulation from disk (e.g. dashboard proxy + Redis scenario). */
export interface GetCurrentDateContext {
  mockDataPath?: string;
  /** Load `{mockDataPath}/{scenario}/date-config.json` instead of the filesystem active scenario. */
  scenario?: string;
  /**
   * When the dashboard loads date settings from Redis: pass the `dateManipulation` object to apply.
   * Pass `null` when Redis has no key for that scenario (falls through to disk).
   * When omitted, only in-memory config + disk are used (default client behavior).
   */
  explicitManipulation?: Record<string, unknown> | null;
}

/**
 * True when a dateManipulation payload would change {@link getCurrentDate}
 * (fixed date, offset, or timezone).
 */
export function dateManipulationHasEffect(
  dm: Record<string, unknown> | null | undefined
): boolean {
  if (!dm || typeof dm !== 'object') {
    return false;
  }
  const fixed = dm.fixedDate;
  const hasFixed = fixed !== undefined && fixed !== null && fixed !== '';
  const hasOffset = dm.offset !== undefined && dm.offset !== null && typeof dm.offset === 'number';
  const tz = dm.timezone;
  const hasTz = tz !== undefined && tz !== null && tz !== '';
  return hasFixed || hasOffset || hasTz;
}

/**
 * Date manipulation the dashboard proxy should pass as `explicitManipulation`.
 * An effective **client-lane** payload wins over the scenario Redis/sqlite document.
 * When the scenario document is missing (`null`), returns `null` so Redis mode does not fall back to disk.
 */
export function resolveExplicitDateManipulation(options: {
  laneManipulation?: Record<string, unknown> | null;
  scenarioDateDoc: { dateManipulation: Record<string, unknown> | null } | null;
}): Record<string, unknown> | null {
  if (dateManipulationHasEffect(options.laneManipulation)) {
    return options.laneManipulation as Record<string, unknown>;
  }
  if (options.scenarioDateDoc === null) {
    return null;
  }
  return options.scenarioDateDoc.dateManipulation ?? {};
}

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
 *
 * @param scenarioOverride When provided (e.g. Redis-resolved scenario), loads that folder instead of filesystem `scenario-config`.
 */
function loadDateConfigFromFile(
  mockDataPath?: string,
  scenarioOverride?: string
): { dateManipulation?: any } | null {
  // Skip file loading if fs/path are not available (React Native)
  if (!fs || !path) {
    return null;
  }

  try {
    if (mockDataPath && fs.existsSync(mockDataPath)) {
      const scenario =
        typeof scenarioOverride === 'string' && scenarioOverride.trim()
          ? scenarioOverride.trim()
          : getCurrentScenario(mockDataPath);
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
 * Apply a dateManipulation record (fixed date, offset, or timezone).
 */
function dateFromManipulationRecord(dm: Record<string, unknown>): Date {
  const fixed = dm.fixedDate;
  if (typeof fixed === 'string' && fixed) {
    return new Date(fixed);
  }
  if (fixed instanceof Date) {
    return new Date(fixed);
  }
  const offset = dm.offset;
  if (typeof offset === 'number' && !Number.isNaN(offset)) {
    return new Date(Date.now() + offset);
  }
  const timezone = dm.timezone;
  if (typeof timezone === 'string' && timezone) {
    try {
      return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    } catch {
      logger.warn(`Invalid timezone: ${timezone}. Using system timezone instead.`);
    }
  }
  return new Date();
}

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
}

/**
 * Get the current date taking into account any date manipulation settings
 * 
 * Note: This function returns a manipulated date object, but does NOT affect
 * global Date() or Date.now(). For global date manipulation, use Sinon or Jest fake timers.
 * See documentation for examples.
 *
 * @param context Optional; pass `mockDataPath`/`scenario` so server code (e.g. dashboard Redis proxy) reads the same
 *                `date-config.json` as the UI instead of falling back to `process.cwd()/mock-data` discovery.
 *                With `proxy.baseUrl`, a process cache from Redis Date Config is used so bare `getCurrentDate()`
 *                follows the active scenario (lane date wins when set).
 */
export function getCurrentDate(context?: GetCurrentDateContext): Date {
  // Redis-backed dashboard: explicit manipulation from `{prefix}:date_config:{scenario}`
  //
  // IMPORTANT: This must take precedence over environment variables.
  // Otherwise, a stale `MOCKIFYER_DATE*` env var (set by older servers / previous runs)
  // can silently override the Redis-backed proxy configuration.
  if (
    context !== undefined &&
    Object.prototype.hasOwnProperty.call(context, 'explicitManipulation')
  ) {
    const ex = context.explicitManipulation;
    // `null` means "explicitly cleared" for Redis/proxy mode: do not fall back to disk.
    if (ex === null) {
      return new Date();
    }
    if (ex !== null && typeof ex === 'object') {
      // `{}` (or otherwise "ineffective") is an explicit "clear" signal: treat as no manipulation
      // and do not fall through to env vars / disk defaults.
      if (!dateManipulationHasEffect(ex)) {
        return new Date();
      }
      return dateFromManipulationRecord(ex);
    }
  }

  // Dashboard/Redis process cache (scenario or lane). Beats env so stale MOCKIFYER_DATE*
  // cannot override Date Config the way the proxy already ignores env.
  const runtimeManipulation = getRuntimeDateManipulation();
  if (runtimeManipulation !== undefined) {
    if (runtimeManipulation === null || !dateManipulationHasEffect(runtimeManipulation)) {
      return new Date();
    }
    return dateFromManipulationRecord(runtimeManipulation);
  }

  // Check environment variables (they take precedence over disk config)
  const envDate = process.env[ENV_VARS.MOCK_DATE];
  const envOffset = process.env[ENV_VARS.MOCK_DATE_OFFSET];
  const envTimezone = process.env[ENV_VARS.MOCK_TIMEZONE];

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
  let dateManipulation: Record<string, unknown> | null | undefined = currentConfig?.dateManipulation;

  // If no config, try to load from date-config.json file (per-scenario, then legacy root)
  const disableDateConfigFileFallback = currentConfig?.disableDateConfigFileFallback ?? true;
  if (!disableDateConfigFileFallback && !dateManipulation && dateManipulation !== null) {
    const pathForFile = context?.mockDataPath ?? currentConfig?.mockDataPath;
    const fileConfig = loadDateConfigFromFile(pathForFile, context?.scenario);
    if (fileConfig && 'dateManipulation' in fileConfig) {
      dateManipulation = fileConfig.dateManipulation;
    }
  }

  // If still no config, return actual current date
  if (!dateManipulation) {
    return new Date();
  }

  const dm = dateManipulation as Record<string, unknown>;

  // Use config settings if no environment variables are set
  const fixed = dm.fixedDate;
  if (typeof fixed === 'string' && fixed) {
    return new Date(fixed);
  }
  if (fixed instanceof Date) {
    return new Date(fixed);
  }

  const offset = dm.offset;
  if (typeof offset === 'number' && !Number.isNaN(offset)) {
    return new Date(Date.now() + offset);
  }

  // If timezone is specified, adjust the date
  const timezone = envTimezone || dm.timezone;
  if (typeof timezone === 'string' && timezone) {
    const date = new Date();
    try {
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    } catch {
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
  stopRuntimeDateSync();
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