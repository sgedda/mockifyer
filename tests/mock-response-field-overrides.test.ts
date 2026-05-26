import {
  applyResponseFieldOverridesToData,
  copyArrayItemInResponseData,
  prepareMockResponseBody,
  validateResponseFieldOverrides,
} from '@sgedda/mockifyer-core';
import type { MockData } from '@sgedda/mockifyer-core';

describe('mock response field overrides', () => {
  it('validateResponseFieldOverrides accepts valid entries', () => {
    expect(validateResponseFieldOverrides([{ path: 'status', value: 'CONFIRMED' }])).toBeNull();
    expect(validateResponseFieldOverrides(null)).toBeNull();
  });

  it('validateResponseFieldOverrides rejects invalid entries', () => {
    expect(validateResponseFieldOverrides({})).toContain('array');
    expect(validateResponseFieldOverrides([{ path: '' }])).toContain('path');
  });

  it('applyResponseFieldOverridesToData overlays without mutating stored body', () => {
    const data = { bookings: [{ status: 'PENDING', id: '1' }] };
    const out = applyResponseFieldOverridesToData(data, [
      { path: 'bookings.0.status', value: 'CONFIRMED' },
    ]) as typeof data;

    expect(out.bookings[0].status).toBe('CONFIRMED');
    expect(data.bookings[0].status).toBe('PENDING');
  });

  it('copyArrayItemInResponseData clones item with overrides', () => {
    const data = {
      bookings: [{ id: 'a', status: 'PENDING', checkInOpensAt: '2026-06-01T08:00:00Z' }],
    };

    const result = copyArrayItemInResponseData(data, {
      arrayPath: 'bookings',
      fromIndex: 0,
      itemOverrides: { status: 'CONFIRMED', checkInOpensAt: '2026-05-20T08:00:00Z' },
      insertAt: 'append',
    });

    const updated = result.data as typeof data;
    expect(result.arrayLength).toBe(2);
    expect(result.newItemIndex).toBe(1);
    expect(updated.bookings[0].status).toBe('PENDING');
    expect(updated.bookings[1].status).toBe('CONFIRMED');
    expect(updated.bookings[1].id).toBe('a');
    expect(data.bookings.length).toBe(1);
  });

  it('prepareMockResponseBody applies field overrides before date overrides', () => {
    const fixedNow = () => new Date('2025-06-15T12:00:00.000Z');
    const mockData: MockData = {
      request: { method: 'GET', url: 'https://x', headers: {} },
      response: {
        status: 200,
        data: { bookings: [{ status: 'PENDING', opensAt: '2020-01-01T00:00:00.000Z' }] },
        headers: {},
      },
      timestamp: 't',
      responseFieldOverrides: [{ path: 'bookings.0.status', value: 'CONFIRMED' }],
      responseDateOverrides: [{ path: 'bookings.0.opensAt' }],
    };

    const body = prepareMockResponseBody(mockData, fixedNow) as {
      bookings: Array<{ status: string; opensAt: string }>;
    };

    expect(body.bookings[0].status).toBe('CONFIRMED');
    expect(body.bookings[0].opensAt).toBe('2025-06-15T12:00:00.000Z');
    expect((mockData.response.data as typeof body).bookings[0].status).toBe('PENDING');
  });
});
