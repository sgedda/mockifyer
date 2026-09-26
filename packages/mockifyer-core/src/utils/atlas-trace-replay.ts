/**
 * Re-call a captured Atlas hop with `X-Mockifyer-Include-Trace` so the response
 * carries `mockifyerTrace` (nested hops) for live debugging.
 *
 * This is a live HTTP re-call — it does not read or write body-spill files.
 * Nested hops come back on the response; they are not loaded from disk/Redis.
 */

import type { NetworkEvent } from './network-event-types';
import { ATLAS_LIVE_STREAM_PATH } from './atlas-live-html';
import { tryGraphqlDisplayTextToRequestJson } from './graphql-body-display';
import {
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_TRACE_RESPONSE_KEY,
} from './inline-trace';
import { mergeQueryStringOntoUrl } from './append-params-to-url';
import {
  ATLAS_CODE_HIGHLIGHT_CSS,
  highlightAtlasCode,
  type AtlasCodeHighlightKind,
} from './atlas-syntax-highlight';

export const ATLAS_TRACE_REPLAY_PATH = '/mockifyer-atlas-trace';

/** Hop headers that must not be copied onto the replay (hop-by-hop / framing). */
const SKIP_REPLAY_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'proxy-connection',
  'trailer',
  'upgrade',
  'accept-encoding',
]);

export interface AtlasTraceReplayResult {
  success: boolean;
  hopId: string;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  /** Parsed JSON body when content-type is JSON; otherwise truncated text. */
  body?: unknown;
  mockifyerTrace?: unknown;
  error?: string;
  /** Headers sent on the replay (excluding secrets when scrubbed later). */
  requestHeaders: Record<string, string>;
}

export interface ReplayNetworkEventWithIncludeTraceOptions {
  /** Also stamp include-trace-bodies. Default true. */
  includeBodies?: boolean;
  /** Override fetch (tests). */
  fetchFn?: typeof fetch;
  /** Extra headers merged after hop headers (can override). */
  headers?: Record<string, string>;
  /**
   * Full request body for POST/PUT/PATCH/DELETE.
   * Prefer the spilled file when Metro has it; otherwise the hop preview.
   * Trace itself does not require body spill — only the re-call payload does.
   */
  requestBody?: string;
  /** Max characters retained for non-JSON text bodies. Default 64_000. */
  maxTextChars?: number;
}

function findHop(
  events: readonly NetworkEvent[],
  hopId: string,
): NetworkEvent | undefined {
  const id = hopId.trim();
  if (!id) return undefined;
  return events.find(
    (e) => e && (e.id === id || e.requestId === id),
  );
}

function mergeHopRequestHeaders(
  event: NetworkEvent,
  extras?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
  };

  const captured = event.requestHeaders;
  if (captured && typeof captured === 'object') {
    for (const [rawKey, rawVal] of Object.entries(captured)) {
      const key = rawKey.trim();
      if (!key) continue;
      if (SKIP_REPLAY_REQUEST_HEADERS.has(key.toLowerCase())) continue;
      if (rawVal == null) continue;
      const value = String(rawVal).trim();
      if (!value) continue;
      headers[key] = value;
    }
  }

  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v != null && String(v).trim() !== '') {
        headers[k] = String(v);
      }
    }
  }

  return headers;
}

/**
 * Wire URL for include-trace replay. Prefer the event URL; if hop logging
 * dropped axios/fetch `params` but left `event.query`, merge it back.
 */
export function resolveNetworkEventReplayUrl(event: NetworkEvent): string {
  return mergeQueryStringOntoUrl((event.url || '').trim(), event.query);
}

/**
 * Locate a hop in a newest-first or chronological buffer and replay it with
 * the include-trace opt-in headers (and captured auth/headers when present).
 */
export async function replayNetworkEventWithIncludeTrace(
  events: readonly NetworkEvent[],
  hopId: string,
  options?: ReplayNetworkEventWithIncludeTraceOptions,
): Promise<AtlasTraceReplayResult> {
  const event = findHop(events, hopId);
  if (!event) {
    return {
      success: false,
      hopId,
      method: '',
      url: '',
      error: 'hop not found',
      requestHeaders: {},
    };
  }

  const method = (event.method || 'GET').toUpperCase();
  const url = resolveNetworkEventReplayUrl(event);
  if (!url) {
    return {
      success: false,
      hopId: event.id,
      method,
      url: '',
      error: 'hop has no url',
      requestHeaders: {},
    };
  }

  const includeBodies = options?.includeBodies !== false;
  const headers = mergeHopRequestHeaders(event, options?.headers);
  headers[MOCKIFYER_INCLUDE_TRACE_HEADER] = '1';
  if (includeBodies) {
    headers[MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER] = '1';
  }

  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    const rawBody =
      (typeof options?.requestBody === 'string' && options.requestBody) ||
      (typeof event.requestBodyPreview === 'string'
        ? event.requestBodyPreview
        : undefined);
    const body =
      typeof rawBody === 'string' && rawBody.length > 0
        ? tryGraphqlDisplayTextToRequestJson(rawBody) ?? rawBody
        : undefined;
    if (typeof body === 'string' && body.length > 0) {
      init.body = body;
      if (!hasHeader(headers, 'content-type')) {
        headers['content-type'] = looksLikeJson(body)
          ? 'application/json'
          : 'text/plain;charset=UTF-8';
      }
    }
  }

  const fetchFn = options?.fetchFn ?? fetch;
  const started = Date.now();
  try {
    const res = await fetchFn(url, init);
    const durationMs = Date.now() - started;
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    let body: unknown = text;
    if (contentType.includes('json') || looksLikeJson(text)) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = truncateText(text, options?.maxTextChars);
      }
    } else {
      body = truncateText(text, options?.maxTextChars);
    }

    const mockifyerTrace = extractMockifyerTrace(body);

    return {
      success: true,
      hopId: event.id,
      method,
      url,
      status: res.status,
      durationMs,
      body,
      mockifyerTrace,
      requestHeaders: headers,
    };
  } catch (error) {
    return {
      success: false,
      hopId: event.id,
      method,
      url,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      requestHeaders: headers,
    };
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  return (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  );
}

function truncateText(text: string, maxChars = 64_000): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n… [truncated ${text.length - maxChars} chars]`;
}

function extractMockifyerTrace(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  return record[MOCKIFYER_TRACE_RESPONSE_KEY];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Hop fields that store JSON as a string — expand for readable Atlas HTML. */
const NESTED_JSON_STRING_KEYS = new Set([
  'responseBodyPreview',
  'requestBodyPreview',
]);

/**
 * Walk a value and parse known JSON-string fields into objects so
 * `JSON.stringify(..., null, 2)` shows real nested JSON instead of `\n`-escaped blobs.
 */
export function reviveNestedJsonStringFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => reviveNestedJsonStringFields(item));
  }
  if (value != null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (NESTED_JSON_STRING_KEYS.has(key) && typeof child === 'string') {
        const trimmed = child.trim();
        if (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
          try {
            out[key] = reviveNestedJsonStringFields(JSON.parse(child));
            continue;
          } catch {
            // Truncated / non-JSON preview — keep the string.
          }
        }
      }
      out[key] = reviveNestedJsonStringFields(child);
    }
    return out;
  }
  return value;
}

function prettyJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(
        reviveNestedJsonStringFields(JSON.parse(value)),
        null,
        2,
      );
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(reviveNestedJsonStringFields(value), null, 2);
  } catch {
    return String(value);
  }
}

interface TraceTreeHop {
  method?: string;
  url?: string;
  status?: number;
  durationMs?: number;
  requestId?: string | null;
  parentRequestId?: string | null;
  responseBodyPreview?: string;
  errorMessage?: string;
}

function asTraceTreeHops(trace: unknown): TraceTreeHop[] | undefined {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) return undefined;
  const hops = (trace as { hops?: unknown }).hops;
  if (!Array.isArray(hops) || hops.length === 0) return undefined;
  return hops.filter((h): h is TraceTreeHop => !!h && typeof h === 'object');
}

function renderTraceTreeLines(hops: TraceTreeHop[]): string[] {
  const byParent = new Map<string, TraceTreeHop[]>();
  const roots: TraceTreeHop[] = [];
  const ids = new Set(
    hops
      .map((h) => (typeof h.requestId === 'string' ? h.requestId.trim() : ''))
      .filter(Boolean),
  );

  for (const hop of hops) {
    const parent =
      typeof hop.parentRequestId === 'string' ? hop.parentRequestId.trim() : '';
    if (parent && ids.has(parent)) {
      const list = byParent.get(parent) ?? [];
      list.push(hop);
      byParent.set(parent, list);
    } else {
      roots.push(hop);
    }
  }

  const lines: string[] = [];
  const walk = (hop: TraceTreeHop, depth: number): void => {
    const indent = depth > 0 ? `${'│  '.repeat(depth - 1)}├─ ` : '';
    const method = (hop.method || '?').toUpperCase();
    const status = hop.status != null ? String(hop.status) : '—';
    const ms = hop.durationMs != null ? `${hop.durationMs}ms` : '';
    const url = hop.url || '';
    const err = hop.errorMessage ? `  ! ${hop.errorMessage}` : '';
    lines.push(`${indent}${method}  ${status}  ${ms}  ${url}${err}`.trimEnd());
    const id = typeof hop.requestId === 'string' ? hop.requestId.trim() : '';
    const kids = id ? byParent.get(id) || [] : [];
    for (const kid of kids) {
      walk(kid, depth + 1);
    }
  };

  for (const root of roots) {
    walk(root, 0);
  }
  // Orphans already walked via roots; if nothing rooted, dump flat.
  if (lines.length === 0) {
    for (const hop of hops) {
      walk(hop, 0);
    }
  }
  return lines;
}

export interface BuildAtlasTraceReplayHtmlOptions {
  /** Optional lines for hops already in the Metro buffer before the re-call. */
  capturedLines?: string[];
  title?: string;
  /**
   * Link to the live Atlas hop stream page.
   * Default `/mockifyer-atlas-live` (same Metro origin).
   */
  atlasLiveUrl?: string;
  /**
   * Link to the Mockifyer dashboard.
   * Default `http://localhost:3002`.
   */
  dashboardUrl?: string;
  /**
   * Request body actually sent on the include-trace re-call (wire JSON).
   * Used to build the pretty curl on the result page.
   */
  requestBody?: string;
}

const DEFAULT_TRACE_PAGE_DASHBOARD_URL = 'http://localhost:3002';
const TRACE_PAGE_THEME_KEY = 'mockifyer-atlas-live-theme';

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** Multiline curl suitable for copy/paste from the include-trace result page. */
export function buildPrettyCurlCommand(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}): string {
  const method = (input.method || 'GET').toUpperCase();
  const url = (input.url || '').trim();
  const lines: string[] = [`curl -i -X ${method} ${shellQuote(url)}`];
  const headers = input.headers || {};
  for (const [name, value] of Object.entries(headers)) {
    if (value == null || String(value).trim() === '') continue;
    lines.push(`  -H ${shellQuote(`${name}: ${value}`)}`);
  }
  const body = typeof input.body === 'string' ? input.body : '';
  if (body && method !== 'GET' && method !== 'HEAD') {
    lines.push(`  --data-raw ${shellQuote(body)}`);
  }
  return lines.join(' \\\n');
}

function sectionHtml(
  id: string,
  title: string,
  content: string,
  options?: { error?: boolean; after?: string; lang?: AtlasCodeHighlightKind },
): string {
  const preClass = [
    'code',
    options?.error ? 'error' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const highlighted = highlightAtlasCode(content, options?.lang ?? 'auto');
  return `<section data-section="${escapeHtml(id)}">
  <div class="section-head">
    <h2>${escapeHtml(title)}</h2>
    <button type="button" class="copy-btn" data-copy-target="${escapeHtml(id)}">Copy</button>
  </div>
  <pre id="${escapeHtml(id)}" class="${preClass}">${highlighted}</pre>
  ${options?.after ?? ''}
</section>`;
}

/**
 * HTML document for `GET /mockifyer-atlas-trace?id=…&format=html` —
 * opened in a new browser tab from the live Atlas **trace** link.
 */
export function buildAtlasTraceReplayHtml(
  result: AtlasTraceReplayResult,
  options?: BuildAtlasTraceReplayHtmlOptions,
): string {
  const title = escapeHtml(
    options?.title?.trim() ||
      `Atlas trace · ${(result.method || '?').toUpperCase()} ${result.url || result.hopId}`,
  );
  const atlasLiveUrl = escapeHtml(
    options?.atlasLiveUrl?.trim() || ATLAS_LIVE_STREAM_PATH,
  );
  const dashboardUrl = escapeHtml(
    options?.dashboardUrl?.trim() || DEFAULT_TRACE_PAGE_DASHBOARD_URL,
  );
  const statusClass =
    result.success &&
    typeof result.status === 'number' &&
    result.status >= 200 &&
    result.status < 400
      ? 'ok'
      : 'bad';
  const meta = [
    result.success ? 'OK' : 'FAIL',
    (result.method || '').toUpperCase(),
    result.url || '',
    result.status != null ? `→ ${result.status}` : '',
    result.durationMs != null ? `${result.durationMs}ms` : '',
  ]
    .filter(Boolean)
    .join('  ');

  const captured =
    options?.capturedLines && options.capturedLines.length > 0
      ? options.capturedLines.join('\n')
      : '';

  const treeHops = asTraceTreeHops(result.mockifyerTrace);
  const treeSection = treeHops
    ? renderTraceTreeLines(treeHops).join('\n')
    : result.mockifyerTrace
      ? prettyJson(result.mockifyerTrace)
      : '(no mockifyerTrace on response — is include-trace supported upstream?)';

  const bodyText =
    result.body === undefined
      ? '(empty)'
      : typeof result.body === 'string'
        ? prettyJson(result.body)
        : prettyJson(result.body);

  const nestedBodies: string[] = [];
  if (treeHops) {
    for (const hop of treeHops) {
      if (typeof hop.responseBodyPreview === 'string' && hop.responseBodyPreview) {
        nestedBodies.push(
          `${(hop.method || '?').toUpperCase()} ${hop.url || ''}\n${prettyJson(hop.responseBodyPreview)}`,
        );
      }
    }
  }

  const wireRequestBody =
    typeof options?.requestBody === 'string' && options.requestBody.trim()
      ? tryGraphqlDisplayTextToRequestJson(options.requestBody) ?? options.requestBody
      : undefined;

  const curlText = buildPrettyCurlCommand({
    method: result.method || 'GET',
    url: result.url || '',
    headers: result.requestHeaders || {},
    body: wireRequestBody,
  });

  const authHint =
    result.status === 401 || result.status === 403
      ? '<p class="hint">Hop records often redact auth headers, so a Metro re-call can be unauthorized.</p>'
      : '';

  const sections: string[] = [];
  if (result.error) {
    sections.push(
      sectionHtml('sec-error', 'Error', result.error, { error: true, lang: 'plain' }),
    );
  }
  sections.push(sectionHtml('sec-curl', 'curl (include-trace)', curlText, { lang: 'curl' }));
  if (captured) {
    sections.push(
      sectionHtml('sec-captured', 'Captured hops (before re-call)', captured, {
        lang: 'plain',
      }),
    );
  }
  sections.push(
    sectionHtml('sec-trace', 'mockifyerTrace', treeSection, {
      lang: treeHops ? 'plain' : 'json',
    }),
  );
  sections.push(
    sectionHtml('sec-body', 'Response body', bodyText, {
      lang: 'json',
      after: authHint,
    }),
  );
  if (nestedBodies.length > 0) {
    sections.push(
      sectionHtml(
        'sec-nested',
        'Nested hop body previews',
        nestedBodies.join('\n\n—\n\n'),
        { lang: 'json' },
      ),
    );
  }
  sections.push(
    sectionHtml(
      'sec-headers',
      'Request headers sent',
      prettyJson(result.requestHeaders || {}),
      { lang: 'json' },
    ),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
:root {
  --bg: #f3f0e8;
  --panel: #fffdf8;
  --ink: #1c1914;
  --muted: #6b6458;
  --line: #d9d2c4;
  --ok: #1f6b3a;
  --bad: #9b2c2c;
  --accent: #0f6b5c;
  --accent-soft: #d8efe9;
  --mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  --sans: "IBM Plex Sans", "Source Sans 3", "Segoe UI", sans-serif;
}
html[data-theme="dark"] {
  --bg: #050805;
  --panel: #0a120c;
  --ink: #c8ffd4;
  --muted: #5e8f6a;
  --line: #1a3d24;
  --ok: #5dff9a;
  --bad: #ff6b6b;
  --accent: #5dff9a;
  --accent-soft: #0d2818;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  line-height: 1.45;
}
header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
header .top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin: 0 0 0.35rem;
}
header h1 {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  font-family: var(--mono);
}
header .nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  font-family: var(--mono);
  font-size: 0.8rem;
}
header .nav a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}
header .nav a:hover { text-decoration: underline; }
header .nav button {
  font: inherit;
  font-family: var(--mono);
  font-size: 0.78rem;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--ink);
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  cursor: pointer;
}
header .nav button:hover { border-color: var(--accent); color: var(--accent); }
header .nav button.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
header .meta {
  margin: 0;
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--muted);
  word-break: break-all;
}
header .meta .status { font-weight: 700; }
header .meta .status.ok { color: var(--ok); }
header .meta .status.bad { color: var(--bad); }
main { padding: 1rem 1.25rem 2rem; max-width: 1100px; }
section {
  margin: 0 0 1.25rem;
  padding: 0.85rem 1rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
}
.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0 0 0.6rem;
}
section h2 {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 650;
}
.copy-btn {
  font: inherit;
  font-family: var(--mono);
  font-size: 0.72rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  border-radius: 6px;
  padding: 0.25rem 0.55rem;
  cursor: pointer;
}
.copy-btn:hover { border-color: var(--accent); color: var(--accent); }
.copy-btn.copied { border-color: var(--ok); color: var(--ok); }
pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--mono);
  font-size: 0.8rem;
}
${ATLAS_CODE_HIGHLIGHT_CSS}
.hint { color: var(--muted); font-size: 0.85rem; margin: 0.75rem 0 0; }
.error { color: var(--bad); }
</style>
</head>
<body>
<header>
  <div class="top">
    <h1>Mockifyer Atlas · include-trace</h1>
    <nav class="nav" aria-label="Mockifyer links">
      <a href="${atlasLiveUrl}">Atlas live</a>
      <a href="${dashboardUrl}" target="_blank" rel="noopener">Dashboard</a>
      <button type="button" id="btn-dark" title="Toggle dark mode (n)">Dark mode</button>
    </nav>
  </div>
  <p class="meta"><span class="status ${statusClass}">${escapeHtml(meta)}</span></p>
</header>
<main>
${sections.join('\n')}
</main>
<script>
(function () {
  var THEME_KEY = ${JSON.stringify(TRACE_PAGE_THEME_KEY)};
  var btnDark = document.getElementById("btn-dark");

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function applyTheme(theme) {
    var next = theme === "dark" ? "dark" : "";
    if (next) document.documentElement.setAttribute("data-theme", next);
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem(THEME_KEY, next || "default"); } catch (e) {}
    if (btnDark) {
      if (next) btnDark.classList.add("on");
      else btnDark.classList.remove("on");
      btnDark.setAttribute("aria-pressed", next ? "true" : "false");
    }
  }
  function toggleDark() {
    applyTheme(isDark() ? "default" : "dark");
  }
  try {
    var stored = localStorage.getItem(THEME_KEY);
    applyTheme(stored === "dark" || stored === "hacker" ? "dark" : "default");
  } catch (e) {
    applyTheme("default");
  }
  if (btnDark) btnDark.addEventListener("click", toggleDark);
  document.addEventListener("keydown", function (e) {
    if (e.key === "n" || e.key === "N") {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      e.preventDefault();
      toggleDark();
    }
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "readonly");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy rejected"));
      } catch (err) {
        reject(err);
      }
    });
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var id = t.getAttribute("data-copy-target");
    if (!id) return;
    e.preventDefault();
    var pre = document.getElementById(id);
    if (!pre) return;
    var text = pre.textContent || "";
    copyText(text).then(
      function () {
        t.classList.add("copied");
        var prev = t.textContent;
        t.textContent = "Copied";
        setTimeout(function () {
          t.classList.remove("copied");
          t.textContent = prev || "Copy";
        }, 1200);
      },
      function () {
        t.textContent = "Copy failed";
      }
    );
  });
})();
</script>
</body>
</html>`;
}
