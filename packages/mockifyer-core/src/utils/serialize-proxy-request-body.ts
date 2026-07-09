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

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer;
}

function isArrayBufferView(
  value: unknown
): value is { buffer: ArrayBuffer; byteOffset: number; byteLength: number } {
  return typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value);
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

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const first = bytes[i];
    const second = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const third = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (first << 16) | (second << 8) | third;

    output += BASE64_ALPHABET[(triplet >> 18) & 63];
    output += BASE64_ALPHABET[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? BASE64_ALPHABET[triplet & 63] : '=';
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

function binaryViewToBase64(view: { buffer: ArrayBuffer; byteOffset: number; byteLength: number }): string {
  return bytesToBase64(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
}

async function nativeFormDataToRawSerialized(body: FormData): Promise<ProxySerializedBody | undefined> {
  if (typeof Request === 'undefined') {
    return undefined;
  }

  try {
    const request = new Request('https://mockifyer.local/__proxy_body__', {
      method: 'POST',
      body,
    });
    const buffer = await request.arrayBuffer();
    return {
      __mockifyerProxyBody: true,
      kind: 'raw',
      contentType: request.headers.get('content-type') || 'multipart/form-data',
      data: arrayBufferToBase64(buffer),
    };
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
    const raw = await nativeFormDataToRawSerialized(body);
    if (raw) {
      return raw;
    }
    throw new Error('FormData serialization requires either entries() or Request.arrayBuffer()');
  }

  const entryList = Array.from(entries);
  const hasNonStringValue = entryList.some(([, value]) => typeof value !== 'string');

  if (hasNonStringValue) {
    const raw = await nativeFormDataToRawSerialized(body);
    if (raw) {
      return raw;
    }
    throw new Error('Multipart FormData serialization requires Request.arrayBuffer()');
  }

  for (const [key, value] of entryList) {
    if (typeof value === 'string') {
      params.append(key, value);
    }
  }

  return {
    __mockifyerProxyBody: true,
    kind: 'urlencoded',
    contentType: 'application/x-www-form-urlencoded',
    data: params.toString(),
  };
}

async function blobToSerialized(
  body: Blob,
  headers?: Record<string, string>
): Promise<ProxySerializedBody> {
  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType: headerContentType(headers) || body.type || 'application/octet-stream',
    data: arrayBufferToBase64(await body.arrayBuffer()),
  };
}

function binaryBodyToSerialized(
  body: ArrayBuffer | { buffer: ArrayBuffer; byteOffset: number; byteLength: number },
  headers?: Record<string, string>
): ProxySerializedBody {
  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType: headerContentType(headers) || 'application/octet-stream',
    data: isArrayBuffer(body) ? arrayBufferToBase64(body) : binaryViewToBase64(body),
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

  if (isBlob(body)) {
    return blobToSerialized(body, headers);
  }

  if (isNodeFormDataPackage(body)) {
    return nodeFormDataPackageToSerialized(body);
  }

  if (isArrayBuffer(body) || isArrayBufferView(body)) {
    return binaryBodyToSerialized(body, headers);
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
