import {
  buildProxyUpstreamBodyInit,
  normalizeProxyBodyForRequestKey,
  serializeProxyRequestBody,
  type ProxySerializedBody,
} from '@sgedda/mockifyer-core';

describe('proxy request body serialization', () => {
  it('serializes string-only native FormData to urlencoded proxy body', async () => {
    const formData = new FormData();
    formData.append('client_id', 'test-client');
    formData.append('client_secret', 'secret');
    formData.append('resource', 'https://example.com');
    formData.append('grant_type', 'client_credentials');

    const serialized = (await serializeProxyRequestBody(formData)) as ProxySerializedBody;

    expect(serialized.__mockifyerProxyBody).toBe(true);
    expect(serialized.kind).toBe('urlencoded');
    expect(serialized.contentType).toBe('application/x-www-form-urlencoded');
    expect(serialized.data).toContain('grant_type=client_credentials');
    expect(serialized.data).toContain('client_id=test-client');
    expect(serialized.data).toContain('client_secret=secret');
    expect(serialized.data).toContain('resource=');
  });

  it('serializes native FormData with Blob parts as raw multipart data', async () => {
    const formData = new FormData();
    formData.append('description', 'avatar');
    formData.append('file', new Blob(['file-bytes'], { type: 'text/plain' }), 'avatar.txt');

    const serialized = (await serializeProxyRequestBody(formData)) as ProxySerializedBody;

    expect(serialized.__mockifyerProxyBody).toBe(true);
    expect(serialized.kind).toBe('raw');
    expect(serialized.contentType).toContain('multipart/form-data; boundary=');

    const multipartBody = Buffer.from(serialized.data, 'base64').toString('utf8');
    expect(multipartBody).toContain('name="description"');
    expect(multipartBody).toContain('avatar');
    expect(multipartBody).toContain('name="file"; filename="avatar.txt"');
    expect(multipartBody).toContain('Content-Type: text/plain');
    expect(multipartBody).toContain('file-bytes');
  });

  it('serializes URLSearchParams to urlencoded proxy body', async () => {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'abc',
    });

    const serialized = (await serializeProxyRequestBody(params)) as ProxySerializedBody;

    expect(serialized.kind).toBe('urlencoded');
    expect(serialized.data).toBe('grant_type=client_credentials&client_id=abc');
  });

  it('serializes Buffer bodies as raw bytes before plain-object handling', async () => {
    const buffer = Buffer.from([0, 1, 2, 253, 254, 255]);

    const serialized = (await serializeProxyRequestBody(buffer, {
      'content-type': 'application/octet-stream',
    })) as ProxySerializedBody;

    expect(serialized.kind).toBe('raw');
    expect(serialized.contentType).toBe('application/octet-stream');
    expect(serialized.data).toBe(buffer.toString('base64'));
  });

  it('serializes ArrayBuffer views as raw bytes', async () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);

    const serialized = (await serializeProxyRequestBody(bytes, {
      'content-type': 'image/png',
    })) as ProxySerializedBody;

    expect(serialized.kind).toBe('raw');
    expect(serialized.contentType).toBe('image/png');
    expect(Buffer.from(serialized.data, 'base64')).toEqual(Buffer.from(bytes));
  });

  it('serializes plain objects when content-type is urlencoded', async () => {
    const serialized = (await serializeProxyRequestBody(
      {
        grant_type: 'client_credentials',
        client_id: 'abc',
      },
      { 'content-type': 'application/x-www-form-urlencoded' }
    )) as ProxySerializedBody;

    expect(serialized.kind).toBe('urlencoded');
    expect(serialized.data).toBe('grant_type=client_credentials&client_id=abc');
  });

  it('passes through GraphQL JSON bodies when Buffer is unavailable (React Native)', async () => {
    const gqlBody = {
      query: 'query Query { systemAlert { title body isActive } }',
      variables: {},
    };
    const originalBuffer = (globalThis as { Buffer?: typeof Buffer }).Buffer;
    try {
      delete (globalThis as { Buffer?: typeof Buffer }).Buffer;
      const serialized = await serializeProxyRequestBody(gqlBody, {
        'content-type': 'application/json',
      });
      expect(serialized).toBe(gqlBody);
    } finally {
      if (originalBuffer !== undefined) {
        (globalThis as { Buffer?: typeof Buffer }).Buffer = originalBuffer;
      }
    }
  });

  it('passes through GraphQL when globalThis.Buffer getter throws (Hermes)', async () => {
    const gqlBody = {
      query: 'query Query { myAccountDeferredBookings { id } }',
      variables: {},
    };
    const g = globalThis as { Buffer?: unknown };
    const original = Object.getOwnPropertyDescriptor(g, 'Buffer');
    try {
      Object.defineProperty(g, 'Buffer', {
        configurable: true,
        get() {
          throw new ReferenceError("Property 'Buffer' doesn't exist");
        },
      });
      const serialized = await serializeProxyRequestBody(gqlBody, {
        'content-type': 'application/json',
      });
      expect(serialized).toBe(gqlBody);
    } finally {
      if (original) {
        Object.defineProperty(g, 'Buffer', original);
      } else {
        delete g.Buffer;
      }
    }
  });

  it('rebuilds upstream fetch body from serialized urlencoded payload', () => {
    const serialized: ProxySerializedBody = {
      __mockifyerProxyBody: true,
      kind: 'urlencoded',
      contentType: 'application/x-www-form-urlencoded',
      data: 'grant_type=client_credentials&client_id=abc',
    };

    const upstream = buildProxyUpstreamBodyInit(serialized, {}, 'POST');

    expect(upstream.body).toBe('grant_type=client_credentials&client_id=abc');
    expect(upstream.headers['content-type']).toBe('application/x-www-form-urlencoded');
  });

  it('rebuilds upstream fetch body from serialized raw payload', () => {
    const rawBody = Buffer.from([1, 2, 3, 4]);
    const serialized: ProxySerializedBody = {
      __mockifyerProxyBody: true,
      kind: 'raw',
      contentType: 'application/octet-stream',
      data: rawBody.toString('base64'),
    };

    const upstream = buildProxyUpstreamBodyInit(serialized, {}, 'POST');

    expect(upstream.body).toEqual(rawBody);
    expect(upstream.headers['content-type']).toBe('application/octet-stream');
  });

  it('normalizes serialized body for request-key generation', () => {
    const serialized: ProxySerializedBody = {
      __mockifyerProxyBody: true,
      kind: 'urlencoded',
      contentType: 'application/x-www-form-urlencoded',
      data: 'grant_type=client_credentials&client_id=abc',
    };

    expect(normalizeProxyBodyForRequestKey(serialized)).toBe(
      'grant_type=client_credentials&client_id=abc'
    );
  });
});
