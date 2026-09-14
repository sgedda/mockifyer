import type { MockData } from '@sgedda/mockifyer-core';
import { applyFieldOverridesFromBody } from '../packages/mockifyer-dashboard/src/utils/mock-field-overrides-patch';

function baseMock(overrides: Partial<MockData> = {}): MockData {
  return {
    request: { url: 'https://example.test/bookings', method: 'GET', headers: {} },
    response: { status: 200, data: { bookings: [{ status: 'PENDING' }] }, headers: {} },
    timestamp: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('applyFieldOverridesFromBody', () => {
  it('writes field overlays onto the mock', () => {
    const mock = baseMock();
    const err = applyFieldOverridesFromBody(mock, {
      responseFieldOverrides: [{ path: 'bookings.0.status', value: 'CONFIRMED' }],
    });
    expect(err).toBeNull();
    expect(mock.responseFieldOverrides).toEqual([
      { path: 'bookings.0.status', value: 'CONFIRMED' },
    ]);
  });

  it('clears overlays when the body sends null or an empty array', () => {
    const mock = baseMock({
      responseFieldOverrides: [{ path: 'bookings.0.status', value: 'CONFIRMED' }],
    });
    expect(applyFieldOverridesFromBody(mock, { responseFieldOverrides: null })).toBeNull();
    expect(mock.responseFieldOverrides).toBeUndefined();

    mock.responseFieldOverrides = [{ path: 'status', value: 'OPEN' }];
    expect(applyFieldOverridesFromBody(mock, { responseFieldOverrides: [] })).toBeNull();
    expect(mock.responseFieldOverrides).toBeUndefined();
  });

  it('rejects invalid entries', () => {
    const mock = baseMock();
    expect(applyFieldOverridesFromBody(mock, { responseFieldOverrides: [{ path: '' }] })).toContain(
      'path'
    );
  });
});
