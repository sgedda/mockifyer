import type { MockResponseDateOverride } from '@/types'

/**
 * Serve-time date overlay preview.
 * Must stay aligned with mockifyer-core `mock-response-date-overrides.ts`
 * (`totalOverrideOffsetMs` + `formatDatePreservingOriginal` + format resolution).
 */
const MS_PER_MINUTE = 60 * 1000
const UNIX_MS_THRESHOLD = 1e11
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})([T ])(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|z|[+-]\d{2}:?\d{2})?$/
const OFFSET_PATTERN = /^([+-])(\d{2}):?(\d{2})$/

interface IsoDateTimeShape {
  kind: 'datetime'
  separator: 'T' | ' '
  hasSeconds: boolean
  fractionDigits: number
  zone: string
  offsetMinutes: number
}

type IsoDateShape = { kind: 'date-only' } | IsoDateTimeShape

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function parseOffsetMinutes(zone: string): number | null {
  if (zone === 'Z' || zone === 'z') return 0
  const match = zone.match(OFFSET_PATTERN)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3]))
}

function parseIsoDateStringShape(original: string): IsoDateShape | null {
  const text = original.trim()
  if (ISO_DATE_ONLY_PATTERN.test(text)) {
    return { kind: 'date-only' }
  }
  const match = text.match(ISO_DATETIME_PATTERN)
  if (!match) return null
  const zone = match[6] ?? ''
  const offsetMinutes = zone ? parseOffsetMinutes(zone) : 0
  if (offsetMinutes === null) return null
  return {
    kind: 'datetime',
    separator: match[2] as 'T' | ' ',
    hasSeconds: match[4] !== undefined,
    fractionDigits: match[5]?.length ?? 0,
    zone,
    offsetMinutes,
  }
}

function formatUtcWallClock(
  date: Date,
  hasSeconds: boolean,
  fractionDigits: number
): { ymd: string; hms: string } {
  const ymd = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
  let hms = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`
  if (hasSeconds) {
    hms += `:${pad2(date.getUTCSeconds())}`
    if (fractionDigits > 0) {
      const fraction = String(date.getUTCMilliseconds()).padStart(3, '0').slice(0, fractionDigits)
      hms += `.${fraction.padEnd(fractionDigits, '0')}`
    }
  }
  return { ymd, hms }
}

function formatDatePreservingOriginal(date: Date, original: string): string | null {
  const shape = parseIsoDateStringShape(original)
  if (!shape) return null
  if (shape.kind === 'date-only') {
    return formatUtcWallClock(date, false, 0).ymd
  }
  const wall =
    shape.zone && shape.zone !== 'Z' && shape.zone !== 'z'
      ? new Date(date.getTime() + shape.offsetMinutes * MS_PER_MINUTE)
      : date
  const { ymd, hms } = formatUtcWallClock(wall, shape.hasSeconds, shape.fractionDigits)
  return `${ymd}${shape.separator}${hms}${shape.zone}`
}

function resolveFormat(
  override: MockResponseDateOverride,
  original: unknown
): 'iso' | 'unix-ms' | 'unix-s' {
  if (override.format) return override.format
  if (typeof original === 'number' && Number.isFinite(original)) {
    return original > UNIX_MS_THRESHOLD ? 'unix-ms' : 'unix-s'
  }
  return 'iso'
}

function formatResolvedDate(
  date: Date,
  format: 'iso' | 'unix-ms' | 'unix-s',
  original: unknown
): string | number {
  switch (format) {
    case 'unix-ms':
      return date.getTime()
    case 'unix-s':
      return Math.floor(date.getTime() / 1000)
    case 'iso':
    default:
      if (typeof original === 'string') {
        return formatDatePreservingOriginal(date, original) ?? date.toISOString()
      }
      return date.toISOString()
  }
}

/** Total overlay offset in ms (same fields as mockifyer-core). */
export function totalDateOverrideOffsetMs(override: MockResponseDateOverride): number {
  let ms = override.offsetMs ?? 0
  if (override.offsetDays !== undefined) {
    ms += override.offsetDays * 24 * 60 * 60 * 1000
  }
  if (override.offsetHours !== undefined) {
    ms += override.offsetHours * 60 * 60 * 1000
  }
  if (override.offsetMinutes !== undefined) {
    ms += override.offsetMinutes * 60 * 1000
  }
  return ms
}

export function formatOffsetFromNowLabel(override: MockResponseDateOverride): string {
  const pieces: string[] = []
  const days = override.offsetDays ?? 0
  const hours = override.offsetHours ?? 0
  const minutes = override.offsetMinutes ?? 0
  const extraMs = override.offsetMs ?? 0
  if (days !== 0) pieces.push(`${days}d`)
  if (hours !== 0) pieces.push(`${hours}h`)
  if (minutes !== 0) pieces.push(`${minutes}m`)
  if (extraMs !== 0) pieces.push(`${extraMs}ms`)
  return pieces.length > 0 ? pieces.join(' ') : 'no offset'
}

export interface ServedDatePreview {
  served: string | number
  servedText: string
  instantIso: string
  offsetMs: number
  offsetLabel: string
  resolvedFormat: 'iso' | 'unix-ms' | 'unix-s'
}

/**
 * Value written at the override path at serve time: Mockifyer now + offset,
 * formatted like the stored original (naive ISO stays naive).
 */
export function previewServedDateOverride(
  override: MockResponseDateOverride,
  original: unknown,
  now: Date
): ServedDatePreview {
  const offsetMs = totalDateOverrideOffsetMs(override)
  const instant = new Date(now.getTime() + offsetMs)
  const resolvedFormat = resolveFormat(override, original)
  const served = formatResolvedDate(instant, resolvedFormat, original)
  return {
    served,
    servedText: String(served),
    instantIso: instant.toISOString(),
    offsetMs,
    offsetLabel: formatOffsetFromNowLabel(override),
    resolvedFormat,
  }
}
