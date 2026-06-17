import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici';

let insecureDispatcher: Agent | undefined;

function getInsecureDispatcher(): Agent {
  if (!insecureDispatcher) {
    insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  }
  return insecureDispatcher;
}

/**
 * Performs the dashboard proxy upstream HTTP(S) request.
 * When `tlsInsecure` is true, skips TLS certificate verification (dev / internal CAs).
 */
export async function fetchProxyUpstream(
  url: string,
  init: RequestInit,
  tlsInsecure: boolean
): Promise<Response> {
  if (!tlsInsecure) {
    return fetch(url, init);
  }

  const undiciInit: UndiciRequestInit = {
    method: init.method,
    headers: init.headers as UndiciRequestInit['headers'],
    body: init.body as UndiciRequestInit['body'],
    redirect: init.redirect,
    signal: init.signal,
    dispatcher: getInsecureDispatcher(),
  };

  return undiciFetch(url, undiciInit) as unknown as Promise<Response>;
}
