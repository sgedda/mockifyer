import { FetchHTTPClient } from '@sgedda/mockifyer-fetch/clients/fetch-client';

describe('FetchHTTPClient proxy bypass', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses plain HTTP instead of the dashboard proxy when Mockifyer is bypassed', async () => {
    const fetchMock = jest.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 202,
        statusText: 'Accepted',
        headers: { 'content-type': 'application/json' },
      });
    });
    global.fetch = fetchMock as typeof fetch;

    const client = new FetchHTTPClient({
      proxy: {
        baseUrl: 'http://dashboard.example/mockifyer',
        recordOnMiss: true,
      },
      clientId: 'lane-a',
    });
    (client as any)._originalFetch = fetchMock;

    const response = await client.request({
      method: 'GET',
      url: 'https://api.example.com/widgets',
      __mockifyer_bypass: true,
    } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/widgets',
      expect.objectContaining({ method: 'GET' })
    );
    expect(response).toMatchObject({
      data: { ok: true },
      status: 202,
      statusText: 'Accepted',
    });
  });
});
