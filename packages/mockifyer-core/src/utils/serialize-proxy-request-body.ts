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

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const first = bytes[i];
    const second = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const third = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const combined = (first << 16) | (second << 8) | third;

    output += BASE64_ALPHABET[(combined >> 18) & 63];
    output += BASE64_ALPHABET[(combined >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(combined >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[combined & 63] : '=';
  }
  return output;
}

function rawBytesToSerialized(
  bytes: Uint8Array,
  headers?: Record<string, string>,
  fallbackContentType?: string
): ProxySerializedBody {
  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType: headerContentType(headers) || fallbackContentType || 'application/octet-stream',
    data: bytesToBase64(bytes),
  };
}

function isBlobBody(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isArrayBufferBody(value: unknown): value is ArrayBuffer {
  return typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer;
}

function isArrayBufferViewBody(value: unknown): value is ArrayBufferView {
  return typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value);
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

async function nativeFormDataToMultipartSerialized(
  body: FormData
): Promise<ProxySerializedBody | undefined> {
  if (typeof Request === 'undefined') {
    return undefined;
  }

  try {
    const request = new Request('http://mockifyer.local/', {
      method: 'POST',
      body,
    });
    const arrayBuffer = await request.arrayBuffer();
    return rawBytesToSerialized(
      new Uint8Array(arrayBuffer),
      undefined,
      request.headers.get('content-type') || 'multipart/form-data'
    );
  } catch {
    return undefined;
  }
}

async function nativeFormDataToSerialized(body: FormData): Promise<ProxySerializedBody> {
  const params = new URLSearchParams();
  const entries = (body as FormData & {
    entries?: () => IterableIterator<[string, string | Blob]>;
  }).entries?.();

  if (!entries) {
    const multipart = await nativeFormDataToMultipartSerialized(body);
    if (multipart) {
      return multipart;
    }
    throw new Error('FormData.entries() is not available in this runtime');
  }

  let hasBinaryPart = false;
  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      params.append(key, value);
      continue;
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      hasBinaryPart = true;
      continue;
    }
    params.append(key, String(value));
  }

  if (hasBinaryPart) {
    const multipart = await nativeFormDataToMultipartSerialized(body);
    if (multipart) {
      return multipart;
    }
    throw new Error('Multipart FormData serialization is not available in this runtime');
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

  const nodeBufferBody = serializeNodeBufferBody(body, headers);
  if (nodeBufferBody) {
    return nodeBufferBody;
  }

  if (isBlobBody(body)) {
    return rawBytesToSerialized(
      new Uint8Array(await body.arrayBuffer()),
      headers,
      body.type || 'application/octet-stream'
    );
  }

  if (isArrayBufferBody(body)) {
    return rawBytesToSerialized(new Uint8Array(body), headers);
  }

  if (isArrayBufferViewBody(body)) {
    return rawBytesToSerialized(
      new Uint8Array(body.buffer as ArrayBuffer, body.byteOffset, body.byteLength),
      headers
    );
  }

  // Plain objects (GraphQL JSON, REST JSON).
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
