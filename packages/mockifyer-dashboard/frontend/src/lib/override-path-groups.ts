import { getValueAtResponsePath, parsePathSegments } from './detect-date-fields'
import { formatLeafPreview } from './override-related-data'

const INDEX_SEGMENT = /^\d+$/

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

export interface IndexedOverrideRow<T> {
  item: T
  index: number
}

export interface OverrideArrayItemGroup<T> {
  arrayItemPath: string
  indexLabel: string
  items: IndexedOverrideRow<T>[]
}

export interface OverrideArraySection<T> {
  kind: 'array'
  arrayPath: string
  collapseKey: string
  label: string
  itemGroups: OverrideArrayItemGroup<T>[]
}

export interface OverrideUngroupedSection<T> {
  kind: 'ungrouped'
  item: T
  index: number
}

export type OverrideEditorSection<T> = OverrideArraySection<T> | OverrideUngroupedSection<T>

/**
 * Prefix through the first numeric path segment (`data.bookings.0.date` → `data.bookings.0`).
 */
export function topLevelArrayItemPath(path: string): string | null {
  const segments = parsePathSegments(path.trim())
  for (let i = 0; i < segments.length; i++) {
    if (INDEX_SEGMENT.test(segments[i]!)) {
      return segments.slice(0, i + 1).join('.')
    }
  }
  return null
}

/** Parent array path (`data.bookings.0` → `data.bookings`). Empty string for a root array. */
export function arrayPathFromItemPath(itemPath: string): string {
  const segments = parsePathSegments(itemPath.trim())
  if (segments.length === 0) return ''
  if (!INDEX_SEGMENT.test(segments[segments.length - 1]!)) return itemPath.trim()
  return segments.slice(0, -1).join('.')
}

export function arrayCollapseKey(arrayPath: string): string {
  return arrayPath === '' ? '__root_array__' : arrayPath
}

export function arrayItemIndex(itemPath: string): string {
  const segments = parsePathSegments(itemPath.trim())
  return segments[segments.length - 1] ?? '0'
}

export function arrayPathLabel(arrayPath: string): string {
  if (!arrayPath) return 'items'
  const segments = parsePathSegments(arrayPath)
  return segments[segments.length - 1] ?? 'items'
}

/** Short header like `bookings[0]`. */
export function arrayItemGroupLabel(itemPath: string): string {
  const arrayPath = arrayPathFromItemPath(itemPath)
  return `${arrayPathLabel(arrayPath)}[${arrayItemIndex(itemPath)}]`
}

/**
 * Remainder of an override path after the top-level array item
 * (`data.bookings.0.booking.date` + `data.bookings.0` → `booking.date`).
 */
export function pathRelativeToArrayItem(path: string, arrayItemPath: string): string {
  const trimmed = path.trim()
  if (!arrayItemPath) return trimmed
  if (trimmed === arrayItemPath) return '(item)'
  const prefix = `${arrayItemPath}.`
  if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length)
  return trimmed
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

/**
 * Group override rows by the first array in the path.
 * Items of the same array are collected together (all indexes), then split per index.
 * Paths with no array index stay ungrouped, in first-seen order.
 */
export function groupOverridesByTopLevelArray<T extends { path: string }>(
  rows: T[]
): OverrideEditorSection<T>[] {
  const emitted = new Set<number>()
  const sections: OverrideEditorSection<T>[] = []

  for (let i = 0; i < rows.length; i++) {
    if (emitted.has(i)) continue
    const itemPath = topLevelArrayItemPath(rows[i]!.path)
    if (!itemPath) {
      emitted.add(i)
      sections.push({ kind: 'ungrouped', item: rows[i]!, index: i })
      continue
    }

    const arrayPath = arrayPathFromItemPath(itemPath)
    const itemGroups = new Map<string, OverrideArrayItemGroup<T>>()
    const itemOrder: string[] = []

    for (let j = 0; j < rows.length; j++) {
      const otherItemPath = topLevelArrayItemPath(rows[j]!.path)
      if (!otherItemPath) continue
      if (arrayPathFromItemPath(otherItemPath) !== arrayPath) continue
      emitted.add(j)
      let group = itemGroups.get(otherItemPath)
      if (!group) {
        group = {
          arrayItemPath: otherItemPath,
          indexLabel: `[${arrayItemIndex(otherItemPath)}]`,
          items: [],
        }
        itemGroups.set(otherItemPath, group)
        itemOrder.push(otherItemPath)
      }
      group.items.push({ item: rows[j]!, index: j })
    }

    itemOrder.sort((a, b) => {
      const delta = Number(arrayItemIndex(a)) - Number(arrayItemIndex(b))
      if (Number.isNaN(delta)) return a.localeCompare(b)
      return delta
    })

    sections.push({
      kind: 'array',
      arrayPath,
      collapseKey: arrayCollapseKey(arrayPath),
      label: arrayPathLabel(arrayPath),
      itemGroups: itemOrder.map((key) => itemGroups.get(key)!),
    })
  }

  return sections
}
