/**
 * Pretty-print helpers for network / Atlas body previews (no circular deps).
 */

import {
  looksLikeGraphqlDisplayText,
  tryFormatGraphqlRequestBodyText,
} from './graphql-body-display';

/** Prefer GraphQL-readable or indented JSON; soft-pretty for truncated payloads. */
export function prettyPrintJsonText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (looksLikeGraphqlDisplayText(trimmed)) return text;
  const gql = tryFormatGraphqlRequestBodyText(text);
  if (gql != null) return gql;
  if (trimmed.charAt(0) !== '{' && trimmed.charAt(0) !== '[') {
    return text;
  }
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return softPrettyJsonText(text);
  }
}

/**
 * Best-effort pretty printer for truncated / invalid JSON (display only).
 * Inserts newlines/indent outside of string literals.
 */
export function softPrettyJsonText(text: string): string {
  let out = '';
  let depth = 0;
  let inStr = false;
  let esc = false;
  const indent = (): string => {
    let pad = '';
    for (let i = 0; i < depth; i++) pad += '  ';
    return pad;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inStr) {
      out += ch;
      if (esc) {
        esc = false;
      } else if (ch === '\\') {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth += 1;
      out += `${ch}\n${indent()}`;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      out += `\n${indent()}${ch}`;
      continue;
    }
    if (ch === ',') {
      out += `${ch}\n${indent()}`;
      continue;
    }
    if (ch === ':') {
      out += ': ';
      continue;
    }
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      continue;
    }
    out += ch;
  }
  return out;
}
