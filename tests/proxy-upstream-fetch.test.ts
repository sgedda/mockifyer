/**
 * Dashboard upstream must never call global `fetch` — when the host process
 * patches fetch via useGlobalFetch, that would re-enter /api/proxy.
 *
 * Mock the same resolved module dashboard source imports (`packages/.../node_modules/undici`).
 * A virtual `jest.mock('undici')` is ignored once the full suite has seen the real package.
 */
const undiciFetchMock = jest.fn();
const undiciMock = {
  Agent: jest.fn().mockImplementation(() => ({})),
  fetch: (...args: unknown[]) => undiciFetchMock(...args),
};

jest.mock('../packages/mockifyer-dashboard/node_modules/undici', () => undiciMock);

import { fetchProxyUpstream, fetchProxyUpstreamAndReadText } from '../packages/mockifyer-dashboard/src/utils/proxy-upstream-fetch';

describe('fetchProxyUpstream', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    undiciFetchMock.mockReset();
    undiciFetchMock.mockResolvedValue({ status: 204, ok: true } as Response);
    global.fetch = jest.fn(() => {
      throw new Error('global fetch must not be used for dashboard upstream');
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses undici fetch when tlsInsecure is false (avoids patched global fetch)', async () => {
    await fetchProxyUpstream('https://example.com/api', { method: 'GET' }, false);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(undiciFetchMock).toHaveBeenCalledTimes(1);
    const [, init] = undiciFetchMock.mock.calls[0] as [string, { dispatcher?: unknown }];
    expect(init.dispatcher).toBeUndefined();
  });

  it('uses undici fetch with insecure dispatcher when tlsInsecure is true', async () => {
    await fetchProxyUpstream('https://internal.example/api', { method: 'POST', body: '{}' }, true);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(undiciFetchMock).toHaveBeenCalledTimes(1);
    const [, init] = undiciFetchMock.mock.calls[0] as [string, { dispatcher?: unknown }];
    expect(init.dispatcher).toBeDefined();
  });

  it('drops empty headers before calling undici', async () => {
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    headers.set('authorization', '');
    await fetchProxyUpstream('http://127.0.0.1:3132/v-2/authenticate', { method: 'POST', headers }, false);

    const [, init] = undiciFetchMock.mock.calls[0] as [string, { headers?: Record<string, string> }];
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
  });

  it('rewrites Android emulator loopback host before connecting', async () => {
    await fetchProxyUpstream('http://10.0.2.2:4000/graphql', { method: 'POST' }, false);

    expect(undiciFetchMock).toHaveBeenCalledTimes(1);
    const [url] = undiciFetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://127.0.0.1:4000/graphql');
  });

  it('wraps undici fetch failed with method, url, and cause', async () => {
    const stale = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }),
    });
    undiciFetchMock.mockRejectedValueOnce(stale);

    await expect(
      fetchProxyUpstream('http://127.0.0.1:3132/v-2/authenticate', { method: 'POST' }, false)
    ).rejects.toThrow(
      'POST http://127.0.0.1:3132/v-2/authenticate: fetch failed: other side closed (UND_ERR_SOCKET)'
    );
  });
});

describe('fetchProxyUpstreamAndReadText', () => {
  it('wraps fetch failed thrown from response.text()', async () => {
    undiciFetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => {
        throw new TypeError('fetch failed');
      },
    });

    await expect(
      fetchProxyUpstreamAndReadText('http://localhost:3132/v-2/authenticate', { method: 'POST' }, false)
    ).rejects.toThrow('POST http://localhost:3132/v-2/authenticate: fetch failed');
  });
});
