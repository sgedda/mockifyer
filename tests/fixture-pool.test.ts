import {
  extractAllArrayItemsFromResponse,
  extractEntityDataFromResponse,
  matchPathPattern,
  pathnameFromUrl,
  validatePoolEntity,
  buildMockFromSlotAssignment,
  resolveMockForRequest,
  type PoolEntity,
  type EndpointSlot,
  type ScenarioManifest,
} from '@sgedda/mockifyer-core';

describe('fixture-pool path patterns', () => {
  it('matches single-segment wildcards', () => {
    expect(matchPathPattern('/users/abc/trips', '/users/*/trips')).toBe(true);
    expect(matchPathPattern('/users/abc/trips/1', '/users/*/trips')).toBe(false);
    expect(matchPathPattern('/users/me', '/users/me')).toBe(true);
  });

  it('extracts pathname from full URL', () => {
    expect(pathnameFromUrl('https://api.example.com/v1/users/me/trips?x=1')).toBe(
      '/v1/users/me/trips'
    );
  });
});

describe('fixture-pool extract', () => {
  const data = {
    trips: [
      { id: '1', origin: 'ARN' },
      { id: '2', origin: 'LHR' },
    ],
  };

  it('extracts a single path', () => {
    const result = extractEntityDataFromResponse(data, 'trips.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.data).toEqual({ id: '1', origin: 'ARN' });
    }
  });

  it('rejects null at jsonPath', () => {
    const result = extractEntityDataFromResponse({ trip: null }, 'trip');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/No value/);
    }
  });

  it('extracts all array items', () => {
    const result = extractAllArrayItemsFromResponse(data, 'trips');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result).toHaveLength(2);
      expect(result[1]!.jsonPath).toBe('trips.1');
    }
  });
});

describe('fixture-pool entity validation', () => {
  it('validates pool entity shape', () => {
    expect(validatePoolEntity({ id: 'x', entityType: 'trip', label: 'x', data: {} })).toBeNull();
    expect(validatePoolEntity({ id: 'bad id', entityType: 'trip', label: 'x', data: {} })).toMatch(
      /id/
    );
  });
});

/** Library helper retained for a possible future activation path; slots are deferred at runtime. */
describe('fixture-pool compose helper (deferred activation)', () => {
  const tripRome: PoolEntity = {
    id: 'trip-rome',
    entityType: 'trip',
    label: 'Rome',
    data: { id: '8821', origin: 'ARN', destination: 'FCO', status: 'CONFIRMED' },
  };
  const tripLondon: PoolEntity = {
    id: 'trip-london',
    entityType: 'trip',
    label: 'London',
    data: { id: '9900', origin: 'ARN', destination: 'LHR', status: 'CONFIRMED' },
  };
  const entities = new Map<string, PoolEntity>([
    [tripRome.id, tripRome],
    [tripLondon.id, tripLondon],
  ]);

  const composeAssignment: EndpointSlot['assignment'] = {
    kind: 'compose',
    wrap: { mode: 'object', arrayPath: 'trips' },
    items: [{ entityId: 'trip-rome' }, { entityId: 'trip-london' }],
    status: 200,
  };

  it('builds compose body from entities', () => {
    const built = buildMockFromSlotAssignment('slot-user-trips', composeAssignment, {
      getEntity: (id) => entities.get(id),
      getResponseItem: () => undefined,
      request: { method: 'GET', url: 'https://api.example.com/users/me/trips', headers: {} },
    });
    expect('error' in built).toBe(false);
    if (!('error' in built)) {
      expect(built.mockData.response.data).toEqual({
        trips: [tripRome.data, tripLondon.data],
      });
      expect(built.mockData.responseFieldOverrides).toBeUndefined();
      expect(built.mockData.responseDateOverrides).toBeUndefined();
    }
  });

  it('returns error when compose object wrap is missing arrayPath', () => {
    const built = buildMockFromSlotAssignment(
      'slot-user-trips',
      {
        kind: 'compose',
        wrap: { mode: 'object' },
        items: [{ entityId: 'trip-rome' }],
        status: 200,
      },
      {
        getEntity: (id) => entities.get(id),
        getResponseItem: () => undefined,
        request: { method: 'GET', url: 'https://api.example.com/users/me/trips', headers: {} },
      }
    );
    expect('error' in built).toBe(true);
    if ('error' in built) {
      expect(built.error).toMatch(/arrayPath/i);
    }
  });

  it('does not re-attach overlays after applying them on entity assignment', () => {
    const built = buildMockFromSlotAssignment(
      'slot-trip',
      { kind: 'entity', entityId: 'trip-rome', wrap: { mode: 'bare' }, status: 200 },
      {
        getEntity: (id) => entities.get(id),
        getResponseItem: () => undefined,
        request: { method: 'GET', url: 'https://api.example.com/trips/8821', headers: {} },
        slotOverrides: {
          responseFieldOverrides: [{ path: 'status', value: 'CANCELLED' }],
        },
      }
    );
    expect('error' in built).toBe(false);
    if (!('error' in built)) {
      expect((built.mockData.response.data as { status: string }).status).toBe('CANCELLED');
      expect(built.mockData.responseFieldOverrides).toBeUndefined();
    }
  });

  it('returns slot-error mock instead of falling through when build fails', () => {
    const manifest: ScenarioManifest = {
      formatVersion: 2,
      scenario: 'demo',
      updatedAt: '2026-07-22T00:00:00.000Z',
      slots: [
        {
          id: 'slot-trip',
          match: { kind: 'rest', method: 'GET', pathPattern: '/trips/8821' },
          assignment: { kind: 'entity', entityId: 'missing-trip', wrap: { mode: 'bare' } },
          enabled: true,
        },
      ],
    };
    const resolved = resolveMockForRequest(
      { method: 'GET', url: 'https://api.example.com/trips/8821', headers: {} },
      {
        scenario: 'demo',
        mockDataPath: './mock-data',
        manifest,
        getEntity: () => undefined,
        getResponseItem: () => undefined,
      }
    );
    expect(resolved?.filename).toBe('slot-error:slot-trip');
    expect(resolved?.mockData.response.status).toBe(500);
  });
});
