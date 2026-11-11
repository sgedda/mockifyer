/**
 * Browser stub for serialize-proxy-request-body.
 * Browser version uses standard APIs instead of Node Buffer.
 */

export function serializeProxyRequestBody(body: any): any {
  // Browser: pass through body as-is (fetch handles it)
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return body;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (body && typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }
  return body;
}

export function deserializeProxyRequestBody(serialized: any): any {
  // Browser: pass through
  return serialized;
}
