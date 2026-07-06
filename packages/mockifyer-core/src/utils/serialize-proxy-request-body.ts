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

async function nativeFormDataToSerialized(body: FormData): Promise<ProxySerializedBody> {
  const params = new URLSearchParams();
  const entries = (body as FormData & {
    entries?: () => IterableIterator<[string, string | Blob]>;
  }).entries?.();

  if (!entries) {
    throw new Error('FormData.entries() is not available in this runtime');
  }

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      params.append(key, value);
      continue;
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      params.append(key, await value.text());
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

function bytesToBase64(bytes: Uint8Array): string {
  if (isNodeRuntime()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Buffer: BufferCtor } = require('buffer') as {
        Buffer: { from: (bytes: Uint8Array) => { toString: (enc: string) => string } };
      };
      return BufferCtor.from(bytes).toString('base64');
    } catch {
      // Fall through to browser/RN-compatible encoding when available.
    }
  }

  if (typeof btoa === 'function') {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  throw new Error('Base64 encoding is not available in this runtime');
}

function serializeArrayBufferBody(
  body: unknown,
  headers?: Record<string, string>
): ProxySerializedBody | undefined {
  if (typeof ArrayBuffer === 'undefined') {
    return undefined;
  }

  let bytes: Uint8Array | undefined;
  if (body instanceof ArrayBuffer) {
    bytes = new Uint8Array(body);
  } else if (ArrayBuffer.isView(body)) {
    const view = body as ArrayBufferView;
    bytes = new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength);
  }

  if (!bytes) {
    return undefined;
  }

  return {
    __mockifyerProxyBody: true,
    kind: 'raw',
    contentType: headerContentType(headers) || 'application/octet-stream',
    data: bytesToBase64(bytes),
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

  const arrayBufferBody = serializeArrayBufferBody(body, headers);
  if (arrayBufferBody) {
    return arrayBufferBody;
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
