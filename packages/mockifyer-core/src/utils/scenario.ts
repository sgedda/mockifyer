import { MockifyerConfig, ENV_VARS } from '../types';
import { POOL_DIR_NAME } from '../types/fixture-pool';
import { getMaxRequestsPerScenarioFromEnv } from './redis-mock-write-limits';

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

/** Durable seed scenario users can select explicitly (not the unset fallback). */
export const DEFAULT_SCENARIO = 'default';

/**
 * Ephemeral bucket used when no scenario is configured (env, config, file, Redis lane/global).
 * Distinct from {@link DEFAULT_SCENARIO} so intentional long-lived `default` mocks stay durable.
 */
export const SCRATCH_SCENARIO = '_scratch';

/** Default Redis TTL for mocks written under {@link SCRATCH_SCENARIO} (24h). */
export const SCRATCH_SCENARIO_DEFAULT_TTL_SEC = 60 * 60 * 24;

const UNSAFE_CLIENT_ID_PATH_CHARS = /[/\\\0]/;

/**
 * Reject scenario names reserved for Mockifyer internals (e.g. the fixture pool directory).
 * @param options.allowScratch - when true, `_scratch` is allowed (view/select temporary traffic).
 */
export function assertNotReservedScenarioName(
  scenarioName: string,
  options?: { allowScratch?: boolean }
): void {
  const trimmed = scenarioName.trim();
  if (trimmed === POOL_DIR_NAME) {
    throw new Error(`Invalid scenario name: "${scenarioName}" is reserved for the fixture pool.`);
  }
  if (!options?.allowScratch && trimmed === SCRATCH_SCENARIO) {
    throw new Error(
      `Invalid scenario name: "${scenarioName}" is reserved for temporary unscoped traffic. ` +
        `Create or select a named scenario (e.g. "${DEFAULT_SCENARIO}") to keep mocks.`
    );
  }
}

/** True when the scenario is the ephemeral unscoped bucket. */
export function isScratchScenario(scenarioName: string | null | undefined): boolean {
  return typeof scenarioName === 'string' && scenarioName.trim() === SCRATCH_SCENARIO;
}

/**
 * Redis TTL (seconds) for mocks under {@link SCRATCH_SCENARIO}.
 * Override with `MOCKIFYER_SCRATCH_SCENARIO_TTL_SEC` (positive integer).
 */
export function getScratchScenarioTtlSec(): number {
  const raw =
    typeof process !== 'undefined'
      ? process.env?.[ENV_VARS.MOCK_SCRATCH_SCENARIO_TTL_SEC]
      : undefined;
  if (raw == null || String(raw).trim() === '') {
    return SCRATCH_SCENARIO_DEFAULT_TTL_SEC;
  }
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : SCRATCH_SCENARIO_DEFAULT_TTL_SEC;
}

/** UI-oriented label; keeps the storage id (`_scratch`) in tooltips / monospace elsewhere. */
export function scratchScenarioDisplayName(): string {
  return 'Temporary (unscoped)';
}

/** Highest-priority scenario (e.g. Detox / E2E via react-native-launch-arguments). Set with setScenarioLaunchOverride. */
let scenarioLaunchOverride: string | null = null;

/**
 * Set a scenario that wins over env, config, scenario-config.json, and Metro-synced scenario.
 * Use for E2E (e.g. react-native-launch-arguments) so `args.scenario` always applies.
 * Pass null, undefined, or '' to clear.
 */
export function setScenarioLaunchOverride(scenario: string | null | undefined): void {
  if (scenario === null || scenario === undefined) {
    scenarioLaunchOverride = null;
    return;
  }
  const trimmed = String(scenario).trim();
  if (trimmed === '') {
    scenarioLaunchOverride = null;
    return;
  }
  assertNotReservedScenarioName(trimmed);
  scenarioLaunchOverride = trimmed;
}

/**
 * Returns the launch-override scenario if set, otherwise null.
 */
export function getScenarioLaunchOverride(): string | null {
  return scenarioLaunchOverride;
}

/**
 * Simple path join helper that works in both Node.js and React Native
 */
function joinPath(...parts: string[]): string {
  if (path && path.join) {
    return path.join(...parts);
  }
  // Fallback for React Native: simple string concatenation
  return parts.filter(p => p).join('/').replace(/\/+/g, '/');
}

function getClientScenarioConfigPath(mockDataPath: string, clientId?: string): string {
  const trimmedClientId = typeof clientId === 'string' ? clientId.trim() : '';
  if (!trimmedClientId || UNSAFE_CLIENT_ID_PATH_CHARS.test(trimmedClientId)) {
    return '';
  }
  return joinPath(mockDataPath, `scenario-config.${trimmedClientId}.json`);
}

/**
 * Try to load scenario config from scenario-config.json file in mock data directory
 */
function loadScenarioConfigFromFile(
  mockDataPath?: string,
  clientId?: string
): { currentScenario?: string } | null {
  // Not available in React Native (fs is stubbed)
  if (!fs || !fs.existsSync || !fs.readFileSync) {
    return null;
  }

  try {
    // Try to detect mock data path if not provided
    let configPath: string;
    if (mockDataPath) {
      const preferred = getClientScenarioConfigPath(mockDataPath, clientId);
      const fallback = joinPath(mockDataPath, 'scenario-config.json');
      configPath = preferred && fs!.existsSync(preferred) ? preferred : fallback;
    } else {
      // Try common locations (only works in Node.js)
      const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '';
      const possiblePaths = [
        './mock-data/scenario-config.json',
        './persisted/mock-data/scenario-config.json',
        cwd ? joinPath(cwd, 'mock-data', 'scenario-config.json') : '',
        cwd ? joinPath(cwd, 'persisted', 'mock-data', 'scenario-config.json') : '',
      ];
      
      configPath = possiblePaths.find(p => p && fs!.existsSync(p)) || '';
    }

    if (!configPath || !fs.existsSync(configPath)) {
      return null;
    }

    const fileContent = fs.readFileSync(configPath, 'utf-8');
    // Check if file is empty or only whitespace
    if (!fileContent || !fileContent.trim()) {
      return null;
    }
    
    const config = JSON.parse(fileContent);
    return config.currentScenario ? { currentScenario: config.currentScenario } : null;
  } catch (error) {
    // Silently fail - file might not exist or be invalid
    return null;
  }
}

function configDefaultScenarioName(): string | undefined {
  if (!currentConfig) return undefined;
  const preferred = currentConfig.defaultScenario ?? currentConfig.scenarios?.default;
  return preferred && preferred.trim() ? preferred.trim() : undefined;
}

/**
 * Current scenario used for filesystem/redis fallback paths outside the dashboard lane keys.
 *
 * **Precedence (first match wins)**:
 *
 * | Order | Source |
 * | :--- | :--- |
 * | 1 | **`setScenarioLaunchOverride`** (E2E / Detox via launch arguments) |
 * | 2 | **`MOCKIFYER_SCENARIO`** env |
 * | 3 | **`config.defaultScenario`** or **`config.scenarios.default`** (**`defaultScenario`** wins when both set) |
 * | 4 | **`scenario-config.json`** (**`scenario-config.{clientId}.json`** preferred when **`clientId`** is set and that file exists) |
 * | 5 | **`_scratch`** ephemeral unscoped bucket (not durable {@link DEFAULT_SCENARIO}) |
 *
 * **Dashboard Redis proxy**: per-request **`scenario`** body / proxy envelope overrides **`client_scenario:{clientId}`**,
 * then global **`active_scenario`**, then this filesystem-derived fallback (unless strict lane-only mode disables global for mapped lanes —
 * see dashboard **`MOCKIFYER_STRICT_LANE_SCENARIO`**). Documented fully in README (Scenario precedence).
 *
 * Unset traffic lands in **`_scratch`** (Redis mocks expire after {@link getScratchScenarioTtlSec}).
 * Select or set a named scenario (including **`default`**) for long-lived mocks.
 */
export function getCurrentScenario(mockDataPath?: string, clientId?: string): string {
  if (scenarioLaunchOverride) {
    return scenarioLaunchOverride;
  }

  // Check environment variable
  const envScenario = process.env[ENV_VARS.MOCK_SCENARIO];
  if (envScenario != null && String(envScenario).trim() !== '') {
    return String(envScenario).trim();
  }

  const configScenario = configDefaultScenarioName();
  if (configScenario) {
    return configScenario;
  }

  const fileConfig = loadScenarioConfigFromFile(mockDataPath || currentConfig?.mockDataPath, clientId);
  if (fileConfig?.currentScenario) {
    return fileConfig.currentScenario;
  }

  return SCRATCH_SCENARIO;
}

/**
 * Get the scenario folder path for a given scenario name
 */
export function getScenarioFolderPath(mockDataPath: string, scenario?: string): string {
  const scenarioName = scenario || getCurrentScenario(mockDataPath);
  return joinPath(mockDataPath, scenarioName);
}

/**
 * Ensure scenario folder exists
 */
export function ensureScenarioFolder(mockDataPath: string, scenario?: string): string {
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  // Only create folder if fs is available (Node.js environment)
  if (fs && fs.existsSync && fs.mkdirSync) {
    if (!fs.existsSync(scenarioPath)) {
      fs.mkdirSync(scenarioPath, { recursive: true });
    }
  }
  // In React Native, folder creation is handled by the provider
  return scenarioPath;
}

/**
 * Initialize scenario management with the given config
 */
export function initializeScenario(config: MockifyerConfig): void {
  currentConfig = config;
  
  // Ensure default scenario folder exists
  if (config.mockDataPath) {
    const currentScenario = getCurrentScenario(config.mockDataPath);
    ensureScenarioFolder(config.mockDataPath, currentScenario);
  }
}

/**
 * List all available scenarios (folders in mock data directory)
 */
export function listScenarios(mockDataPath: string): string[] {
  // Not available in React Native (fs is stubbed)
  // In React Native, scenarios are managed by the provider
  if (!fs || !fs.existsSync || !fs.readdirSync) {
    return [DEFAULT_SCENARIO, SCRATCH_SCENARIO];
  }

  if (!fs.existsSync(mockDataPath)) {
    return [DEFAULT_SCENARIO, SCRATCH_SCENARIO];
  }

  const items = fs.readdirSync(mockDataPath, { withFileTypes: true });
  const scenarios: string[] = [];
  
  for (const item of items) {
    // Only include directories, and exclude special config files and system directories
    const nameLower = item.name.toLowerCase();
    if (
      item.isDirectory() &&
      !item.name.startsWith('.') &&
      item.name !== 'node_modules' &&
      item.name !== POOL_DIR_NAME &&
      nameLower !== 'lost+found'
    ) {
      scenarios.push(item.name);
    }
  }

  // Always offer durable seed + temporary unscoped bucket in the picker.
  if (!scenarios.includes(DEFAULT_SCENARIO)) {
    scenarios.push(DEFAULT_SCENARIO);
  }
  if (!scenarios.includes(SCRATCH_SCENARIO)) {
    scenarios.push(SCRATCH_SCENARIO);
  }

  return scenarios.sort();
}

/**
 * Create a new scenario (creates folder)
 */
export function createScenario(mockDataPath: string, scenarioName: string): void {
  if (!scenarioName || scenarioName.trim() === '') {
    throw new Error('Scenario name cannot be empty');
  }

  // Validate scenario name (must be safe for filesystem)
  const sanitized = scenarioName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (sanitized !== scenarioName.trim()) {
    throw new Error(`Invalid scenario name: "${scenarioName}". Use only letters, numbers, hyphens, and underscores.`);
  }
  assertNotReservedScenarioName(sanitized);

  // Check max scenarios limit (only if limit is set via env var)
  const MAX_SCENARIOS = process.env.MOCKIFYER_MAX_SCENARIOS 
    ? parseInt(process.env.MOCKIFYER_MAX_SCENARIOS, 10) 
    : undefined;
  
  if (MAX_SCENARIOS !== undefined) {
    // Count only scenarios that actually exist as directories
    // (listScenarios includes 'default' even if it doesn't exist, so we need to filter)
    if (!fs || !fs.existsSync || !fs.readdirSync) {
      // In React Native, we can't check - skip limit check
      // The provider will handle this if needed
    } else {
      let existingCount = 0;
      if (fs.existsSync(mockDataPath)) {
        const items = fs.readdirSync(mockDataPath, { withFileTypes: true });
        for (const item of items) {
          // Count only directories, exclude special files and hidden directories
          const nameLower = item.name.toLowerCase();
          if (
            item.isDirectory() &&
            !item.name.startsWith('.') &&
            item.name !== 'node_modules' &&
            item.name !== POOL_DIR_NAME &&
            nameLower !== 'lost+found'
          ) {
            // Don't count the scenario we're about to create if it already exists
            if (item.name !== sanitized) {
              existingCount++;
            }
          }
        }
      }
      
      if (existingCount >= MAX_SCENARIOS) {
        const errorMessage = `Maximum ${MAX_SCENARIOS} scenarios allowed. Please delete a scenario first.`;
        console.warn(`[Mockifyer] ⚠️ ${errorMessage}`);
        throw new Error(errorMessage);
      }
    }
  }

  ensureScenarioFolder(mockDataPath, sanitized);
}

/**
 * Save current scenario to scenario-config.json
 */
export function saveScenarioConfig(mockDataPath: string, scenario: string): void {
  // Not available in React Native (fs is stubbed)
  // In React Native, scenario config is managed by the provider
  if (!fs || !fs.writeFileSync) {
    return;
  }

  // Allow selecting `_scratch` to inspect temporary traffic; block other reserved names.
  assertNotReservedScenarioName(scenario, { allowScratch: true });

  const configPath = joinPath(mockDataPath, 'scenario-config.json');
  const config = {
    currentScenario: scenario,
    updatedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Reset scenario management
 */
export function resetScenario(): void {
  currentConfig = null;
}

/**
 * Check if request limit is reached for the current scenario
 * @param mockDataPath Path to mock data directory
 * @returns Object with limitReached boolean and error details if limit is reached
 */
export function checkRequestLimit(mockDataPath: string): {
  limitReached: boolean;
  error?: {
    message: string;
    maxRequests: number;
    currentScenario: string;
  };
} {
  const MAX_REQUESTS_PER_SCENARIO = getMaxRequestsPerScenarioFromEnv();
  
  if (MAX_REQUESTS_PER_SCENARIO === undefined) {
    return { limitReached: false };
  }

  // Not available in React Native (fs is stubbed)
  if (!fs || !fs.existsSync || !fs.readdirSync) {
    return { limitReached: false };
  }

  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioFolderPath(mockDataPath, currentScenario);
    
    if (!fs.existsSync(scenarioPath)) {
      return { limitReached: false };
    }

    const files = fs.readdirSync(scenarioPath)
      .filter(file => file.endsWith('.json') && file !== 'scenario-config.json' && file !== 'date-config.json');
    
    if (files.length >= MAX_REQUESTS_PER_SCENARIO) {
      const errorMessage = `Maximum ${MAX_REQUESTS_PER_SCENARIO} requests per scenario reached for scenario "${currentScenario}". Please delete some mock files or switch to a different scenario.`;
      return {
        limitReached: true,
        error: {
          message: errorMessage,
          maxRequests: MAX_REQUESTS_PER_SCENARIO,
          currentScenario: currentScenario
        }
      };
    }
  } catch (error) {
    // If check fails, don't block - just log and continue
    console.warn(`[Mockifyer] ⚠️ Error checking request limit:`, error);
    return { limitReached: false };
  }

  return { limitReached: false };
}

