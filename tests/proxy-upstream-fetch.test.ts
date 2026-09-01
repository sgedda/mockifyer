/**
 * Dashboard upstream must never call global `fetch` — when the host process
 * patches fetch via useGlobalFetch, that would re-enter /api/proxy.
 */
const undiciFetchMock = jest.fn();

jest.mock(
  'undici',
  () => ({
    Agent: jest.fn().mockImplementation(() => ({})),
    fetch: (...args: unknown[]) => undiciFetchMock(...args),
  }),
  { virtual: true }
);

import { fetchProxyUpstream } from '../packages/mockifyer-dashboard/src/utils/proxy-upstream-fetch';

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
    await fetchProxyUpstream('http://127.0.0.1:3132/v-2/authenticate', { method: 'GET' }, false);

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

  it('rewrites Android emulator loopback host before connecting', async () => {
    await fetchProxyUpstream('http://10.0.2.2:4000/graphql', { method: 'POST' }, false);

    expect(undiciFetchMock).toHaveBeenCalledTimes(1);
    const [url] = undiciFetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://127.0.0.1:4000/graphql');
  });
});
