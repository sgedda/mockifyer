import { getCurrentScenario } from '@sgedda/mockifyer-core';

const SCENARIO_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface ScenarioResolution {
  scenario?: string;
  error?: string;
}

function parseScenarioParam(value: unknown): ScenarioResolution {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== 'string') {
    return { error: 'Scenario must be a single string' };
  }

  const scenario = value.trim();
  if (!scenario) {
    return { error: 'Scenario name is required' };
  }
  if (!SCENARIO_NAME_PATTERN.test(scenario)) {
    return {
      error: `Invalid scenario name: "${value}". Use only letters, numbers, hyphens, and underscores.`,
    };
  }

  return { scenario };
}

export function resolveRequestedScenario(
  mockDataPath: string,
  queryScenario: unknown
): ScenarioResolution {
  const parsed = parseScenarioParam(queryScenario);
  if (parsed.error || parsed.scenario) {
    return parsed;
  }

  return { scenario: getCurrentScenario(mockDataPath) };
}
