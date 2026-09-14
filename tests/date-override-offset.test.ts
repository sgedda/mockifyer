import {
  formatEffectiveDateOverrideOffset,
  looksLikeRecordedDateMinusNowSnapshot,
  totalDateOverrideOffsetMs,
} from '@/lib/date-override-offset'

describe('date override offset display', () => {
  it('adds days, hours, minutes, and leftover ms (not a breakdown of offsetMs)', () => {
    expect(
      totalDateOverrideOffsetMs({
        offsetMs: 1000,
        offsetDays: 1,
        offsetHours: 2,
        offsetMinutes: 3,
      })
    ).toBe(1000 + 86400000 + 7200000 + 180000)
  })

  it('formats a stable 8-day offset as now + 8d', () => {
    expect(formatEffectiveDateOverrideOffset({ offsetDays: 8 })).toBe('now + 8d')
    expect(looksLikeRecordedDateMinusNowSnapshot({ offsetDays: 8 })).toBe(false)
  })

  it('detects a recordedDate-minus-now snapshot like the bookings editor screenshot', () => {
    const startDate = {
      offsetMs: -38941,
      offsetDays: -68,
      offsetHours: -10,
      offsetMinutes: -2,
    }
    expect(looksLikeRecordedDateMinusNowSnapshot(startDate)).toBe(true)
    expect(formatEffectiveDateOverrideOffset(startDate)).toBe('now − 68d 10h 2m 38.941s')
  })

  it('does not flag leftover-only millisecond tweaks without calendar fields', () => {
    expect(looksLikeRecordedDateMinusNowSnapshot({ offsetMs: -38941 })).toBe(false)
  })
})
