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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof btoa === 'function') {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  if (isNodeRuntime()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Buffer: BufferCtor } = require('buffer') as {
        Buffer: { from: (value: ArrayBuffer | Uint8Array) => { toString: (enc: string) => string } };
      };
      return BufferCtor.from(buffer).toString('base64');
    } catch {
      // Fall through to the explicit error below.
    }
  }

  throw new Error('Base64 encoding is not available in this runtime');
}

function rawBodyFromArrayBuffer(
  buffer: ArrayBuffer,
  contentType: string
): ProxySerializedBody {
  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType,
    data: arrayBufferToBase64(buffer),
  };
}

function serializeArrayBufferBody(
  body: unknown,
  headers?: Record<string, string>
): ProxySerializedBody | undefined {
  const contentType = headerContentType(headers) || 'application/octet-stream';

  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
    return rawBodyFromArrayBuffer(body, contentType);
  }

  if (
    typeof ArrayBuffer !== 'undefined' &&
    typeof ArrayBuffer.isView === 'function' &&
    ArrayBuffer.isView(body) &&
    body.buffer instanceof ArrayBuffer
  ) {
    return rawBodyFromArrayBuffer(
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      contentType
    );
  }

  return undefined;
}

async function serializeBlobBody(
  body: unknown,
  headers?: Record<string, string>
): Promise<ProxySerializedBody | undefined> {
  if (typeof Blob === 'undefined' || !(body instanceof Blob)) {
    return undefined;
  }

  return rawBodyFromArrayBuffer(
    await body.arrayBuffer(),
    headerContentType(headers) || body.type || 'application/octet-stream'
  );
}

async function nativeFormDataToSerialized(body: FormData): Promise<ProxySerializedBody> {
  const params = new URLSearchParams();
  const entries = (body as FormData & {
    entries?: () => IterableIterator<[string, string | Blob]>;
  }).entries?.();

  if (!entries) {
    throw new Error('FormData.entries() is not available in this runtime');
  }

  const entryList = Array.from(entries);
  const hasBinaryPart = entryList.some(([, value]) => typeof value !== 'string');

  if (hasBinaryPart) {
    if (typeof Request === 'undefined') {
      throw new Error('Multipart FormData serialization is not available in this runtime');
    }
    const request = new Request('http://mockifyer.local/', {
      method: 'POST',
      body,
    });
    return rawBodyFromArrayBuffer(
      await request.arrayBuffer(),
      request.headers.get('content-type') || 'multipart/form-data'
    );
  }

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

  const arrayBufferBody = serializeArrayBufferBody(body, headers);
  if (arrayBufferBody) {
    return arrayBufferBody;
  }

  const blobBody = await serializeBlobBody(body, headers);
  if (blobBody) {
    return blobBody;
  }

  const nodeBufferBody = serializeNodeBufferBody(body, headers);
  if (nodeBufferBody) {
    return nodeBufferBody;
  }

  // Plain objects (GraphQL JSON, REST JSON) are passed through unchanged.
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
