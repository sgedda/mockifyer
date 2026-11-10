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
