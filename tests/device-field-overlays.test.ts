import {
  applyDeviceFieldOverlaysToData,
  clearDeviceFieldOverrides,
  exportDeviceFieldOverlays,
  getDeviceFieldOverrides,
  hasDeviceFieldOverlays,
  importDeviceFieldOverlays,
  prepareMockResponseBody,
  requestHashFromRequestKey,
  setDeviceFieldOverrides,
  setDeviceFieldOverridesForRequest,
} from '@sgedda/mockifyer-core';
import type { MockData } from '@sgedda/mockifyer-core';

describe('device field overlays', () => {
  afterEach(() => {
    clearDeviceFieldOverrides();
  });

  it('stores overlays by request key hash without mutating inputs', () => {
    const requestKey = 'GET:https://api.example.com/bookings';
    const hash = setDeviceFieldOverrides(requestKey, [
      { path: 'bookings.0.status', value: 'CANCELLED' },
    ]);

    expect(hash).toBe(requestHashFromRequestKey(requestKey));
    expect(hasDeviceFieldOverlays()).toBe(true);
    expect(getDeviceFieldOverrides(hash)).toEqual([
      { path: 'bookings.0.status', value: 'CANCELLED' },
    ]);
    expect(getDeviceFieldOverrides(requestKey)).toEqual([
      { path: 'bookings.0.status', value: 'CANCELLED' },
    ]);
  });

  it('applies overlays on top of persisted mock field overrides', () => {
    const requestKey = 'GET:https://api.example.com/bookings';
    setDeviceFieldOverrides(requestKey, [{ path: 'bookings.0.status', value: 'CANCELLED' }]);

    const mockData: MockData = {
      request: { method: 'GET', url: 'https://api.example.com/bookings', headers: {} },
      response: {
        status: 200,
        data: { bookings: [{ status: 'PENDING', id: '1' }] },
        headers: {},
      },
      timestamp: 't',
      responseFieldOverrides: [{ path: 'bookings.0.status', value: 'CONFIRMED' }],
    };

    const body = prepareMockResponseBody(mockData, () => new Date('2025-06-15T12:00:00.000Z'), {
      deviceOverlayLookup: { requestKey },
    }) as { bookings: Array<{ status: string }> };

    expect(body.bookings[0].status).toBe('CANCELLED');
    expect((mockData.response.data as typeof body).bookings[0].status).toBe('PENDING');
  });

  it('applyDeviceFieldOverlaysToData no-ops when empty', () => {
    const data = { a: 1 };
    expect(applyDeviceFieldOverlaysToData(data, null)).toBe(data);
    expect(applyDeviceFieldOverlaysToData(data, { requestKey: 'GET:https://x' })).toBe(data);
  });

  it('export/import round-trips for sharing between devices', () => {
    setDeviceFieldOverridesForRequest(
      { method: 'GET', url: 'https://api.example.com/x', headers: {} },
      [{ path: 'ok', value: true }]
    );
    const exported = exportDeviceFieldOverlays();
    expect(exported.version).toBe(1);
    expect(Object.keys(exported.byHash)).toHaveLength(1);

    clearDeviceFieldOverrides();
    expect(hasDeviceFieldOverlays()).toBe(false);

    importDeviceFieldOverlays(exported);
    expect(hasDeviceFieldOverlays()).toBe(true);
    const hash = Object.keys(exported.byHash)[0]!;
    expect(getDeviceFieldOverrides(hash)).toEqual([{ path: 'ok', value: true }]);
  });

  it('clearDeviceFieldOverrides removes one or all', () => {
    const h1 = setDeviceFieldOverrides('GET:https://a', [{ path: 'x', value: 1 }]);
    setDeviceFieldOverrides('GET:https://b', [{ path: 'y', value: 2 }]);
    clearDeviceFieldOverrides(h1);
    expect(getDeviceFieldOverrides(h1)).toBeUndefined();
    expect(hasDeviceFieldOverlays()).toBe(true);
    clearDeviceFieldOverrides();
    expect(hasDeviceFieldOverlays()).toBe(false);
  });
});
