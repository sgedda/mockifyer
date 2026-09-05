import {
  buildNetworkEvent,
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

  it('sanitizeUrlString removes URL-embedded credentials', () => {
    const redacted = sanitizeUrlString(
      'https://api-user:api-password@api.example.com/users?page=1'
    );
    expect(redacted).toBe('https://api.example.com/users?page=1');
    expect(redacted).not.toContain('api-user');
    expect(redacted).not.toContain('api-password');
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
});
