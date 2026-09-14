import {
  applyResponseDateOverridesToData,
  formatDatePreservingOriginal,
  parseIsoDateStringShape,
  parseResponseDataPath,
  totalOverrideOffsetMs,
  prepareMockResponseBody,
} from '@sgedda/mockifyer-core';
import type { MockData, MockResponseDateOverride } from '@sgedda/mockifyer-core';

describe('mock response date overrides', () => {
  const fixedNow = () => new Date('2025-06-15T12:00:00.000Z');

  it('parseResponseDataPath handles nested keys and array indices', () => {
    expect(parseResponseDataPath('a.b.0.c')).toEqual(['a', 'b', 0, 'c']);
    expect(parseResponseDataPath('expiresAt')).toEqual(['expiresAt']);
  });

  it('totalOverrideOffsetMs combines fields', () => {
    const o: MockResponseDateOverride = {
      path: 'x',
      offsetMs: 1000,
      offsetDays: 1,
      offsetHours: 2,
      offsetMinutes: 3,
    };
    expect(totalOverrideOffsetMs(o)).toBe(1000 + 86400000 + 7200000 + 180000);
  });

  it('rewrites ISO paths relative to getNow', () => {
    const data = { user: { trialEndsAt: '2020-01-01T00:00:00.000Z' } };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'user.trialEndsAt', offsetMs: 86400000 }],
      fixedNow
    );
    expect(out).not.toBe(data);
    expect((out as typeof data).user.trialEndsAt).toBe('2025-06-16T12:00:00.000Z');
  });

  it('rewrites array paths', () => {
    const data = { items: [{ createdAt: 'old' }] };
    const out = applyResponseDateOverridesToData(data, [{ path: 'items.0.createdAt' }], fixedNow);
    expect((out as typeof data).items[0].createdAt).toBe('2025-06-15T12:00:00.000Z');
  });

  it('infers unix-ms when original number is ms', () => {
    const data = { ts: 1700000000000 };
    const out = applyResponseDateOverridesToData(data, [{ path: 'ts', offsetMs: 1000 }], fixedNow);
    expect((out as typeof data).ts).toBe(fixedNow().getTime() + 1000);
  });

  it('infers unix-s when original number is seconds', () => {
    const data = { ts: 1700000000 };
    const out = applyResponseDateOverridesToData(data, [{ path: 'ts' }], fixedNow);
    expect((out as typeof data).ts).toBe(Math.floor(fixedNow().getTime() / 1000));
  });

  it('prepareMockResponseBody returns original when no overrides', () => {
    const mockData: MockData = {
      request: { method: 'GET', url: 'https://x', headers: {} },
      response: { status: 200, data: { a: 1 }, headers: {} },
      timestamp: 't',
    };
    expect(prepareMockResponseBody(mockData, fixedNow)).toBe(mockData.response.data);
  });

  it('prepareMockResponseBody returns cloned data when overrides set', () => {
    const mockData: MockData = {
      request: { method: 'GET', url: 'https://x', headers: {} },
      response: { status: 200, data: { until: 'x' }, headers: {} },
      timestamp: 't',
      responseDateOverrides: [{ path: 'until' }],
    };
    const body = prepareMockResponseBody(mockData, fixedNow) as { until: string };
    expect(body.until).toBe('2025-06-15T12:00:00.000Z');
    expect(mockData.response.data.until).toBe('x');
  });

  it('applies overrides to JSON string body', () => {
    const raw = JSON.stringify({ x: 'y' });
    const out = applyResponseDateOverridesToData(
      raw,
      [{ path: 'x' }],
      fixedNow
    ) as string;
    expect(JSON.parse(out).x).toBe('2025-06-15T12:00:00.000Z');
  });

  // Regression: legacy mocks with `base: 'response'` could anchor at the recorded
  // (often stale or fixed) date and produce drifted dates long after the recording
  // was made. Since core 1.8.20 we always anchor at `getNow()` so output is stable.
  it('treats deprecated `base: "response"` identically to `base: "now"`', () => {
    const data = { expiresAt: '2026-03-01T15:42:00.000Z' };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'expiresAt', base: 'response', offsetDays: 30 }],
      fixedNow
    );
    expect((out as typeof data).expiresAt).toBe('2025-07-15T12:00:00.000Z');
  });

  it('ignores stale recorded value with no offset (`base: "response"` ⇒ now)', () => {
    const data = { issuedAt: '2026-03-01T15:42:00.000Z' };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'issuedAt', base: 'response' }],
      fixedNow
    );
    expect((out as typeof data).issuedAt).toBe('2025-06-15T12:00:00.000Z');
  });

  it('preserves naive, zoned, date-only, and UTC string shapes from bookings payloads', () => {
    const data = {
      startDate: '2026-09-11T07:00:00',
      arrivalIsoZoned: '2026-09-11T12:05:00+03:00',
      pickupDate: '2026-10-15',
      arrivalUtc: '2026-09-11T09:05:00Z',
    };
    const out = applyResponseDateOverridesToData(
      data,
      [
        { path: 'startDate' },
        { path: 'arrivalIsoZoned' },
        { path: 'pickupDate' },
        { path: 'arrivalUtc' },
      ],
      fixedNow
    ) as typeof data;

    expect(out.startDate).toBe('2025-06-15T12:00:00');
    expect(out.arrivalIsoZoned).toBe('2025-06-15T15:00:00+03:00');
    expect(out.pickupDate).toBe('2025-06-15');
    expect(out.arrivalUtc).toBe('2025-06-15T12:00:00Z');
  });

  it('preserves original ISO shape even when format is explicitly iso', () => {
    const data = { departureTime: '2026-09-11T07:00:00' };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'departureTime', format: 'iso', offsetDays: 1 }],
      fixedNow
    ) as typeof data;
    expect(out.departureTime).toBe('2025-06-16T12:00:00');
  });

  it('lets explicit unix-ms win over a string original', () => {
    const data = { pickupDate: '2026-10-15' };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'pickupDate', format: 'unix-ms' }],
      fixedNow
    ) as unknown as { pickupDate: number };
    expect(out.pickupDate).toBe(fixedNow().getTime());
  });

  it('formats negative offsets and date-boundary zoned times', () => {
    const data = {
      west: '2026-09-11T07:00:00-05:00',
      east: '2026-09-11T12:05:00.123+03:00',
    };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'west' }, { path: 'east' }],
      () => new Date('2025-06-15T01:00:00.000Z')
    ) as typeof data;
    expect(out.west).toBe('2025-06-14T20:00:00-05:00');
    expect(out.east).toBe('2025-06-15T04:00:00.000+03:00');
  });

  it('formatDatePreservingOriginal matches parseable ISO-like originals', () => {
    const instant = new Date('2025-06-15T12:00:00.000Z');
    expect(formatDatePreservingOriginal(instant, '2026-10-15')).toBe('2025-06-15');
    expect(formatDatePreservingOriginal(instant, '2026-09-11T07:00:00')).toBe(
      '2025-06-15T12:00:00'
    );
    expect(formatDatePreservingOriginal(instant, '2026-09-11 07:00:00')).toBe(
      '2025-06-15 12:00:00'
    );
    expect(formatDatePreservingOriginal(instant, '2026-09-11T09:05:00.000Z')).toBe(
      '2025-06-15T12:00:00.000Z'
    );
    expect(formatDatePreservingOriginal(instant, 'not-a-date')).toBeNull();
    expect(parseIsoDateStringShape('2026-09-11T12:05:00+03:00')?.kind).toBe('datetime');
  });
});
