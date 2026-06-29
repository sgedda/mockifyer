import {
  isProxySerializedBody,
  type ProxySerializedBody,
} from './proxy-request-body-types';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

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

function isBlobBody(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isArrayBufferBody(value: unknown): value is ArrayBuffer {
  return typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer;
}

function isArrayBufferViewBody(value: unknown): value is ArrayBufferView {
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

function encodeBase64Bytes(bytes: Uint8Array): string {
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const hasByte2 = i + 1 < bytes.length;
    const hasByte3 = i + 2 < bytes.length;
    const byte2 = hasByte2 ? bytes[i + 1] : 0;
    const byte3 = hasByte3 ? bytes[i + 2] : 0;

    output += BASE64_ALPHABET[byte1 >> 2];
    output += BASE64_ALPHABET[((byte1 & 0x03) << 4) | (byte2 >> 4)];
    output += hasByte2 ? BASE64_ALPHABET[((byte2 & 0x0f) << 2) | (byte3 >> 6)] : '=';
    output += hasByte3 ? BASE64_ALPHABET[byte3 & 0x3f] : '=';
  }

  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return encodeBase64Bytes(new Uint8Array(buffer));
}

function arrayBufferViewToBase64(view: ArrayBufferView): string {
  return encodeBase64Bytes(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
}

async function nativeFormDataToRawMultipart(body: FormData): Promise<ProxySerializedBody> {
  if (typeof Request === 'undefined') {
    throw new Error('Request is not available to serialize binary FormData');
  }

  const request = new Request('https://mockifyer.local/form-data', {
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
}

async function nativeFormDataToSerialized(body: FormData): Promise<ProxySerializedBody> {
  const params = new URLSearchParams();
  const entries = (body as FormData & {
    entries?: () => IterableIterator<[string, string | Blob]>;
  }).entries?.();

  if (!entries) {
    throw new Error('FormData.entries() is not available in this runtime');
  }

  const formEntries = Array.from(entries);
  if (formEntries.some(([, value]) => typeof value !== 'string')) {
    return nativeFormDataToRawMultipart(body);
  }

  for (const [key, value] of formEntries) {
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
      data: arrayBufferViewToBase64(body as ArrayBufferView),
    };
  } catch {
    return undefined;
  }
}

async function serializeBlobBody(
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

function serializeArrayBufferBody(
  body: ArrayBuffer,
  headers?: Record<string, string>
): ProxySerializedBody {
  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType: headerContentType(headers) || 'application/octet-stream',
    data: arrayBufferToBase64(body),
  };
}

function serializeArrayBufferViewBody(
  body: ArrayBufferView,
  headers?: Record<string, string>
): ProxySerializedBody {
  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType: headerContentType(headers) || 'application/octet-stream',
    data: arrayBufferViewToBase64(body),
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

  if (isNodeFormDataPackage(body)) {
    return nodeFormDataPackageToSerialized(body);
  }

  const nodeBufferBody = serializeNodeBufferBody(body, headers);
  if (nodeBufferBody) {
    return nodeBufferBody;
  }

  if (isBlobBody(body)) {
    return serializeBlobBody(body, headers);
  }

  if (isArrayBufferBody(body)) {
    return serializeArrayBufferBody(body, headers);
  }

  if (isArrayBufferViewBody(body)) {
    return serializeArrayBufferViewBody(body, headers);
  }

  // Plain objects (GraphQL JSON, REST JSON) after binary body detection.
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
