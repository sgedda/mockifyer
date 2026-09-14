import type {
  MockResponseFieldOverride,
  MockResponseFieldOverrideMode,
} from '@/types'

export interface FieldOverrideRow {
  path: string
  mode: MockResponseFieldOverrideMode
  /** JSON text shown in the editor; ignored when mode is `remove`. */
  valueText: string
}

function encodeOverrideValue(value: unknown): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * Parse editor value text. Valid JSON wins; otherwise the raw string is kept
 * so `CONFIRMED` (unquoted) still saves as a string.
 */
export function parseFieldOverrideValueText(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

export function fieldOverridesToRows(
  overrides: MockResponseFieldOverride[] | undefined | null
): FieldOverrideRow[] {
  if (!Array.isArray(overrides)) return []
  return overrides.map((entry) => ({
    path: typeof entry.path === 'string' ? entry.path : '',
    mode: entry.mode === 'extend' || entry.mode === 'remove' ? entry.mode : 'replace',
    valueText: entry.mode === 'remove' ? '' : encodeOverrideValue(entry.value),
  }))
}

export function emptyFieldOverrideRow(): FieldOverrideRow {
  return { path: '', mode: 'replace', valueText: '' }
}

/**
 * Convert editor rows into persistable field overlays.
 * Rows with an empty path are skipped. Returns an error instead of a partial list.
 */
export function rowsToFieldOverrides(
  rows: FieldOverrideRow[]
): { overrides: MockResponseFieldOverride[]; error: string | null } {
  const overrides: MockResponseFieldOverride[] = []
  for (const row of rows) {
    const path = row.path.trim()
    if (!path) continue
    const mode = row.mode
    if (mode === 'remove') {
      overrides.push({ path, mode: 'remove' })
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(row, 'valueText') || row.valueText.trim() === '') {
      return { overrides: [], error: `Field override "${path}" needs a JSON value (or switch mode to Remove)` }
    }
    const value = parseFieldOverrideValueText(row.valueText)
    const entry: MockResponseFieldOverride = { path, value }
    if (mode !== 'replace') entry.mode = mode
    overrides.push(entry)
  }
  return { overrides, error: null }
}
