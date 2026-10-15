import { REDACTED_SECRET_PLACEHOLDER, redactHeaders } from '@sgedda/mockifyer-core';

export function toRecordStringHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

/** Headers safe to persist on recorded mocks (secrets replaced with `[REDACTED]`). */
export function toPersistedRequestHeaders(headers: unknown): Record<string, string> {
  return redactHeaders(toRecordStringHeaders(headers)) ?? {};
}

/**
 * True when a stored request header was replaced with {@link REDACTED_SECRET_PLACEHOLDER}.
 * Those values are not credentials and must not be replayed to the live API.
 */
export function requestHeadersIncludeRedactedSecrets(headers: unknown): boolean {
  if (!headers || typeof headers !== 'object') return false;
  return Object.values(headers as Record<string, unknown>).some(
    (value) => value === REDACTED_SECRET_PLACEHOLDER
  );
}

/**
 * Refresh-from-live cannot authenticate a mock whose secrets were stripped at record time.
 * Callers must surface this before writing the upstream result back over the stored response.
 */
export class RedactedRequestHeadersError extends Error {
  constructor() {
    super(
      'Cannot refresh this mock from the live API because secret request headers were redacted when it was recorded. Replay the call from the app so the live request can send real credentials.'
    );
    this.name = 'RedactedRequestHeadersError';
  }
}
