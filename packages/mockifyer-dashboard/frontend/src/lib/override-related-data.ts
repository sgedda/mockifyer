import { getValueAtResponsePath, parsePathSegments } from './detect-date-fields'

export const JSON_PREVIEW_MAX_CHARS = 20_000
export const RELATED_KEY_LIMIT = 40
export const RELATED_ARRAY_ITEM_LIMIT = 250
export const RELATED_FILTER_MIN_COUNT = 8

/** Nested GraphQL/JSON wrappers that usually hold the real entity. */
const NESTED_ENTITY_KEYS = [
  'booking',
  'node',
  'item',
  'trip',
  'reservation',
  'hotel',
  'flight',
  'stay',
  'order',
] as const

/** Scalar keys that help identify which array item an override belongs to. */
const IDENTITY_KEYS = [
  'id',
  'uuid',
  'bookingId',
  'bookingNumber',
  'confirmationNumber',
  'confirmation',
  'reference',
  'reservationId',
  'tripId',
  'code',
  'number',
  'name',
  'title',
  'label',
  'destination',
  'hotelName',
  'city',
  'status',
  'state',
  'type',
  '__typename',
  'bookedDate',
  'startDate',
  'endDate',
  'checkIn',
  'checkOut',
  'checkInDate',
  'checkOutDate',
  'departureDate',
  'arrivalDate',
] as const

const MAX_IDENTITY_PARTS = 5
const IDENTITY_VALUE_MAX = 40

export interface PathCrumb {
  path: string
  label: string
}

export interface RelatedChildEntry {
  key: string
  path: string
  value: unknown
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
  return relatedChildEntries(value, '').entries.map((entry) => entry.key)
}

export function joinOverridePath(base: string, segment: string): string {
  const trimmed = base.trim()
  return trimmed ? `${trimmed}.${segment}` : segment
}

function scalarIdentityText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed.length > IDENTITY_VALUE_MAX
      ? `${trimmed.slice(0, IDENTITY_VALUE_MAX - 1)}…`
      : trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  return null
}

function pushIdentityParts(record: Record<string, unknown>, parts: string[], seen: Set<string>): void {
  for (const key of IDENTITY_KEYS) {
    if (parts.length >= MAX_IDENTITY_PARTS) return
    if (!(key in record)) continue
    const text = scalarIdentityText(record[key])
    if (!text) continue
    const dedupe = `${key}:${text}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    if (key === '__typename') {
      parts.push(text)
      continue
    }
    if (key === 'id' || key === 'uuid' || key.endsWith('Id') || key.endsWith('Number')) {
      parts.push(`${key} ${text}`)
      continue
    }
    parts.push(text)
  }
}

/**
 * Compact identity line for an array item (and a nested `booking` / `node` / … object).
 */
export function summarizeOverrideArrayItem(value: unknown): string {
  if (value === undefined) return ''
  if (value === null || typeof value !== 'object') return formatLeafPreview(value)
  if (Array.isArray(value)) return `Array (${value.length})`

  const root = value as Record<string, unknown>
  const parts: string[] = []
  const seen = new Set<string>()
  pushIdentityParts(root, parts, seen)
  for (const nestedKey of NESTED_ENTITY_KEYS) {
    if (parts.length >= MAX_IDENTITY_PARTS) break
    const nested = root[nestedKey]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      pushIdentityParts(nested as Record<string, unknown>, parts, seen)
    }
  }
  return parts.join(' · ')
}

export function summarizeOverrideArrayItemAtPath(responseBody: unknown, arrayItemPath: string): string {
  return summarizeOverrideArrayItem(getValueAtResponsePath(responseBody, arrayItemPath))
}

/** True when an array is worth showing as identity rows instead of index chips. */
export function isRecordArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => item !== null && typeof item === 'object')
}

function relatedChildMatchesQuery(entry: RelatedChildEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (entry.key.toLowerCase().includes(q)) return true
  if (entry.path.toLowerCase().includes(q)) return true
  const identity = summarizeOverrideArrayItem(entry.value).toLowerCase()
  if (identity.includes(q)) return true
  const preview = formatLeafPreview(entry.value).toLowerCase()
  return preview.includes(q)
}

/**
 * Children of an object or array for the click-through inspector.
 * Arrays are scanned in full when filtering so booking numbers beyond the display cap still match.
 */
export function relatedChildEntries(
  parentValue: unknown,
  parentPath: string,
  query = ''
): { entries: RelatedChildEntry[]; truncated: number; total: number } {
  if (parentValue === null || parentValue === undefined || typeof parentValue !== 'object') {
    return { entries: [], truncated: 0, total: 0 }
  }

  if (Array.isArray(parentValue)) {
    const total = parentValue.length
    const entries: RelatedChildEntry[] = []
    for (let index = 0; index < total; index++) {
      const entry: RelatedChildEntry = {
        key: String(index),
        path: joinOverridePath(parentPath, String(index)),
        value: parentValue[index],
      }
      if (!relatedChildMatchesQuery(entry, query)) continue
      entries.push(entry)
      if (entries.length >= RELATED_ARRAY_ITEM_LIMIT) {
        return { entries, truncated: total - (index + 1), total }
      }
    }
    return { entries, truncated: 0, total }
  }

  const keys = Object.keys(parentValue as object)
  const total = keys.length
  const entries: RelatedChildEntry[] = []
  for (const key of keys) {
    const entry: RelatedChildEntry = {
      key,
      path: joinOverridePath(parentPath, key),
      value: (parentValue as Record<string, unknown>)[key],
    }
    if (!relatedChildMatchesQuery(entry, query)) continue
    entries.push(entry)
    if (entries.length >= RELATED_KEY_LIMIT) {
      return { entries, truncated: Math.max(0, total - entries.length), total }
    }
  }
  return { entries, truncated: 0, total }
}

export function countOverridesAtOrUnderPath(paths: Iterable<string>, itemPath: string): number {
  const trimmed = itemPath.trim()
  let count = 0
  if (!trimmed) {
    for (const path of paths) {
      if (path.trim()) count += 1
    }
    return count
  }
  const prefix = `${trimmed}.`
  for (const path of paths) {
    const value = path.trim()
    if (value === trimmed || value.startsWith(prefix)) count += 1
  }
  return count
}
