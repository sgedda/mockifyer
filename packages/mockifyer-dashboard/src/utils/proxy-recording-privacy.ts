import { redactHeaders } from '@sgedda/mockifyer-core';

export function toRecordStringHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

export function toPersistedRequestHeaders(headers: unknown): Record<string, string> {
  return redactHeaders(toRecordStringHeaders(headers)) ?? {};
}
