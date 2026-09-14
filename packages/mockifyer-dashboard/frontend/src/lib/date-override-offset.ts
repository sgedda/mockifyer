import type { MockResponseDateOverride } from '@/types'

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

/**
 * Combined serve-time offset. Days/hours/minutes/ms are added, not a display
 * breakdown of a single millisecond field (matches mockifyer-core).
 */
export function totalDateOverrideOffsetMs(
  override: Pick<MockResponseDateOverride, 'offsetMs' | 'offsetDays' | 'offsetHours' | 'offsetMinutes'>
): number {
  return (
    (override.offsetMs ?? 0) +
    (override.offsetDays ?? 0) * MS_PER_DAY +
    (override.offsetHours ?? 0) * MS_PER_HOUR +
    (override.offsetMinutes ?? 0) * MS_PER_MINUTE
  )
}

/**
 * True when leftover `offsetMs` looks like wall-clock remainder from splitting
 * `(recordedDate - Date.now())` into signed day/hour/minute parts.
 *
 * A stable “8 days from now” override is `{ offsetDays: 8 }` with other fields 0.
 */
export function looksLikeRecordedDateMinusNowSnapshot(
  override: Pick<MockResponseDateOverride, 'offsetMs' | 'offsetDays' | 'offsetHours' | 'offsetMinutes'>
): boolean {
  const leftoverMs = override.offsetMs ?? 0
  const hasCalendarOffset =
    (override.offsetDays ?? 0) !== 0 ||
    (override.offsetHours ?? 0) !== 0 ||
    (override.offsetMinutes ?? 0) !== 0
  return hasCalendarOffset && leftoverMs !== 0 && Math.abs(leftoverMs) < MS_PER_MINUTE
}

function pushDurationPart(parts: string[], value: number, suffix: string): void {
  if (value !== 0) {
    parts.push(`${value}${suffix}`)
  }
}

/** Human-readable combined offset, e.g. `now − 68d 10h 2m 38.941s`. */
export function formatEffectiveDateOverrideOffset(
  override: Pick<MockResponseDateOverride, 'offsetMs' | 'offsetDays' | 'offsetHours' | 'offsetMinutes'>
): string {
  const totalMs = totalDateOverrideOffsetMs(override)
  if (totalMs === 0) {
    return 'now'
  }
  const sign = totalMs < 0 ? '−' : '+'
  let remaining = Math.abs(totalMs)
  const days = Math.floor(remaining / MS_PER_DAY)
  remaining %= MS_PER_DAY
  const hours = Math.floor(remaining / MS_PER_HOUR)
  remaining %= MS_PER_HOUR
  const minutes = Math.floor(remaining / MS_PER_MINUTE)
  remaining %= MS_PER_MINUTE
  const seconds = Math.floor(remaining / 1000)
  const millis = remaining % 1000

  const parts: string[] = []
  pushDurationPart(parts, days, 'd')
  pushDurationPart(parts, hours, 'h')
  pushDurationPart(parts, minutes, 'm')
  if (seconds !== 0 || millis !== 0) {
    parts.push(millis === 0 ? `${seconds}s` : `${seconds}.${String(millis).padStart(3, '0')}s`)
  }
  if (parts.length === 0) {
    parts.push('0')
  }
  return `now ${sign} ${parts.join(' ')}`
}
