import {
  buildProxyUpstreamBodyInit,
  isOmittedProxyUpstreamRequestHeader,
  omitProxyUpstreamRequestHeaders,
  serializeProxyRequestBody,
  type ProxySerializedBody,
} from '@sgedda/mockifyer-core';

describe('omitProxyUpstreamRequestHeaders', () => {
  it('drops content-length, host, and transfer-encoding so undici can size the rebuilt body', () => {
    const sanitized = omitProxyUpstreamRequestHeaders({
      Host: 'api.example.com',
      'Content-Type': 'multipart/form-data; boundary=abc',
      'Content-Length': '4096',
      'Transfer-Encoding': 'chunked',
      Authorization: 'Bearer secret',
      Connection: 'keep-alive',
    });

    expect(sanitized['Content-Type']).toBe('multipart/form-data; boundary=abc');
    expect(sanitized.Authorization).toBe('Bearer secret');
    expect(sanitized['Content-Length']).toBeUndefined();
    expect(sanitized['content-length']).toBeUndefined();
    expect(sanitized.Host).toBeUndefined();
    expect(sanitized.Connection).toBeUndefined();
    expect(sanitized['Transfer-Encoding']).toBeUndefined();
  });

  it('omits hop-by-hop names case-insensitively', () => {
    expect(isOmittedProxyUpstreamRequestHeader('Content-Length')).toBe(true);
    expect(isOmittedProxyUpstreamRequestHeader('content-length')).toBe(true);
    expect(isOmittedProxyUpstreamRequestHeader('authorization')).toBe(false);
  });
});

describe('buildProxyUpstreamBodyInit header sanitization', () => {
  it('does not copy a stale content-length onto a rewritten urlencoded body', async () => {
    const formData = new FormData();
    formData.append('grant_type', 'client_credentials');
    formData.append('client_id', 'app');
    const serialized = (await serializeProxyRequestBody(formData)) as ProxySerializedBody;

    const upstream = buildProxyUpstreamBodyInit(
      serialized,
      {
        'content-type': 'multipart/form-data; boundary=----formdata',
        'content-length': '4096',
        authorization: 'Bearer x',
      },
      'POST'
    );

    expect(upstream.body).toBe(serialized.data);
    expect(upstream.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(upstream.headers.authorization).toBe('Bearer x');
    expect(upstream.headers['content-length']).toBeUndefined();
  });
});
