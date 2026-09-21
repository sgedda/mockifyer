import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';
import { wrapProxyUpstreamFetchError } from './proxy-upstream-error';
import { rewriteEmulatorLoopbackUrl } from './rewrite-emulator-loopback-url';

let insecureDispatcher: Agent | undefined;

function getInsecureDispatcher(): Agent {
  if (!insecureDispatcher) {
    insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  }
  return insecureDispatcher;
}

function headerValueIsUsable(value: string): boolean {
  return value.length > 0 && !value.includes('\r') && !value.includes('\n');
}

/**
 * Flatten fetch Headers / records into a plain map Undici owns.
 * Passing a WHATWG `Headers` from Node's bundled Undici into dashboard's
 * `undici` package copy can throw `TypeError: fetch failed` before connect.
 * Empty values (GraphQL login `Authorization: ""`) are dropped.
 */
export function toUndiciHeaderRecord(headers: RequestInit['headers'] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) {
    return out;
  }
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      if (headerValueIsUsable(value)) {
        out[key] = value;
      }
    });
    return out;
  }
  if (Array.isArray(headers)) {
    for (const entry of headers) {
      if (!Array.isArray(entry) || entry.length < 2) {
        continue;
      }
      const key = String(entry[0]);
      const value = String(entry[1]);
      if (key && headerValueIsUsable(value)) {
        out[key] = value;
      }
    }
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) {
      continue;
    }
    const text = String(value);
    if (headerValueIsUsable(text)) {
      out[key] = text;
    }
  }
  return out;
}

/**
 * Performs the dashboard proxy upstream HTTP(S) request via undici.
 *
 * Always uses undici's `fetch` (never global `fetch`) so an embedded dashboard
 * in a process with `useGlobalFetch: true` cannot re-enter `/api/proxy` through
 * the Mockifyer-patched global fetch.
 *
 * When `tlsInsecure` is true, skips TLS certificate verification (dev / internal CAs).
 *
 * Android emulator loopback aliases (`10.0.2.2`, `10.0.3.2`) are rewritten to
 * `127.0.0.1` so upstream connects on the host running the dashboard.
 */
export async function fetchProxyUpstream(
  url: string,
  init: RequestInit,
  tlsInsecure: boolean
): Promise<Response> {
  const undiciInit: UndiciRequestInit = {
    method: init.method,
    headers: toUndiciHeaderRecord(init.headers),
    body: init.body as UndiciRequestInit['body'],
    redirect: init.redirect,
    signal: init.signal,
  };

  if (tlsInsecure) {
    undiciInit.dispatcher = getInsecureDispatcher();
  }

  try {
    return (await undiciFetch(rewriteEmulatorLoopbackUrl(url), undiciInit)) as unknown as Response;
  } catch (error) {
    throw wrapProxyUpstreamFetchError(init.method, url, error);
  }
}

/**
 * Fetch upstream and read the body. `response.text()` can throw `fetch failed`
 * on a dead socket even after `fetch()` itself resolved — wrap that too.
 */
export async function fetchProxyUpstreamAndReadText(
  url: string,
  init: RequestInit,
  tlsInsecure: boolean
): Promise<{ response: Response; rawText: string }> {
  const response = await fetchProxyUpstream(url, init, tlsInsecure);
  try {
    const rawText = await response.text();
    return { response, rawText };
  } catch (error) {
    throw wrapProxyUpstreamFetchError(init.method, url, error);
  }
}
