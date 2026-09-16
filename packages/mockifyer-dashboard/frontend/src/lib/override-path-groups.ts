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
  /** Nested array sections and leaf override rows under this index. */
  children: OverrideEditorSection<T>[]
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
 * Next array-item path after `prefix` (`data.bookings.0.accommodations.0.date`
 * after `data.bookings.0` → `data.bookings.0.accommodations.0`).
 */
export function nextArrayItemAfterPrefix(path: string, prefix = ''): string | null {
  const segments = parsePathSegments(path.trim())
  const prefixLen = prefix ? parsePathSegments(prefix).length : 0
  for (let i = prefixLen; i < segments.length; i++) {
    if (INDEX_SEGMENT.test(segments[i]!)) {
      return segments.slice(0, i + 1).join('.')
    }
  }
  return null
}

/**
 * Prefix through the first numeric path segment (`data.bookings.0.date` → `data.bookings.0`).
 */
export function topLevelArrayItemPath(path: string): string | null {
  return nextArrayItemAfterPrefix(path)
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

export function countOverrideSectionRows<T>(section: OverrideEditorSection<T>): number {
  if (section.kind === 'ungrouped') return 1
  return section.itemGroups.reduce((sum, group) => sum + countOverrideItemRows(group), 0)
}

export function countOverrideItemRows<T>(group: OverrideArrayItemGroup<T>): number {
  return group.children.reduce((sum, child) => sum + countOverrideSectionRows(child), 0)
}

/**
 * Extract all original row indices from a section (recursively for array sections).
 * Used to create stable React keys based on row identity.
 */
export function getSectionRowIndices<T>(section: OverrideEditorSection<T>): number[] {
  if (section.kind === 'ungrouped') return [section.index]
  const indices: number[] = []
  for (const group of section.itemGroups) {
    for (const child of group.children) {
      indices.push(...getSectionRowIndices(child))
    }
  }
  return indices
}

function sortItemPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const delta = Number(arrayItemIndex(a)) - Number(arrayItemIndex(b))
    if (Number.isNaN(delta)) return a.localeCompare(b)
    return delta
  })
}

/**
 * Group override rows by each array in the path (bookings, then accommodations, …).
 * Items of the same array are collected together, then split per index.
 * Paths with no further array index stay as leaves, in first-seen order.
 */
export function groupOverridesByTopLevelArray<T extends { path: string }>(
  rows: T[]
): OverrideEditorSection<T>[] {
  return groupIndexedRows(
    rows.map((item, index) => ({ item, index })),
    ''
  )
}

function groupIndexedRows<T extends { path: string }>(
  rows: IndexedOverrideRow<T>[],
  prefix: string
): OverrideEditorSection<T>[] {
  const emitted = new Set<number>()
  const sections: OverrideEditorSection<T>[] = []

  for (const row of rows) {
    if (emitted.has(row.index)) continue
    const itemPath = nextArrayItemAfterPrefix(row.item.path, prefix)
    if (!itemPath) {
      emitted.add(row.index)
      sections.push({ kind: 'ungrouped', item: row.item, index: row.index })
      continue
    }

    const arrayPath = arrayPathFromItemPath(itemPath)
    const rowsByItem = new Map<string, IndexedOverrideRow<T>[]>()
    const itemOrder: string[] = []

    for (const other of rows) {
      const otherItemPath = nextArrayItemAfterPrefix(other.item.path, prefix)
      if (!otherItemPath) continue
      if (arrayPathFromItemPath(otherItemPath) !== arrayPath) continue
      emitted.add(other.index)
      let list = rowsByItem.get(otherItemPath)
      if (!list) {
        list = []
        rowsByItem.set(otherItemPath, list)
        itemOrder.push(otherItemPath)
      }
      list.push(other)
    }

    sections.push({
      kind: 'array',
      arrayPath,
      collapseKey: arrayCollapseKey(arrayPath),
      label: arrayPathLabel(arrayPath),
      itemGroups: sortItemPaths(itemOrder).map((key) => ({
        arrayItemPath: key,
        indexLabel: `[${arrayItemIndex(key)}]`,
        children: groupIndexedRows(rowsByItem.get(key)!, key),
      })),
    })
  }

  return sections
}
