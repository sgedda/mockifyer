import type { MockData, MockFile, MockResponseDateOverride } from '@/types'

/** Number of field overlays on a list row (0 when the API omitted the count). */
export function countListFieldOverrides(mock: MockFile): number {
  return mock.responseFieldOverridesCount ?? 0
}

/** Number of date overlays on a list row. */
export function countListDateOverrides(mock: MockFile): number {
  if (typeof mock.responseDateOverridesCount === 'number') {
    return mock.responseDateOverridesCount
  }
  return mock.hasResponseDateOverrides === true
    ? Math.max(mock.responseDateOverridesPreview?.length ?? 0, 1)
    : 0
}

/** Field + date overlay count for mock list cards. */
export function countListOverrides(mock: MockFile): number {
  return countListFieldOverrides(mock) + countListDateOverrides(mock)
}

/** Field + date overlay count from a loaded mock document. */
export function countStoredOverrides(mock: MockData): number {
  const fields = mock.data.responseFieldOverrides?.length ?? 0
  const dates = mock.data.responseDateOverrides?.length ?? 0
  return fields + dates
}

export function formatOverrideCountLabel(count: number): string {
  if (count === 1) return '1 override'
  return `${count} overrides`
}

export function normalizeDateOverrideRow(
  override: MockResponseDateOverride
): MockResponseDateOverride {
  return {
    path: override.path ?? '',
    base: override.base,
    offsetMs: override.offsetMs ?? 0,
    offsetDays: override.offsetDays ?? 0,
    offsetHours: override.offsetHours ?? 0,
    offsetMinutes: override.offsetMinutes ?? 0,
    format: override.format,
  }
}

/** Persist only non-zero offsets and optional format (matches mockifyer-core). */
export function sanitizeDateOverridesForSave(
  overrides: MockResponseDateOverride[]
): MockResponseDateOverride[] {
  return overrides
    .filter((override) => override.path?.trim())
    .map((override) => {
      const path = override.path.trim()
      const out: MockResponseDateOverride = { path }
      if (override.base && override.base !== 'now') out.base = override.base
      if (override.offsetMs !== undefined && override.offsetMs !== 0) {
        out.offsetMs = override.offsetMs
      }
      if (override.offsetDays !== undefined && override.offsetDays !== 0) {
        out.offsetDays = override.offsetDays
      }
      if (override.offsetHours !== undefined && override.offsetHours !== 0) {
        out.offsetHours = override.offsetHours
      }
      if (override.offsetMinutes !== undefined && override.offsetMinutes !== 0) {
        out.offsetMinutes = override.offsetMinutes
      }
      if (override.format) out.format = override.format
      return out
    })
}

export function summarizeDateOverride(override: MockResponseDateOverride): string {
  const pieces = [
    override.base && override.base !== 'now' ? `base=${override.base}` : null,
    override.offsetDays != null && override.offsetDays !== 0 ? `days=${override.offsetDays}` : null,
    override.offsetHours != null && override.offsetHours !== 0
      ? `hours=${override.offsetHours}`
      : null,
    override.offsetMinutes != null && override.offsetMinutes !== 0
      ? `min=${override.offsetMinutes}`
      : null,
    override.offsetMs != null && override.offsetMs !== 0 ? `ms=${override.offsetMs}` : null,
    override.format ? `format=${override.format}` : null,
  ].filter(Boolean)
  return pieces.join(' ') || 'no offset'
}
