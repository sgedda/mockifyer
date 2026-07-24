import {
  applyResponseFieldOverridesToData,
  copyArrayItemInResponseData,
  isResponseDataJsonContainer,
  prepareMockResponseBody,
  setResponseDataValueAtPath,
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

  it('applyResponseFieldOverridesToData soft no-ops for non-JSON-container roots', () => {
    const plain = 'not-json';
    expect(applyResponseFieldOverridesToData(plain, [{ path: 'x', value: 1 }])).toBe(plain);
    expect(applyResponseFieldOverridesToData(42, [{ path: 'x', value: 1 }])).toBe(42);
    expect(applyResponseFieldOverridesToData(null, [{ path: 'x', value: 1 }])).toBe(null);
  });

  it('setResponseDataValueAtPath writes into objects and rejects non-containers', () => {
    const data = { user: { name: 'a' } };
    const out = setResponseDataValueAtPath(data, 'user.pool', { $pool: { id: 'p1' } }) as typeof data & {
      user: { name: string; pool: { $pool: { id: string } } };
    };
    expect(out.user.pool).toEqual({ $pool: { id: 'p1' } });
    expect(data.user).toEqual({ name: 'a' });

    expect(() => setResponseDataValueAtPath('plain text', 'x', 1)).toThrow(
      /must be a JSON object or array/
    );
    expect(() => setResponseDataValueAtPath({ a: 1 }, '  ', 1)).toThrow(/path is required/);
  });

  it('isResponseDataJsonContainer recognizes objects and JSON strings', () => {
    expect(isResponseDataJsonContainer({ a: 1 })).toBe(true);
    expect(isResponseDataJsonContainer('{"a":1}')).toBe(true);
    expect(isResponseDataJsonContainer('plain')).toBe(false);
    expect(isResponseDataJsonContainer(null)).toBe(false);
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
