/**
 * Resolve `fetch(input, init)` into the HTTPClient shape used by the global fetch patch.
 *
 * Native fetch reads method/headers/body from a `Request` argument when `init` omits them.
 * The patch historically only inspected `init`, so `fetch(new Request(url, { method, headers, body }))`
 * was treated as GET with no headers or body.
 */

export interface ResolvedPatchedFetchRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function isRequest(input: unknown): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) {
    return out;
  }
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      out[key] = value;
    }
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) {
      out[key] = String(value);
    }
  }
  return out;
}

/**
 * Parse JSON text when it looks like an object/array; keep invalid JSON as the original string
 * so the request still proceeds (native fetch does not throw on unparsable bodies).
 */
export function decodeFetchBodyText(text: string): unknown {
  const start = text.trimStart();
  if (start.startsWith('{') || start.startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function decodeFetchBodyInit(body: BodyInit): unknown {
  if (typeof body === 'string') {
    return decodeFetchBodyText(body);
  }
  return body;
}

function urlFromFetchInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

/**
 * Method, headers, and body as native `fetch(input, init)` would use them.
 * `init` fields override the `Request` argument (Fetch spec). Relative URL strings
 * are left unchanged — `new Request('/path')` throws in Node without a base URL.
 */
export async function resolvePatchedFetchRequest(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ResolvedPatchedFetchRequest> {
  const url = urlFromFetchInput(input);
  const method = String(init?.method || (isRequest(input) ? input.method : 'GET') || 'GET');

  const headers = headersToRecord(
    init?.headers !== undefined ? init.headers : isRequest(input) ? input.headers : undefined
  );

  let body: unknown;
  if (init !== undefined && init.body !== undefined && init.body !== null) {
    body = decodeFetchBodyInit(init.body);
  } else if (isRequest(input) && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
    const text = await input.clone().text();
    body = text ? decodeFetchBodyText(text) : undefined;
  } else {
    body = undefined;
  }

  return { url, method, headers, body };
}
