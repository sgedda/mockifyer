const AUTH_BASE = (process.env.AUTH_URL ?? 'http://127.0.0.1:4201').replace(/\/$/, '');
const TRIPS_BASE = (process.env.TRIPS_URL ?? 'http://127.0.0.1:4202').replace(/\/$/, '');
const WANDER_BASE = (process.env.WANDER_URL ?? 'http://127.0.0.1:4203').replace(/\/$/, '');
const LORE_BASE = (process.env.LORE_URL ?? 'http://127.0.0.1:4205').replace(/\/$/, '');

export const upstreamBases = {
  auth: AUTH_BASE,
  trips: TRIPS_BASE,
  wander: WANDER_BASE,
  lore: LORE_BASE,
};

export async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<{ status: number; body: unknown }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const body: unknown = await response.json().catch(async () => response.text());
    return { status: response.status, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upstream fetch failed';
    return { status: 502, body: { error: `Upstream unreachable (${url}): ${message}` } };
  }
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function errorMessage(body: unknown, fallback: string): string {
  const record = asRecord(body);
  if (typeof record?.error === 'string') {
    return record.error;
  }
  if (typeof body === 'string' && body.trim()) {
    return body;
  }
  return fallback;
}
