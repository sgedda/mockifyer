import { REDACTED_SECRET_PLACEHOLDER } from '@sgedda/mockifyer-core';
import { fetchUpstreamResponse } from '../packages/mockifyer-dashboard/src/utils/capture-upstream-response';
import {
  RedactedRequestHeadersError,
  requestHeadersIncludeRedactedSecrets,
  toPersistedRequestHeaders,
} from '../packages/mockifyer-dashboard/src/utils/proxy-recording-privacy';

describe('dashboard proxy recording privacy', () => {
  it('redacts sensitive request headers before storing proxy-recorded mocks', () => {
    const headers = toPersistedRequestHeaders({
      Authorization: 'Bearer live-token',
      'x-api-key': 'api-key-secret',
      Cookie: 'session=secret',
      'Content-Type': 'application/json',
      Accept: undefined,
    });

    expect(headers.Authorization).toBe(REDACTED_SECRET_PLACEHOLDER);
    expect(headers['x-api-key']).toBe(REDACTED_SECRET_PLACEHOLDER);
    expect(headers.Cookie).toBe(REDACTED_SECRET_PLACEHOLDER);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers).not.toHaveProperty('Accept');
    expect(requestHeadersIncludeRedactedSecrets(headers)).toBe(true);
  });

  it('does not treat ordinary recorded headers as redacted secrets', () => {
    expect(
      requestHeadersIncludeRedactedSecrets({
        Authorization: 'Bearer live-token',
        Accept: 'application/json',
      })
    ).toBe(false);
    expect(requestHeadersIncludeRedactedSecrets(undefined)).toBe(false);
  });
});

describe('refresh-from-live with redacted proxy headers', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('refuses the upstream call so a 401 cannot replace the stored response', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      fetchUpstreamResponse({
        method: 'GET',
        url: 'https://api.example.com/profile',
        headers: {
          Authorization: REDACTED_SECRET_PLACEHOLDER,
          Accept: 'application/json',
        },
      })
    ).rejects.toBeInstanceOf(RedactedRequestHeadersError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still calls upstream when the stored request has real credentials', async () => {
    const fetchSpy = jest.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await fetchUpstreamResponse({
      method: 'GET',
      url: 'https://api.example.com/profile',
      headers: { Authorization: 'Bearer live-token', Accept: 'application/json' },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1];
    const sent = new Headers(init?.headers);
    expect(sent.get('authorization')).toBe('Bearer live-token');
    expect(result.response.status).toBe(200);
    expect(result.response.data).toEqual({ ok: true });
  });
});
