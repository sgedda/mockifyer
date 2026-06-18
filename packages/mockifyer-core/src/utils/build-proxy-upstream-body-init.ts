import { isProxySerializedBody } from './proxy-request-body-types';

export interface ProxyUpstreamBodyInit {
  body?: string | Buffer;
  headers: Record<string, string>;
}

/**
 * Build the upstream fetch body and headers from a proxy envelope body value.
 * Dashboard / Node only — uses the `buffer` package, not the global `Buffer` binding.
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Buffer: BufferCtor } = require('buffer') as { Buffer: typeof Buffer };
    return { body: BufferCtor.from(body.data, 'base64'), headers: upstreamHeaders };
  }

  if (typeof body === 'string') {
    return { body, headers: upstreamHeaders };
  }

  if (!upstreamHeaders['content-type'] && !upstreamHeaders['Content-Type']) {
    upstreamHeaders['content-type'] = 'application/json';
  }
  return { body: JSON.stringify(body), headers: upstreamHeaders };
}
