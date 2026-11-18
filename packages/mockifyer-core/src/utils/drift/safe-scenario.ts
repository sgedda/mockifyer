import { parseScenarioName } from '../scenario';

/**
 * Scenario names are path segments under mock-data. Reject separators and `..`
 * before any directory walk or mock write.
 */
export function requireSafeScenarioName(scenario: string): string {
  const parsed = parseScenarioName(scenario);
  if (!parsed) {
    throw new Error(
      `Invalid scenario name: "${scenario}". Use only letters, numbers, hyphens, and underscores.`
    );
  }
  return parsed;
}
