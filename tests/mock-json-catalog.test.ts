import {
  compactMockDataForCatalog,
  parseCatalogSidecarEntry,
  parseMockJsonForCatalog,
  serializeCatalogSidecarEntry,
  stripMockResponsePayload,
  applyReplayModeToRawMock,
  patchTopLevelBooleanFlags,
} from '../packages/mockifyer-dashboard/src/utils/mock-json-catalog';

describe('stripMockResponsePayload', () => {
  it('nulls response.data without touching request.data', () => {
    const raw = JSON.stringify({
      request: { method: 'POST', url: 'https://api.example.com/graphql', data: { query: 'query Q { a }' } },
      response: { status: 200, data: { huge: 'x'.repeat(1000) }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const stripped = JSON.parse(stripMockResponsePayload(raw)) as {
      request: { data: { query: string } };
      response: { status: number; data: unknown };
    };
    expect(stripped.request.data.query).toBe('query Q { a }');
    expect(stripped.response.status).toBe(200);
    expect(stripped.response.data).toBeNull();
  });

  it('parseMockJsonForCatalog keeps small bodies intact', () => {
    const raw = JSON.stringify({
      request: { method: 'GET', url: 'https://api.example.com/ok' },
      response: { status: 200, data: { ok: true }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const { mockData, rawByteLength } = parseMockJsonForCatalog(raw);
    expect(rawByteLength).toBe(Buffer.byteLength(raw));
    expect(mockData.response.data).toEqual({ ok: true });
  });

  it('parseMockJsonForCatalog strips large response.data', () => {
    const raw = JSON.stringify({
      request: { method: 'GET', url: 'https://api.example.com/bookings' },
      response: { status: 200, data: { bookings: 'y'.repeat(40_000) }, headers: { 'content-type': 'application/json' } },
      timestamp: '2026-01-01T00:00:00.000Z',
      alwaysUseRealApi: true,
    });
    const { mockData, rawByteLength } = parseMockJsonForCatalog(raw);
    expect(rawByteLength).toBeGreaterThan(24_000);
    expect(mockData.response.status).toBe(200);
    expect(mockData.response.data).toBeNull();
    expect(mockData.request.url).toBe('https://api.example.com/bookings');
    expect(mockData.alwaysUseRealApi).toBe(true);
  });
});

describe('compactMockDataForCatalog', () => {
  it('drops response bodies and request headers while keeping GraphQL request.data', () => {
    const compact = compactMockDataForCatalog({
      request: {
        method: 'POST',
        url: 'https://api.example.com/graphql',
        headers: { authorization: 'secret' },
        queryParams: {},
        data: { query: 'query Q { a }', variables: { id: 1 } },
      },
      response: { status: 201, data: { bookings: 'huge' }, headers: { 'content-type': 'application/json' } },
      timestamp: '2026-01-01T00:00:00.000Z',
      requestId: 'req-1',
      parentRequestId: 'parent-1',
      alwaysUseRealApi: true,
    });
    expect(compact.request.headers).toEqual({});
    expect(compact.request.data).toEqual({ query: 'query Q { a }', variables: { id: 1 } });
    expect(compact.response.data).toBeNull();
    expect(compact.response.status).toBe(201);
    expect(compact.requestId).toBe('req-1');
    expect(compact.alwaysUseRealApi).toBe(true);
  });

  it('keeps duration so slowest-leaf stats can rank Redis catalog entries', () => {
    const compact = compactMockDataForCatalog({
      request: { method: 'GET', url: 'https://api.example.com/slow', headers: {}, queryParams: {} },
      response: { status: 200, data: {}, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
      duration: 842,
    });
    expect(compact.duration).toBe(842);
  });

  it('round-trips through the sidecar JSON shape', () => {
    const mockData = compactMockDataForCatalog({
      request: { method: 'GET', url: 'https://api.example.com/ok', headers: {}, queryParams: {} },
      response: { status: 200, data: { ok: true }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const raw = serializeCatalogSidecarEntry({ mockData, rawByteLength: 42 });
    expect(parseCatalogSidecarEntry(raw)).toEqual({ mockData, rawByteLength: 42 });
    expect(parseCatalogSidecarEntry(JSON.stringify({ mockData, rawByteLength: 42 }))).toBeNull();
  });
});

describe('applyReplayModeToRawMock', () => {
  const graphqlMarker = `query Huge { field("${'x'.repeat(2000)}") }`;

  function prettyGraphqlLive(): string {
    return JSON.stringify(
      {
        request: {
          method: 'POST',
          url: 'https://api.example.com/graphql',
          headers: {},
          data: { query: graphqlMarker, variables: { id: 1 } },
        },
        response: { status: 200, data: { bookings: graphqlMarker }, headers: {} },
        timestamp: '2026-01-01T00:00:00.000Z',
        alwaysUseRealApi: true,
      },
      null,
      2
    );
  }

  it('adds refresh-next on a pending stub without rewriting the rest of the file', () => {
    const raw = JSON.stringify(
      {
        request: { method: 'GET', url: 'https://api.example.com/pending', headers: {} },
        response: { status: 0, data: null, headers: {} },
        timestamp: '2026-01-01T00:00:00.000Z',
        alwaysUseRealApi: true,
        responsePending: true,
      },
      null,
      2
    );
    const patched = applyReplayModeToRawMock(raw, 'stored');
    expect(patched?.changed).toBe(true);
    expect(patched?.outcome).toBe('refresh-next');
    const parsed = JSON.parse(patched!.raw) as {
      refreshOnNextRequest?: boolean;
      alwaysUseRealApi?: boolean;
      responsePending?: boolean;
    };
    expect(parsed.refreshOnNextRequest).toBe(true);
    expect(parsed.alwaysUseRealApi).toBeUndefined();
    expect(parsed.responsePending).toBeUndefined();
  });

  it('does not re-serialize GraphQL request/response bodies', () => {
    const raw = prettyGraphqlLive();
    const bookingsPayload = raw.slice(raw.indexOf('"bookings":'), raw.indexOf('}', raw.indexOf('"bookings":')));
    const patched = applyReplayModeToRawMock(raw, 'stored');
    expect(patched?.changed).toBe(true);
    expect(patched?.outcome).toBe('stored');
    expect(patched!.raw).toContain(bookingsPayload);
    const parsed = JSON.parse(patched!.raw) as { alwaysUseRealApi?: boolean; request: { data: { query: string } } };
    expect(parsed.alwaysUseRealApi).toBeUndefined();
    expect(parsed.request.data.query).toBe(graphqlMarker);
  });

  it('skips writes when flags already match', () => {
    const raw = JSON.stringify({
      request: { method: 'GET', url: 'https://api.example.com/ok' },
      response: { status: 200, data: { ok: true }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const patched = applyReplayModeToRawMock(raw, 'stored');
    expect(patched?.changed).toBe(false);
    expect(patched?.raw).toBe(raw);
  });

  it('inserts a flag into minified JSON', () => {
    const raw = '{"request":{"method":"GET","url":"https://api.example.com/ok"},"response":{"status":200,"data":{}},"timestamp":"t"}';
    const patched = patchTopLevelBooleanFlags(raw, {
      alwaysUseRealApi: true,
      refreshOnNextRequest: false,
      alwaysRefreshFromLive: false,
      responsePending: false,
    });
    expect(patched).toContain('"alwaysUseRealApi":true');
    expect(JSON.parse(patched!).alwaysUseRealApi).toBe(true);
    expect(JSON.parse(patched!).request.url).toBe('https://api.example.com/ok');
  });
});
