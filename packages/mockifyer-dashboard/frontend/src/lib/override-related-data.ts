import { getValueAtResponsePath, parsePathSegments } from './detect-date-fields'

export const JSON_PREVIEW_MAX_CHARS = 20_000
export const RELATED_KEY_LIMIT = 40

export interface PathCrumb {
  path: string
  label: string
}

/** Clickable segments for a dotted override path (`bookings.0.date` → bookings › [0] › date). */
export function pathCrumbs(path: string): PathCrumb[] {
  const segments = parsePathSegments(path.trim())
  const crumbs: PathCrumb[] = []
  let acc = ''
  for (const segment of segments) {
    acc = acc ? `${acc}.${segment}` : segment
    crumbs.push({
      path: acc,
      label: /^\d+$/.test(segment) ? `[${segment}]` : segment,
    })
  }
  return crumbs
}

export function parentOverridePath(path: string): string | null {
  const segments = parsePathSegments(path.trim())
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('.')
}

/**
 * Default JSON to show when expanding a row: the object/array at the path,
 * or its parent when the leaf is a primitive (the booking / timeline item).
 */
export function defaultInspectPath(root: unknown, path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  const value = getValueAtResponsePath(root, trimmed)
  if (value !== undefined && value !== null && typeof value === 'object') {
    return trimmed
  }
  return parentOverridePath(trimmed) ?? trimmed
}

export function formatJsonPreview(value: unknown, maxChars = JSON_PREVIEW_MAX_CHARS): string {
  if (value === undefined) return ''
  try {
    const text = JSON.stringify(value, null, 2) ?? 'null'
    if (text.length <= maxChars) return text
    return `${text.slice(0, maxChars)}\n…truncated`
  } catch {
    return String(value)
  }
}

export function formatLeafPreview(value: unknown, maxLen = 96): string {
  if (value === undefined) return ''
  if (typeof value === 'string') {
    if (value.length === 0) return '""'
    return value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  if (Array.isArray(value)) return `Array (${value.length})`
  if (typeof value === 'object') {
    return `Object (${Object.keys(value as object).length} keys)`
  }
  return String(value)
}

export function relatedChildKeys(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    return value.slice(0, RELATED_KEY_LIMIT).map((_, index) => String(index))
  }
  return Object.keys(value as object).slice(0, RELATED_KEY_LIMIT)
}

export function joinOverridePath(base: string, segment: string): string {
  const trimmed = base.trim()
  return trimmed ? `${trimmed}.${segment}` : segment
}
