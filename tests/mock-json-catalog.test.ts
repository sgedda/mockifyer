import {
  compactMockDataForCatalog,
  parseCatalogSidecarEntry,
  parseMockJsonForCatalog,
  serializeCatalogSidecarEntry,
  stripMockResponsePayload,
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

  it('round-trips through the sidecar JSON shape', () => {
    const mockData = compactMockDataForCatalog({
      request: { method: 'GET', url: 'https://api.example.com/ok', headers: {}, queryParams: {} },
      response: { status: 200, data: { ok: true }, headers: {} },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const raw = serializeCatalogSidecarEntry({ mockData, rawByteLength: 42 });
    expect(parseCatalogSidecarEntry(raw)).toEqual({ mockData, rawByteLength: 42 });
  });
});
