import {
  countOverridesAtOrUnderPath,
  isRecordArray,
  relatedChildEntries,
  summarizeOverrideArrayItem,
} from '@/lib/override-related-data';
import { fieldOverrideRowFromStored } from '@/lib/field-overrides';

const bookingsBody = {
  bookings: [
    {
      bookingNumber: '1632974',
      startDate: '2026-08-14T16:15:00',
      endDate: '2026-08-24T07:20:00',
    },
    {
      bookingNumber: '9990001',
      startDate: '2026-09-01T10:00:00',
    },
  ],
};

describe('relatedChildEntries', () => {
  it('lists array items with dotted paths and identity-friendly filter', () => {
    const { entries, total } = relatedChildEntries(bookingsBody.bookings, 'bookings', '1632974');
    expect(total).toBe(2);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe('bookings.0');
    expect(summarizeOverrideArrayItem(entries[0]?.value)).toContain('1632974');
  });

  it('filters object keys', () => {
    const { entries } = relatedChildEntries(bookingsBody.bookings[0], 'bookings.0', 'start');
    expect(entries.map((entry) => entry.key)).toEqual(['startDate']);
  });
});

describe('isRecordArray', () => {
  it('is true for arrays of objects and false for primitive lists', () => {
    expect(isRecordArray(bookingsBody.bookings)).toBe(true);
    expect(isRecordArray(['a', 'b'])).toBe(false);
  });
});

describe('countOverridesAtOrUnderPath', () => {
  it('counts the item path and nested field overlays', () => {
    const paths = ['bookings.0', 'bookings.0.startDate', 'bookings.1.endDate'];
    expect(countOverridesAtOrUnderPath(paths, 'bookings.0')).toBe(2);
    expect(countOverridesAtOrUnderPath(paths, 'bookings.1')).toBe(1);
  });
});

describe('fieldOverrideRowFromStored', () => {
  it('prefills replace with stored JSON and remove with no value', () => {
    const replace = fieldOverrideRowFromStored('bookings.0', bookingsBody.bookings[0], 'replace');
    expect(replace.mode).toBe('replace');
    expect(JSON.parse(replace.valueText)).toEqual(bookingsBody.bookings[0]);

    const remove = fieldOverrideRowFromStored('bookings.0', bookingsBody.bookings[0], 'remove');
    expect(remove).toEqual({ path: 'bookings.0', mode: 'remove', valueText: '' });
  });
});
