import {
  isProxySerializedBody,
  type ProxySerializedBody,
} from './proxy-request-body-types';

function headerContentType(headers?: Record<string, string>): string | undefined {
  if (!headers) return undefined;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-type' && value) {
      return value;
    }
  }
  return undefined;
}

function isNativeFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isUrlSearchParams(value: unknown): value is URLSearchParams {
  return typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams;
}

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

function isNodeFormDataPackage(
  value: unknown
): value is { getBuffer: () => { toString: (enc: string) => string }; getHeaders?: () => Record<string, string> } {
  return (
    isNodeRuntime() &&
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { getBuffer?: unknown }).getBuffer === 'function' &&
    typeof (value as { append?: unknown }).append === 'function' &&
    !isNativeFormData(value)
  );
}

function plainObjectToUrlEncoded(body: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  return params.toString();
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  if (isNodeRuntime()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Buffer: BufferCtor } = require('buffer') as { Buffer: typeof Buffer };
    return BufferCtor.from(bytes).toString('base64');
  }

  throw new Error('Base64 encoding is not available in this runtime');
}

function rawSerializedBody(
  bytes: Uint8Array,
  contentType: string
): ProxySerializedBody {
  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType,
    data: bytesToBase64(bytes),
  };
}

async function nativeFormDataToSerialized(body: FormData): Promise<ProxySerializedBody> {
  const entries = (body as FormData & {
    entries?: () => IterableIterator<[string, string | Blob]>;
  }).entries?.();

  if (!entries) {
    throw new Error('FormData.entries() is not available in this runtime');
  }

  const entryList = Array.from(entries);
  const hasBinaryEntry = entryList.some(([, value]) => typeof value !== 'string');

  if (hasBinaryEntry) {
    if (typeof Request !== 'function') {
      throw new Error('FormData file/blob serialization requires Request support in this runtime');
    }

    const request = new Request('http://mockifyer.local/__formdata__', {
      method: 'POST',
      body,
    });
    const bytes = new Uint8Array(await request.arrayBuffer());
    return rawSerializedBody(
      bytes,
      request.headers.get('content-type') || 'multipart/form-data'
    );
  }

  const params = new URLSearchParams();
  for (const [key, value] of entryList) {
    if (typeof value === 'string') {
      params.append(key, value);
      continue;
    }
    params.append(key, String(value));
  }

  return {
    __mockifyerProxyBody: true,
    kind: 'urlencoded',
    contentType: 'application/x-www-form-urlencoded',
    data: params.toString(),
  };
}

function nodeFormDataPackageToSerialized(body: {
  getBuffer: () => { toString: (enc: string) => string };
  getHeaders?: () => Record<string, string>;
}): ProxySerializedBody {
  const buffer = body.getBuffer();
  const contentType = body.getHeaders?.()['content-type'] || 'multipart/form-data';
  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType,
    data: buffer.toString('base64'),
  };
}

function serializeNodeBufferBody(
  body: unknown,
  headers?: Record<string, string>
): ProxySerializedBody | undefined {
  if (!isNodeRuntime()) {
    return undefined;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Buffer: BufferCtor } = require('buffer') as {
      Buffer: { isBuffer: (v: unknown) => boolean };
    };
    if (!BufferCtor?.isBuffer?.(body)) {
      return undefined;
    }
    return {
      __mockifyerProxyBody: true,
      kind: 'raw',
      contentType: headerContentType(headers) || 'application/octet-stream',
      data: (body as { toString: (enc: string) => string }).toString('base64'),
    };
  } catch {
    return undefined;
  }
}

async function serializeBlobBody(
  body: Blob,
  headers?: Record<string, string>
): Promise<ProxySerializedBody> {
  const bytes = new Uint8Array(await body.arrayBuffer());
  return rawSerializedBody(
    bytes,
    headerContentType(headers) || body.type || 'application/octet-stream'
  );
}

function serializeArrayBufferBody(
  body: unknown,
  headers?: Record<string, string>
): ProxySerializedBody | undefined {
  if (typeof ArrayBuffer === 'undefined') {
    return undefined;
  }

  if (body instanceof ArrayBuffer) {
    return rawSerializedBody(
      new Uint8Array(body),
      headerContentType(headers) || 'application/octet-stream'
    );
  }

  if (ArrayBuffer.isView(body)) {
    return rawSerializedBody(
      new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
      headerContentType(headers) || 'application/octet-stream'
    );
  }

  return undefined;
}

/**
 * Convert non-JSON request bodies (FormData, URLSearchParams, urlencoded objects) into a
 * JSON-safe envelope field before POSTing to mockifyer-dashboard `/api/proxy`.
 *
 * React Native / Hermes safe — never references the global `Buffer` binding.
 */
export async function serializeProxyRequestBody(
  body: unknown,
  headers?: Record<string, string>
): Promise<unknown> {
  if (body === undefined || body === null || isProxySerializedBody(body)) {
    return body;
  }

  if (typeof body === 'string' || typeof body === 'number' || typeof body === 'boolean') {
    return body;
  }

  if (isUrlSearchParams(body)) {
    return {
      __mockifyerProxyBody: true,
      kind: 'urlencoded',
      contentType: 'application/x-www-form-urlencoded',
      data: body.toString(),
    } satisfies ProxySerializedBody;
  }

  if (isNativeFormData(body)) {
    return nativeFormDataToSerialized(body);
  }

  if (isNodeFormDataPackage(body)) {
    return nodeFormDataPackageToSerialized(body);
  }

  const nodeBufferBody = serializeNodeBufferBody(body, headers);
  if (nodeBufferBody) {
    return nodeBufferBody;
  }

  const arrayBufferBody = serializeArrayBufferBody(body, headers);
  if (arrayBufferBody) {
    return arrayBufferBody;
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return serializeBlobBody(body, headers);
  }

  // Plain objects (GraphQL JSON, REST JSON) stay JSON-safe after binary types are handled.
  if (typeof body === 'object' && !Array.isArray(body)) {
    const contentType = headerContentType(headers);
    if (contentType?.toLowerCase().includes('application/x-www-form-urlencoded')) {
      return {
        __mockifyerProxyBody: true,
        kind: 'urlencoded',
        contentType: 'application/x-www-form-urlencoded',
        data: plainObjectToUrlEncoded(body as Record<string, unknown>),
      } satisfies ProxySerializedBody;
    }
    return body;
  }

  return body;
}
