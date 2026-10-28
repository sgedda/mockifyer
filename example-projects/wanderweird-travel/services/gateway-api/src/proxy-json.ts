export const UPSTREAM_UNAVAILABLE_STATUS = 502;

/**
 * Read an upstream body once. `response.json().catch(() => response.text())`
 * throws `Body is unusable` after a failed parse because the body was already
 * consumed, and Express 4 does not catch that rejection.
 */
export async function readUpstreamBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Proxy a JSON upstream. Network failures and unreadable bodies become 502
 * instead of rejecting, so one down upstream cannot crash the gateway.
 */
export async function proxyJson(
  url: string,
  init?: RequestInit
): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    console.error(`[gateway-api] upstream unavailable: ${url}: ${details}`);
    return {
      status: UPSTREAM_UNAVAILABLE_STATUS,
      body: { error: 'Upstream unavailable', upstream: url, details },
    };
  }

  try {
    const body = await readUpstreamBody(response);
    return { status: response.status, body };
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    console.error(`[gateway-api] upstream body unreadable: ${url}: ${details}`);
    return {
      status: UPSTREAM_UNAVAILABLE_STATUS,
      body: { error: 'Upstream unavailable', upstream: url, details },
    };
  }
}
