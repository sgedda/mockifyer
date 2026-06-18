/** Tagged body shape sent through dashboard `/api/proxy` JSON envelope. */
export interface ProxySerializedBody {
  __mockifyerProxyBody: true;
  kind: 'urlencoded' | 'raw';
  contentType: string;
  /** URL-encoded field string, or base64 payload for raw/multipart bodies. */
  data: string;
}

export function isProxySerializedBody(body: unknown): body is ProxySerializedBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as ProxySerializedBody).__mockifyerProxyBody === true &&
    ((body as ProxySerializedBody).kind === 'urlencoded' ||
      (body as ProxySerializedBody).kind === 'raw') &&
    typeof (body as ProxySerializedBody).data === 'string'
  );
}

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

function isNodeFormDataPackage(value: unknown): value is { getBuffer: () => Buffer; getHeaders?: () => Record<string, string> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { getBuffer?: unknown }).getBuffer === 'function' &&
    typeof (value as { append?: unknown }).append === 'function' &&
    !isNativeFormData(value)
  );
}

function isUrlSearchParams(value: unknown): value is URLSearchParams {
  return typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams;
}

function getNodeBufferCtor(): typeof Buffer | undefined {
  const g = globalThis as { Buffer?: typeof Buffer };
  return typeof g.Buffer !== 'undefined' ? g.Buffer : undefined;
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
  getBuffer: () => Buffer;
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

  // Plain objects (GraphQL JSON, REST JSON) before Buffer — Hermes has no `Buffer` global.
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

  const bufferCtor = getNodeBufferCtor();
  if (bufferCtor?.isBuffer(body)) {
    return {
      __mockifyerProxyBody: true,
      kind: 'raw',
      contentType: headerContentType(headers) || 'application/octet-stream',
      data: (body as Buffer).toString('base64'),
    } satisfies ProxySerializedBody;
  }

  return body;
}

/** Normalize proxy body for request-key generation and mock persistence. */
export function normalizeProxyBodyForRequestKey(body: unknown): unknown {
  if (!isProxySerializedBody(body)) {
    return body;
  }
  if (body.kind === 'urlencoded') {
    return body.data;
  }
  return `raw:${body.contentType}:${body.data}`;
}

export interface ProxyUpstreamBodyInit {
  body?: string | Buffer;
  headers: Record<string, string>;
}

/**
 * Build the upstream fetch body and headers from a proxy envelope body value.
 */
export function buildProxyUpstreamBodyInit(
  body: unknown,
  headers: Record<string, string>,
  method: string
): ProxyUpstreamBodyInit {
  const upperMethod = method.toUpperCase();
  const upstreamHeaders = { ...headers };

  if (upperMethod === 'GET' || upperMethod === 'HEAD' || body === undefined || body === null) {
    return { headers: upstreamHeaders };
  }

  if (isProxySerializedBody(body)) {
    if (body.kind === 'urlencoded') {
      upstreamHeaders['content-type'] = body.contentType || 'application/x-www-form-urlencoded';
      return { body: body.data, headers: upstreamHeaders };
    }
    upstreamHeaders['content-type'] = body.contentType || 'application/octet-stream';
    return { body: Buffer.from(body.data, 'base64'), headers: upstreamHeaders };
  }

  if (typeof body === 'string') {
    return { body, headers: upstreamHeaders };
  }

  if (!upstreamHeaders['content-type'] && !upstreamHeaders['Content-Type']) {
    upstreamHeaders['content-type'] = 'application/json';
  }
  return { body: JSON.stringify(body), headers: upstreamHeaders };
}
