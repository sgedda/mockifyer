/**
 * Browser stub for scenario utilities.
 * Scenario management requires fs access, not available in browsers.
 */

export function initializeScenario(_config?: any): void {
  // Browser: no-op (scenario initialization requires fs)
}

export function isScenarioLaunchFromNativeArguments(): boolean {
  // Browser: no launch arguments
  return false;
}

export function getCurrentScenario(): string {
  // Browser: always use default scenario
  return 'default';
}

export function getScenarioFolderPath(basePath: string): string {
  // Browser: return base path as-is
  return basePath;
}

export function ensureScenarioFolder(_basePath: string): void {
  // Browser: no-op
}
