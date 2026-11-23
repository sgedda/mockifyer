import { FieldKind } from './types';
import { inferFieldKind } from './infer';

/**
 * True when a JSON key names an identifier / foreign key / slug that variants
 * should preserve by default (SGE-72).
 *
 * Matches: `id`, `*Id`, `*_id`, `uuid`/`guid` (and suffixes), `slug` (and suffixes).
 */
export function isIdentifierKeyName(key: string): boolean {
  if (!key) return false;
  const raw = key.trim();
  if (/^slug$/i.test(raw) || /Slug$/.test(raw) || /_slug$/i.test(raw)) {
    return true;
  }
  if (/_id$/i.test(raw) || /Id$/.test(raw)) {
    return true;
  }
  const nk = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (/^(id|ids|uuid|guid|slug|pk|rowid)$/.test(nk)) {
    return true;
  }
  if (nk.endsWith('uuid') || nk.endsWith('guid')) {
    return true;
  }
  // userid, orderid, productid, … (after stripping separators)
  if (nk.endsWith('id') && nk !== 'grid' && nk !== 'solid' && nk !== 'valid') {
    return true;
  }
  return false;
}

/**
 * True when the key and/or inferred field kind mark this as an identifier.
 * Uses {@link inferFieldKind} so Uuid / IntegerId kinds are covered even when
 * the key is unusual.
 */
export function isIdentifierField(key: string, value?: unknown): boolean {
  if (isIdentifierKeyName(key)) {
    return true;
  }
  if (value === undefined) {
    return false;
  }
  const kind = inferFieldKind(key, [value]).kind;
  return kind === FieldKind.Uuid || kind === FieldKind.IntegerId;
}
