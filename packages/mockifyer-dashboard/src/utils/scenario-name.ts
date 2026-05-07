export type ScenarioNameValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export type OptionalScenarioNameValidationResult =
  | { ok: true; value: string | undefined }
  | { ok: false; error: string };

export function sanitizeScenarioName(raw: unknown): ScenarioNameValidationResult {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: 'Scenario name is required' };
  }

  const trimmed = raw.trim();
  const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (sanitized !== trimmed) {
    return {
      ok: false,
      error: `Invalid scenario name: "${trimmed}". Use only letters, numbers, hyphens, and underscores.`,
    };
  }

  return { ok: true, value: sanitized };
}

export function sanitizeOptionalScenarioName(raw: unknown): OptionalScenarioNameValidationResult {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: undefined };
  }

  const parsed = sanitizeScenarioName(raw);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, value: parsed.value };
}
