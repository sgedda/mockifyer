import {
  buildNetworkEvent,
  emitNetworkLogEvent,
  redactHeaders,
  sanitizeQueryString,
  sanitizeNetworkEvent,
  sanitizeUrlString,
  toNetworkLogBodyPreview,
} from '@sgedda/mockifyer-core';

describe('network-log', () => {
  it('redactHeaders masks sensitive names', () => {
    const out = redactHeaders({
      Authorization: 'secret',
      'Content-Type': 'application/json',
      Cookie: 'a=b',
    });
    expect(out?.Authorization).toBe('[REDACTED]');
    expect(out?.['Content-Type']).toBe('application/json');
    expect(out?.Cookie).toBe('[REDACTED]');
  });

  it('sanitizeQueryString redacts token-like params', () => {
    const redacted = sanitizeQueryString('?api_key=abc&page=1') ?? '';
    expect(decodeURIComponent(redacted)).toContain('[REDACTED]');
    expect(sanitizeQueryString('?page=1')).toContain('page=1');
  });

  it('sanitizeUrlString redacts token-like params in the full URL', () => {
    const redacted = sanitizeUrlString(
      'https://api.example.com/users?access_token=secret&page=1#details'
    );
    expect(redacted).toContain('https://api.example.com/users?');
    expect(decodeURIComponent(redacted)).toContain('access_token=[REDACTED]');
    expect(redacted).toContain('page=1');
    expect(redacted).toContain('#details');
    expect(redacted).not.toContain('secret');
  });

  it('sanitizeUrlString redacts query params in relative URLs', () => {
    const redacted = sanitizeUrlString('/users?token=secret&page=1#details');
    expect(decodeURIComponent(redacted)).toContain('token=[REDACTED]');
    expect(redacted).toContain('page=1');
    expect(redacted).toContain('#details');
    expect(redacted).not.toContain('secret');
  });

  it('sanitizeNetworkEvent strips body previews by default', () => {
    const event = buildNetworkEvent({
      scenario: 'default',
      transport: 'proxy',
      method: 'GET',
      url: 'https://api.example.com/users?token=secret',
      query: '?access_token=also-secret',
      source: 'upstream',
      requestBodyPreview: '{"x":1}',
      responseBodyPreview: '{"y":2}',
    });
    expect(event.requestBodyPreview).toBeUndefined();
    expect(event.responseBodyPreview).toBeUndefined();
    expect(decodeURIComponent(event.query ?? '')).toContain('[REDACTED]');
    expect(event.query).not.toContain('also-secret');
    expect(decodeURIComponent(event.url)).toContain('token=[REDACTED]');
    expect(event.url).not.toContain('secret');
  });

  it('toNetworkLogBodyPreview stringifies objects', () => {
    expect(toNetworkLogBodyPreview({ ok: true })).toContain('ok');
  });

  it('sanitizeNetworkEvent keeps truncated bodies when captureBodies is on', () => {
    const event = sanitizeNetworkEvent(
      {
        id: '1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'fetch',
        method: 'POST',
        url: 'https://api.example.com/x',
        source: 'mock-hit',
        requestBodyPreview: '{"ok":true}',
      },
      { captureBodies: true, maxEventBytes: 4096 }
    );
    expect(event.requestBodyPreview).toContain('ok');
  });

  it('posts network events with the unpatched fetch when global fetch is patched', async () => {
    const originalFetch = jest.fn(async () => ({ ok: true } as Response));
    const patchedFetch = jest.fn(async () => {
      throw new Error('patched fetch must not handle dashboard network-events POSTs');
    });
    const previousFetch = globalThis.fetch;
    const previousOriginal = (globalThis as { __mockifyer_original_fetch?: typeof fetch })
      .__mockifyer_original_fetch;

    (globalThis as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch =
      originalFetch as unknown as typeof fetch;
    globalThis.fetch = patchedFetch as unknown as typeof fetch;

    try {
      await emitNetworkLogEvent({
        dashboardBaseUrl: 'http://localhost:3002',
        event: {
          scenario: 'default',
          transport: 'fetch',
          method: 'GET',
          url: 'https://api.example.com/weather',
          source: 'upstream',
        },
      });

      expect(patchedFetch).not.toHaveBeenCalled();
      expect(originalFetch).toHaveBeenCalledTimes(1);
      const [postedUrl, init] = originalFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(postedUrl).toBe('http://localhost:3002/api/network-events');
      expect(init.method).toBe('POST');
    } finally {
      globalThis.fetch = previousFetch;
      if (previousOriginal) {
        (globalThis as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch =
          previousOriginal;
      } else {
        delete (globalThis as { __mockifyer_original_fetch?: typeof fetch })
          .__mockifyer_original_fetch;
      }
    }
  });
});
