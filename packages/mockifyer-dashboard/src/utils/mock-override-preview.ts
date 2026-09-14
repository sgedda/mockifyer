/** Max override rows shown on mock list cards. */
export const OVERRIDE_PREVIEW_LIMIT = 3;

export interface OverridePreview {
  path: string;
  summary: string;
}

export interface OverridePreviewResult {
  hasOverrides: boolean;
  preview: OverridePreview[];
}

export interface ListOverrideFields {
  hasResponseDateOverrides: boolean;
  responseDateOverridesPreview: OverridePreview[];
  hasResponseFieldOverrides: boolean;
  responseFieldOverridesPreview: OverridePreview[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Compact date-offset summary for list cards (e.g. `2d 3h` or `no offset`).
 */
export function buildDateOverrideSummary(override: Record<string, unknown>): string {
  const pieces: string[] = [];
  const offsetDays = override.offsetDays;
  const offsetHours = override.offsetHours;
  const offsetMinutes = override.offsetMinutes;
  const offsetMs = override.offsetMs;

  if (typeof offsetDays === 'number' && offsetDays !== 0) pieces.push(`${offsetDays}d`);
  if (typeof offsetHours === 'number' && offsetHours !== 0) pieces.push(`${offsetHours}h`);
  if (typeof offsetMinutes === 'number' && offsetMinutes !== 0) pieces.push(`${offsetMinutes}m`);
  if (typeof offsetMs === 'number' && offsetMs !== 0) pieces.push(`${offsetMs}ms`);

  const format = override.format;
  if (typeof format === 'string' && format) pieces.push(`format=${format}`);

  if (pieces.length === 0) return 'no offset';
  return pieces.join(' ');
}

function stringifyPreviewValue(value: unknown): string {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) return 'undefined';
    if (encoded.length > 80) return `${encoded.slice(0, 77)}...`;
    return encoded;
  } catch {
    return String(value);
  }
}

/**
 * Compact field-override summary for list cards (JSON value, `extend …`, or `remove`).
 */
export function buildFieldOverrideSummary(override: Record<string, unknown>): string {
  const mode = override.mode;
  if (mode === 'remove') return 'remove';
  const encoded = stringifyPreviewValue(override.value);
  if (mode === 'extend') return `extend ${encoded}`;
  return encoded;
}

function collectOverridePreview(
  raw: unknown,
  summarize: (entry: Record<string, unknown>) => string
): OverridePreviewResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { hasOverrides: false, preview: [] };
  }
  const preview: OverridePreview[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const pathVal = item.path;
    if (typeof pathVal !== 'string' || !pathVal.trim()) continue;
    preview.push({ path: pathVal, summary: summarize(item) });
    if (preview.length >= OVERRIDE_PREVIEW_LIMIT) break;
  }
  return { hasOverrides: preview.length > 0, preview };
}

/** Date-offset overlays stored on the mock (`responseDateOverrides`). */
export function getDateOverridePreview(mockData: unknown): OverridePreviewResult {
  const overrides = isRecord(mockData) ? mockData.responseDateOverrides : undefined;
  return collectOverridePreview(overrides, buildDateOverrideSummary);
}

/** Replay-time field overlays stored on the mock (`responseFieldOverrides`). */
export function getFieldOverridePreview(mockData: unknown): OverridePreviewResult {
  const overrides = isRecord(mockData) ? mockData.responseFieldOverrides : undefined;
  return collectOverridePreview(overrides, buildFieldOverrideSummary);
}

/**
 * List-card flags and previews for both field and date overlays.
 * Field-only mocks must still appear in the Overrides section.
 */
export function getListOverrideFields(mockData: unknown): ListOverrideFields {
  const date = getDateOverridePreview(mockData);
  const field = getFieldOverridePreview(mockData);
  return {
    hasResponseDateOverrides: date.hasOverrides,
    responseDateOverridesPreview: date.preview,
    hasResponseFieldOverrides: field.hasOverrides,
    responseFieldOverridesPreview: field.preview,
  };
}
