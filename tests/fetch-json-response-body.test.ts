import { FetchHTTPClient } from '../packages/mockifyer-fetch/src/clients/fetch-client';

function clientWithFetch(fetchImpl: typeof fetch): FetchHTTPClient {
  const client = new FetchHTTPClient();
  (client as unknown as { _originalFetch: typeof fetch })._originalFetch = fetchImpl;
  return client;
}

describe('FetchHTTPClient JSON media types', () => {
  it('parses +json bodies into objects', async () => {
    const client = clientWithFetch(
      jest.fn(async () =>
        new Response(JSON.stringify({ items: [1] }), {
          status: 200,
          headers: { 'content-type': 'application/vnd.api+json' },
        })
      ) as unknown as typeof fetch
    );

    const response = await client.request({
      url: 'https://api.example.com/items',
      method: 'GET',
    });

    expect(response.data).toEqual({ items: [1] });
  });

  it('parses application/problem+json error bodies', async () => {
    const client = clientWithFetch(
      jest.fn(async () =>
        new Response(JSON.stringify({ detail: 'nope' }), {
          status: 422,
          headers: { 'content-type': 'application/problem+json; charset=utf-8' },
        })
      ) as unknown as typeof fetch
    );

    const response = await client.request({
      url: 'https://api.example.com/items',
      method: 'GET',
    });

    expect(response.status).toBe(422);
    expect(response.data).toEqual({ detail: 'nope' });
  });

  it('leaves non-JSON bodies as text', async () => {
    const raw = '{"items":[1]}';
    const client = clientWithFetch(
      jest.fn(async () =>
        new Response(raw, {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      ) as unknown as typeof fetch
    );

    const response = await client.request({
      url: 'https://api.example.com/items',
      method: 'GET',
    });

    expect(response.data).toBe(raw);
  });
});
