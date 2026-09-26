/**
 * Display helpers for GraphQL HTTP request bodies (query / variables / operationName).
 * Prefer this over JSON.stringify so the query is copyable with real newlines.
 */

export interface GraphqlRequestBodyFields {
  query: string;
  variables?: unknown;
  operationName?: string;
  extensions?: unknown;
}

/** True when value looks like a standard GraphQL POST JSON body. */
export function isGraphqlRequestBodyObject(value: unknown): value is GraphqlRequestBodyFields {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const query = (value as { query?: unknown }).query;
  if (typeof query !== 'string') return false;
  const trimmed = query.trim();
  // Avoid treating unrelated `{ query: "search text" }` bodies as GraphQL.
  return /^(query|mutation|subscription)\b/.test(trimmed) || /^\{/.test(trimmed);
}

/**
 * True when text was already formatted by {@link formatGraphqlRequestBodyObject}
 * (or starts with a GraphQL operation document).
 */
export function looksLikeGraphqlDisplayText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /^(#\s*operationName:|(query|mutation|subscription)\b)/.test(t);
}

/** Soft-indent a single-line GraphQL document for display (brace-based only). */
export function softIndentGraphqlQuery(query: string): string {
  let out = '';
  let depth = 0;
  let inStr = false;
  let esc = false;
  const indent = (): string => {
    let pad = '';
    for (let i = 0; i < depth; i++) pad += '  ';
    return pad;
  };
  for (let i = 0; i < query.length; i++) {
    const ch = query.charAt(i);
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      out += `{\n${indent()}`;
      continue;
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1);
      out += `\n${indent()}}`;
      continue;
    }
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      if (!out || out.endsWith('\n') || out.endsWith(' ') || out.endsWith('(')) continue;
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out.trim();
}

/** Normalize a GraphQL query string for readable display (real newlines, light indent). */
export function formatGraphqlQueryForDisplay(query: string): string {
  let q = query.replace(/\r\n/g, '\n');
  if (!q.includes('\n') && /\\n/.test(q)) {
    q = q.replace(/\\n/g, '\n').replace(/\\t/g, '  ');
  }
  if (q.includes('\n')) {
    return q
      .split('\n')
      .map((line) => line.replace(/\t/g, '  ').replace(/\s+$/g, ''))
      .join('\n')
      .trim();
  }
  return softIndentGraphqlQuery(q);
}

/** Format a parsed GraphQL request body for copy/paste display. */
export function formatGraphqlRequestBodyObject(body: GraphqlRequestBodyFields): string {
  const parts: string[] = [];
  if (typeof body.operationName === 'string' && body.operationName.trim()) {
    parts.push(`# operationName: ${body.operationName.trim()}`);
    parts.push('');
  }
  parts.push(formatGraphqlQueryForDisplay(body.query));
  if (body.variables !== undefined) {
    parts.push('');
    parts.push('# Variables');
    try {
      parts.push(JSON.stringify(body.variables, null, 2));
    } catch {
      parts.push(String(body.variables));
    }
  }
  if (body.extensions !== undefined) {
    parts.push('');
    parts.push('# Extensions');
    try {
      parts.push(JSON.stringify(body.extensions, null, 2));
    } catch {
      parts.push(String(body.extensions));
    }
  }
  return parts.join('\n');
}

/**
 * If `text` is a GraphQL request JSON body, return a readable multi-line display string.
 * Otherwise return null.
 */
export function tryFormatGraphqlRequestBodyText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.charAt(0) !== '{') return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isGraphqlRequestBodyObject(parsed)) return null;
    return formatGraphqlRequestBodyObject(parsed);
  } catch {
    return null;
  }
}

/**
 * Prefer GraphQL-aware display; otherwise return null so callers can fall back to JSON pretty.
 */
export function formatBodyPreviewForDisplay(text: string): string {
  if (looksLikeGraphqlDisplayText(text)) return text;
  const gql = tryFormatGraphqlRequestBodyText(text);
  if (gql != null) return gql;
  return text;
}

/**
 * Reverse {@link formatGraphqlRequestBodyObject} back to a wire-safe GraphQL HTTP JSON body.
 * Used when Atlas curl / include-trace accidentally hold the display form instead of JSON.
 */
export function tryGraphqlDisplayTextToRequestJson(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || !looksLikeGraphqlDisplayText(trimmed)) {
    return null;
  }
  // Already valid JSON (e.g. anonymous `{ viewer { id } }` docs that look GraphQL-ish).
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isGraphqlRequestBodyObject(parsed)) {
      return JSON.stringify(parsed);
    }
  } catch {
    // display form — continue
  }

  const lines = trimmed.replace(/\r\n/g, '\n').split('\n');
  let operationName: string | undefined;
  let mode: 'query' | 'variables' | 'extensions' | null = null;
  const queryLines: string[] = [];
  const variableLines: string[] = [];
  const extensionLines: string[] = [];

  for (const line of lines) {
    const opMatch = /^#\s*operationName:\s*(.+)\s*$/i.exec(line);
    if (opMatch) {
      operationName = opMatch[1].trim();
      continue;
    }
    if (/^#\s*Variables\s*$/i.test(line)) {
      mode = 'variables';
      continue;
    }
    if (/^#\s*Extensions\s*$/i.test(line)) {
      mode = 'extensions';
      continue;
    }
    if (mode === 'variables') {
      variableLines.push(line);
      continue;
    }
    if (mode === 'extensions') {
      extensionLines.push(line);
      continue;
    }
    if (!mode && queryLines.length === 0 && line.trim() === '') {
      continue;
    }
    mode = 'query';
    queryLines.push(line);
  }

  const query = queryLines.join('\n').trim();
  if (!query) {
    return null;
  }

  const body: GraphqlRequestBodyFields = { query };
  if (operationName) {
    body.operationName = operationName;
  }
  if (variableLines.length > 0) {
    try {
      body.variables = JSON.parse(variableLines.join('\n'));
    } catch {
      return null;
    }
  }
  if (extensionLines.length > 0) {
    try {
      body.extensions = JSON.parse(extensionLines.join('\n'));
    } catch {
      return null;
    }
  }
  return JSON.stringify(body);
}
