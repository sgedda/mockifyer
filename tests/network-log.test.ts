import {
  buildNetworkEvent,
  redactHeaders,
  sanitizeQueryString,
  sanitizeNetworkEvent,
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

  it('sanitizeNetworkEvent strips body previews by default', () => {
    const event = buildNetworkEvent({
      scenario: 'default',
      transport: 'proxy',
      method: 'GET',
      url: 'https://api.example.com/users?token=secret',
      source: 'upstream',
      requestBodyPreview: '{"x":1}',
      responseBodyPreview: '{"y":2}',
    });
    expect(event.requestBodyPreview).toBeUndefined();
    expect(event.responseBodyPreview).toBeUndefined();
    expect(decodeURIComponent(event.query ?? '')).toContain('[REDACTED]');
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

  it('sanitizeNetworkEvent redacts sensitive JSON body fields when captureBodies is on', () => {
    const event = sanitizeNetworkEvent(
      {
        id: '1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'proxy',
        method: 'POST',
        url: 'https://api.example.com/login',
        source: 'upstream',
        requestBodyPreview: JSON.stringify({
          username: 'alice',
          password: 'super-secret',
          nested: { access_token: 'token-123' },
        }),
        responseBodyPreview: JSON.stringify({ refreshToken: 'refresh-123', ok: true }),
      },
      { captureBodies: true, maxEventBytes: 4096 }
    );

    expect(event.requestBodyPreview).toContain('"username":"alice"');
    expect(event.requestBodyPreview).not.toContain('super-secret');
    expect(event.requestBodyPreview).not.toContain('token-123');
    expect(event.requestBodyPreview).toContain('[REDACTED]');
    expect(event.responseBodyPreview).not.toContain('refresh-123');
  });

  it('sanitizeNetworkEvent redacts sensitive raw body previews when JSON is truncated', () => {
    const event = sanitizeNetworkEvent(
      {
        id: '1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'proxy',
        method: 'POST',
        url: 'https://api.example.com/token',
        source: 'upstream',
        requestBodyPreview: '{"refreshToken":"super-secret","next":',
        responseBodyPreview: 'access_token=token-123&expires_in=3600',
      },
      { captureBodies: true, maxEventBytes: 4096 }
    );

    expect(event.requestBodyPreview).not.toContain('super-secret');
    expect(event.responseBodyPreview).not.toContain('token-123');
    expect(decodeURIComponent(event.responseBodyPreview ?? '')).toContain('[REDACTED]');
  });
});
