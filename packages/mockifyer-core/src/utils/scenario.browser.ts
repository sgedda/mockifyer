/**
 * Browser / Metro stub for scenario utilities.
 *
 * Metro remaps `./dist/utils/scenario.js` → this stub. Scenario filesystem
 * helpers are no-ops here; exports must still match the real module so
 * React Native / Expo web do not throw `undefined is not a function`.
 */

export function isValidScenarioName(scenarioName: string): boolean {
  return typeof scenarioName === 'string' && scenarioName.trim().length > 0;
}

export function parseScenarioName(raw: string): string {
  return String(raw || 'default').trim() || 'default';
}

export function assertNotReservedScenarioName(
  _scenarioName: string,
  _options?: unknown
): void {
  // Browser stub: allow any name
}

export function isScratchScenario(scenarioName: string): boolean {
  return String(scenarioName || '').trim() === '_scratch';
}

export function getScratchScenarioTtlSec(): number {
  return 0;
}

export function scratchScenarioDisplayName(): string {
  return '_scratch';
}

export function setScenarioLaunchOverride(
  _scenario: string | null | undefined,
  _options?: unknown
): void {
  // Browser stub: no launch override
}

export function getScenarioLaunchOverride(): string | undefined {
  return undefined;
}

export function isScenarioLaunchFromNativeArguments(): boolean {
  return false;
}

export function getCurrentScenario(): string {
  return 'default';
}

export function getScenarioFolderPath(basePath: string): string {
  return basePath;
}

export function ensureScenarioFolder(_basePath: string): void {
  // Browser stub: no filesystem
}

export function initializeScenario(_config?: unknown): void {
  // Browser stub: no-op
}

export function listScenarios(_mockDataPath: string): string[] {
  return ['default'];
}

export function createScenario(
  _mockDataPath: string,
  scenarioName: string
): string {
  return parseScenarioName(scenarioName);
}

export function saveScenarioConfig(
  _mockDataPath: string,
  _scenario: string
): void {
  // Browser stub: no filesystem
}

export function resetScenario(): void {
  // Browser stub: nothing to reset
}

export function checkRequestLimit(_mockDataPath: string): {
  allowed: boolean;
  count?: number;
} {
  return { allowed: true };
}
