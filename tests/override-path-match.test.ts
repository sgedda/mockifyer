import { isUnmatchedOverridePath } from '@/lib/override-related-data';

describe('isUnmatchedOverridePath', () => {
  const body = {
    bookings: [{ status: 'OPEN', checkIn: null }],
    count: 0,
  };

  it('is false for empty path so new rows are not marked red', () => {
    expect(isUnmatchedOverridePath(body, '')).toBe(false);
    expect(isUnmatchedOverridePath(body, '   ')).toBe(false);
  });

  it('is false when the path exists, including null and zero values', () => {
    expect(isUnmatchedOverridePath(body, 'bookings.0.status')).toBe(false);
    expect(isUnmatchedOverridePath(body, 'bookings.0.checkIn')).toBe(false);
    expect(isUnmatchedOverridePath(body, 'count')).toBe(false);
  });

  it('is true when the path is missing from the stored body', () => {
    expect(isUnmatchedOverridePath(body, 'bookings.0.missing')).toBe(true);
    expect(isUnmatchedOverridePath(body, 'nope')).toBe(true);
    expect(isUnmatchedOverridePath(null, 'bookings.0.status')).toBe(true);
  });

  it('parses JSON-string bodies the same way serve-time overlays do', () => {
    const encoded = JSON.stringify(body);
    expect(isUnmatchedOverridePath(encoded, 'bookings.0.status')).toBe(false);
    expect(isUnmatchedOverridePath(encoded, 'bookings.0.checkIn')).toBe(false);
    expect(isUnmatchedOverridePath(encoded, 'bookings.0.missing')).toBe(true);
  });

  it('leaves a non-JSON string body unmatched for dotted paths', () => {
    expect(isUnmatchedOverridePath('not-json', 'bookings.0.status')).toBe(true);
  });
});
