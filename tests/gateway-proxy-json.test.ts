import {
  proxyJson,
  readUpstreamBody,
} from '../example-projects/wanderweird-travel/services/gateway-api/src/proxy-json';

describe('gateway proxyJson', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses a JSON upstream body', async () => {
    const body = await readUpstreamBody(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(body).toEqual({ ok: true });
  });

  it('returns non-JSON text instead of throwing after the body was read', async () => {
    const body = await readUpstreamBody(
      new Response('<html>bad gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      })
    );
    expect(body).toBe('<html>bad gateway</html>');
  });

  it('returns null for an empty body', async () => {
    const body = await readUpstreamBody(new Response('', { status: 200 }));
    expect(body).toBeNull();
  });

  it('answers 502 when the upstream connection fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:4206');
    }) as typeof fetch;

    const result = await proxyJson('http://127.0.0.1:4206/graphql', { method: 'POST' });

    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      error: 'Upstream unavailable',
      upstream: 'http://127.0.0.1:4206/graphql',
    });
  });

  it('returns the upstream status and text when the body is not JSON', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response('nope', {
          status: 500,
          headers: { 'content-type': 'text/plain' },
        })
    ) as typeof fetch;

    const result = await proxyJson('http://127.0.0.1:4201/login', { method: 'POST' });

    expect(result.status).toBe(500);
    expect(result.body).toBe('nope');
  });
});
