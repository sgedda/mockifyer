const SAFE_SCENARIO_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface SafeScenarioName {
  ok: true;
  value: string;
}

export interface UnsafeScenarioName {
  ok: false;
  error: string;
}

export type ScenarioNameParseResult = SafeScenarioName | UnsafeScenarioName;

function scenarioNameError(value: string): string {
  return `Invalid scenario name: "${value}". Use only letters, numbers, hyphens, and underscores.`;
}

export function parseSafeScenarioName(raw: unknown): ScenarioNameParseResult {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'Scenario name is required' };
  }

  const trimmed = raw.trim();
  if (!SAFE_SCENARIO_NAME_PATTERN.test(trimmed)) {
    return { ok: false, error: scenarioNameError(trimmed) };
  }

  return { ok: true, value: trimmed };
}

export function isSafeScenarioName(raw: unknown): raw is string {
  return parseSafeScenarioName(raw).ok;
}

export function requireSafeScenarioName(raw: unknown, source = 'scenario'): string {
  const parsed = parseSafeScenarioName(raw);
  if (!parsed.ok) {
    throw new Error(`${source}: ${parsed.error}`);
  }
  return parsed.value;
}
