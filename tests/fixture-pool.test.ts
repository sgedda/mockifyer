import {
  extractAllArrayItemsFromResponse,
  extractEntityDataFromResponse,
  matchPathPattern,
  pathnameFromUrl,
  validatePoolEntity,
  buildMockFromSlotAssignment,
  resolveMockForRequest,
  buildGraphQLBodyKey,
  generateRequestKey,
  normalizeGraphQLQuery,
  requestMatchesSlot,
  ensurePoolLayout,
  loadPoolIndex,
  savePoolIndex,
  withPoolIndexUpdate,
  acquirePoolIndexLock,
  releasePoolIndexLock,
  getPoolIndexLockPath,
  PoolIndexLockError,
  type FixturePoolFsAdapter,
  type FixturePoolWriteFileOptions,
  type PoolEntity,
  type EndpointSlot,
  type ScenarioManifest,
  type StoredRequest,
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

  it('parses string JSON response bodies before extract', () => {
    const result = extractEntityDataFromResponse(JSON.stringify(data), 'trips.0');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.data).toEqual({ id: '1', origin: 'ARN' });
    }
  });

  it('rejects null elements in batch extract', () => {
    const result = extractAllArrayItemsFromResponse({ trips: [{ id: '1' }, null] }, 'trips');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/null\/undefined/);
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

describe('fixture-pool GraphQL queryHash alignment', () => {
  const query = 'query GetUser($id: ID!) { user(id: $id) { name } }';
  const variables = { id: '42' };

  const graphqlRequest: StoredRequest = {
    method: 'POST',
    url: 'https://api.example.com/graphql',
    headers: { 'content-type': 'application/json' },
    queryParams: {},
    data: {
      operationName: 'GetUser',
      query,
      variables,
    },
  };

  it('matches normalized query string', () => {
    expect(
      requestMatchesSlot(graphqlRequest, {
        kind: 'graphql',
        queryHash: normalizeGraphQLQuery(query),
      })
    ).toBe(true);
  });

  it('matches buildGraphQLBodyKey from recording tooling', () => {
    const bodyKey = buildGraphQLBodyKey(query, variables);
    expect(bodyKey).toMatch(/^gql:/);
    expect(
      requestMatchesSlot(graphqlRequest, {
        kind: 'graphql',
        queryHash: bodyKey,
      })
    ).toBe(true);
  });

  it('matches |body: suffix pasted from generateRequestKey', () => {
    const requestKey = generateRequestKey(graphqlRequest);
    const bodySuffix = requestKey.includes('|body:')
      ? requestKey.slice(requestKey.indexOf('|body:'))
      : '';
    expect(bodySuffix.startsWith('|body:gql:')).toBe(true);
    expect(
      requestMatchesSlot(graphqlRequest, {
        kind: 'graphql',
        queryHash: bodySuffix,
      })
    ).toBe(true);
  });

  it('rejects a body key with different variables', () => {
    expect(
      requestMatchesSlot(graphqlRequest, {
        kind: 'graphql',
        queryHash: buildGraphQLBodyKey(query, { id: 'other' }),
      })
    ).toBe(false);
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

function createMemoryPoolFs(): FixturePoolFsAdapter & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    joinPath: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
    existsSync: (p) => files.has(p),
    readFileSync: (p) => {
      const value = files.get(p);
      if (value === undefined) {
        const err = new Error(`ENOENT: ${p}`) as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        throw err;
      }
      return value;
    },
    writeFileSync: (p, data, encodingOrOptions: 'utf8' | FixturePoolWriteFileOptions) => {
      const flag =
        typeof encodingOrOptions === 'object' ? encodingOrOptions.flag : undefined;
      if (flag === 'wx' && files.has(p)) {
        const err = new Error(`EEXIST: ${p}`) as NodeJS.ErrnoException;
        err.code = 'EEXIST';
        throw err;
      }
      files.set(p, data);
    },
    mkdirSync: () => undefined,
    unlinkSync: (p) => {
      files.delete(p);
    },
  };
}

function catalogEntry(id: string) {
  return {
    id,
    label: id,
    entityType: 'trip',
    storageRef: `pool/entities/${id}.json`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('fixture-pool index locking', () => {
  it('demonstrates lost catalog entries from unlocked concurrent RMW', () => {
    const fsAdapter = createMemoryPoolFs();
    const root = '/mock-data';
    ensurePoolLayout(root, fsAdapter);

    const snapshotA = loadPoolIndex(root, fsAdapter);
    const snapshotB = loadPoolIndex(root, fsAdapter);
    snapshotA.entities.push(catalogEntry('entity-a'));
    snapshotB.entities.push(catalogEntry('entity-b'));
    savePoolIndex(root, snapshotA, fsAdapter);
    savePoolIndex(root, snapshotB, fsAdapter);

    const ids = loadPoolIndex(root, fsAdapter).entities.map((e) => e.id);
    expect(ids).toEqual(['entity-b']);
  });

  it('preserves both catalog entries when writers use withPoolIndexUpdate', () => {
    const fsAdapter = createMemoryPoolFs();
    const root = '/mock-data';
    ensurePoolLayout(root, fsAdapter);

    withPoolIndexUpdate(root, fsAdapter, (index) => {
      index.entities.push(catalogEntry('entity-a'));
      index.updatedAt = '2026-01-01T00:00:01.000Z';
    });
    withPoolIndexUpdate(root, fsAdapter, (index) => {
      index.entities.push(catalogEntry('entity-b'));
      index.updatedAt = '2026-01-01T00:00:02.000Z';
    });

    const ids = loadPoolIndex(root, fsAdapter).entities.map((e) => e.id).sort();
    expect(ids).toEqual(['entity-a', 'entity-b']);
    expect(fsAdapter.existsSync(getPoolIndexLockPath(root, fsAdapter))).toBe(false);
  });

  it('reloads under the lock so a mid-flight unlocked snapshot cannot clobber later writes', () => {
    const fsAdapter = createMemoryPoolFs();
    const root = '/mock-data';
    ensurePoolLayout(root, fsAdapter);

    // Stale snapshot taken before another writer updates the index.
    const stale = loadPoolIndex(root, fsAdapter);
    withPoolIndexUpdate(root, fsAdapter, (index) => {
      index.entities.push(catalogEntry('entity-a'));
    });

    // Unlocked save of the stale snapshot would drop entity-a; locked update reloads first.
    stale.entities.push(catalogEntry('entity-b'));
    withPoolIndexUpdate(root, fsAdapter, (index) => {
      for (const entry of stale.entities) {
        if (!index.entities.some((e) => e.id === entry.id)) {
          index.entities.push(entry);
        }
      }
    });

    const ids = loadPoolIndex(root, fsAdapter).entities.map((e) => e.id).sort();
    expect(ids).toEqual(['entity-a', 'entity-b']);
  });

  it('times out when the lock file is held and not stale', () => {
    const fsAdapter = createMemoryPoolFs();
    const root = '/mock-data';
    ensurePoolLayout(root, fsAdapter);
    const lockPath = acquirePoolIndexLock(root, fsAdapter);

    expect(() =>
      acquirePoolIndexLock(root, fsAdapter, { timeoutMs: 40, retryMs: 10, staleMs: 60_000 })
    ).toThrow(PoolIndexLockError);

    releasePoolIndexLock(lockPath, fsAdapter);
    expect(() => acquirePoolIndexLock(root, fsAdapter, { timeoutMs: 40, retryMs: 10 })).not.toThrow();
    releasePoolIndexLock(getPoolIndexLockPath(root, fsAdapter), fsAdapter);
  });

  it('steals a stale lock file', () => {
    const fsAdapter = createMemoryPoolFs();
    const root = '/mock-data';
    ensurePoolLayout(root, fsAdapter);
    const lockPath = getPoolIndexLockPath(root, fsAdapter);
    fsAdapter.writeFileSync(
      lockPath,
      JSON.stringify({
        pid: 1,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      'utf8'
    );

    const acquired = acquirePoolIndexLock(root, fsAdapter, {
      timeoutMs: 200,
      retryMs: 10,
      staleMs: 1_000,
    });
    expect(acquired).toBe(lockPath);
    releasePoolIndexLock(lockPath, fsAdapter);
  });
});
