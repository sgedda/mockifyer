import { MOCKIFYER_CLIENT_ID_HEADER, type MockData, type StoredRequest } from '@sgedda/mockifyer-core';

export interface UpstreamCaptureResult {
  response: MockData['response'];
  durationMs: number;
}

export async function fetchUpstreamResponse(
  request: Pick<StoredRequest, 'method' | 'url' | 'headers' | 'data'>,
  options?: { clientId?: string }
): Promise<UpstreamCaptureResult> {
  const upperMethod = String(request.method || 'GET').toUpperCase();
  const upstreamHeaders = new Headers();
  const src = request.headers ?? {};
  for (const [k, v] of Object.entries(src)) {
    if (k.toLowerCase() === 'host') continue;
    if (v === undefined || v === null) continue;
    upstreamHeaders.set(k, String(v));
  }
  if (options?.clientId?.trim()) {
    upstreamHeaders.set(MOCKIFYER_CLIENT_ID_HEADER, options.clientId.trim());
  }

  const init: RequestInit = { method: upperMethod, headers: upstreamHeaders };
  if (
    request.data !== undefined &&
    request.data !== null &&
    upperMethod !== 'GET' &&
    upperMethod !== 'HEAD'
  ) {
    init.body = typeof request.data === 'string' ? request.data : JSON.stringify(request.data);
    if (!upstreamHeaders.has('content-type')) {
      upstreamHeaders.set('content-type', 'application/json');
    }
  }

  const started = Date.now();
  const upstreamRes = await fetch(request.url, init);
  const contentType = upstreamRes.headers.get('content-type') || '';
  const rawText = await upstreamRes.text();
  let data: unknown = rawText;
  if (contentType.includes('application/json')) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  const responseHeaders: Record<string, string> = {};
  upstreamRes.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    response: {
      status: upstreamRes.status,
      data,
      headers: responseHeaders,
    },
    durationMs: Math.max(0, Date.now() - started),
  };
}
