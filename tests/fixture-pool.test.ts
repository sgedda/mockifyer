import {
  extractAllArrayItemsFromResponse,
  extractEntityDataFromResponse,
  matchPathPattern,
  pathnameFromUrl,
  validatePoolEntity,
  buildMockFromSlotAssignment,
  type PoolEntity,
  type EndpointSlot,
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
    }
  });
});
