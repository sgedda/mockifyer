/**
 * Self-contained live Atlas hop stream page for Metro.
 *
 * Served at `GET /mockifyer-atlas-live` (same origin as
 * `/mockifyer-network-events/stream`) so EventSource needs no CORS.
 * Root hops are newest-first (Metro buffer order); nested children stay
 * chronological under their parent. Saved Atlas HTML is unchanged (chrono).
 */

import {
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
} from './inline-trace';
import {
  ATLAS_CODE_HIGHLIGHT_CSS,
  atlasSyntaxHighlightInlineScript,
} from './atlas-syntax-highlight';

export const ATLAS_LIVE_STREAM_PATH = '/mockifyer-atlas-live';

export interface BuildAtlasLiveStreamHtmlOptions {
  /** Page title. Default `Mockifyer Atlas · live`. */
  title?: string;
  /**
   * SSE path relative to the page origin.
   * Default `/mockifyer-network-events/stream`.
   */
  streamPath?: string;
  /** Whether to request backlog on connect. Default true. */
  backlog?: boolean;
  /** Clear-buffer POST path. Default `/mockifyer-network-events/clear`. */
  clearPath?: string;
  /** Analyze GET path. Default `/mockifyer-network-events/analyze`. */
  analyzePath?: string;
  /**
   * Trace-replay GET path (appends `?id=`).
   * Default `/mockifyer-atlas-trace`.
   */
  tracePath?: string;
}

/**
 * Build the live Atlas HTML document (inline CSS + JS).
 * Safe to serve as `text/html` from Metro middleware.
 */
export function buildAtlasLiveStreamHtml(
  options?: BuildAtlasLiveStreamHtmlOptions,
): string {
  const title = escapeHtml(options?.title?.trim() || 'Mockifyer Atlas · live');
  const streamPath = options?.streamPath?.trim() || '/mockifyer-network-events/stream';
  const clearPath = options?.clearPath?.trim() || '/mockifyer-network-events/clear';
  const analyzePath = options?.analyzePath?.trim() || '/mockifyer-network-events/analyze';
  const tracePath = options?.tracePath?.trim() || '/mockifyer-atlas-trace';
  const includeTraceHeader = MOCKIFYER_INCLUDE_TRACE_HEADER;
  const includeTraceBodiesHeader = MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER;
  const backlog = options?.backlog !== false;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
:root {
  --bg: #f3f0e8;
  --bg-panel: #fffdf8;
  --bg-analyze: #faf7f0;
  --bg-kbd: #fff;
  --ink: #1c1914;
  --muted: #6b6458;
  --line: #d9d2c4;
  --accent: #0f6b5c;
  --accent-soft: #d8efe9;
  --err: #9b2c2c;
  --warn: #8a5a00;
  --ok: #1f6b3a;
  --row-hover: rgba(15, 107, 92, 0.06);
  --row-selected: rgba(15, 107, 92, 0.12);
  --glow: transparent;
  --scan: transparent;
  --mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  --sans: "IBM Plex Sans", "Source Sans 3", "Segoe UI", sans-serif;
}
html[data-theme="dark"] {
  --bg: #050805;
  --bg-panel: #0a120c;
  --bg-analyze: #07100a;
  --bg-kbd: #0d1a10;
  --ink: #c8ffd4;
  --muted: #5e8f6a;
  --line: #1a3d24;
  --accent: #39ff14;
  --accent-soft: #12351a;
  --err: #ff4d6d;
  --warn: #ffd60a;
  --ok: #39ff14;
  --row-hover: rgba(57, 255, 20, 0.08);
  --row-selected: rgba(57, 255, 20, 0.16);
  --glow: rgba(57, 255, 20, 0.18);
  --scan: repeating-linear-gradient(
    0deg,
    transparent 0,
    transparent 2px,
    rgba(0, 0, 0, 0.18) 2px,
    rgba(0, 0, 0, 0.18) 3px
  );
  --sans: var(--mono);
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  height: 100%;
  background:
    radial-gradient(1200px 500px at 10% -10%, #e7f4ef 0%, transparent 55%),
    radial-gradient(900px 420px at 100% 0%, #f7e9d8 0%, transparent 50%),
    var(--bg);
  color: var(--ink);
  font-family: var(--sans);
}
html[data-theme="dark"],
html[data-theme="dark"] body {
  background:
    var(--scan),
    radial-gradient(900px 480px at 12% -8%, rgba(57, 255, 20, 0.12) 0%, transparent 55%),
    radial-gradient(700px 380px at 100% 0%, rgba(0, 80, 40, 0.35) 0%, transparent 50%),
    var(--bg);
  text-shadow: 0 0 12px var(--glow);
}
body {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.25rem 1rem 2rem;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
}
.brand {
  font-family: var(--mono);
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}
html[data-theme="dark"] .brand {
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.brand span { color: var(--accent); }
html[data-theme="dark"] .brand span {
  text-shadow: 0 0 18px var(--glow);
}
.sub {
  color: var(--muted);
  font-size: 0.92rem;
  max-width: 38rem;
  line-height: 1.35;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
button, .chip {
  font: inherit;
  font-family: var(--mono);
  font-size: 0.78rem;
  border: 1px solid var(--line);
  background: var(--bg-panel);
  color: var(--ink);
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
}
html[data-theme="dark"] button,
html[data-theme="dark"] .chip {
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px transparent;
}
button:hover { border-color: var(--accent); color: var(--accent); }
html[data-theme="dark"] button:hover {
  box-shadow: 0 0 12px var(--glow);
}
button.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
button:disabled { opacity: 0.45; cursor: default; }
.status {
  font-family: var(--mono);
  font-size: 0.78rem;
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.85rem;
}
.status .live { color: var(--ok); font-weight: 600; }
.status .paused { color: var(--warn); font-weight: 600; }
.status .err { color: var(--err); }
.panel {
  background: var(--bg-panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  flex: 1;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 0 rgba(28, 25, 20, 0.04);
}
html[data-theme="dark"] .panel {
  border-radius: 2px;
  box-shadow: 0 0 24px rgba(57, 255, 20, 0.06), inset 0 0 40px rgba(0, 0, 0, 0.35);
}
#hops {
  font-family: var(--mono);
  font-size: 0.78rem;
  line-height: 1.45;
  margin: 0;
  padding: 0.65rem 0.75rem 1rem;
  overflow: auto;
  flex: 1;
  white-space: pre;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: baseline;
  padding: 0.12rem 0.2rem;
  border-radius: 4px;
}
html[data-theme="dark"] .row { border-radius: 0; }
.row:hover { background: var(--row-hover); }
.row.selected { background: var(--row-selected); outline: 1px solid var(--accent); }
.row.tracing { opacity: 0.7; }
.main { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ts { color: var(--muted); }
.method { font-weight: 600; }
.status-code.ok { color: var(--ok); }
.status-code.bad { color: var(--err); }
.source { color: var(--muted); }
.host { color: var(--accent); }
.path { color: var(--ink); }
.badge {
  display: inline-block;
  margin-left: 0.35rem;
  font-size: 0.72rem;
  color: var(--muted);
}
.badge.err { color: var(--err); }
.badge.warn { color: var(--warn); }
.badge.repeat { color: var(--accent); font-weight: 600; }
.tree { color: var(--muted); }
.links a {
  color: var(--accent);
  text-decoration: none;
  margin-left: 0.45rem;
}
.links a:hover { text-decoration: underline; }
.summary, .footer {
  cursor: pointer;
  color: var(--muted);
  user-select: none;
  padding: 0.12rem 0.2rem;
  border-radius: 4px;
}
.summary:hover, .footer:hover {
  background: var(--row-hover);
  color: var(--accent);
}
.glyph { font-weight: 700; }
.empty {
  color: var(--muted);
  padding: 1.5rem 0.5rem;
}
#analyze {
  display: none;
  font-family: var(--mono);
  font-size: 0.78rem;
  white-space: pre-wrap;
  margin: 0;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--line);
  background: var(--bg-analyze);
  color: var(--ink);
  max-height: 220px;
  overflow: auto;
}
#analyze.show { display: block; }
${ATLAS_CODE_HIGHLIGHT_CSS}
kbd {
  font-family: var(--mono);
  font-size: 0.72rem;
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 0 0.28rem;
  background: var(--bg-kbd);
}
@media (max-width: 640px) {
  .row { grid-template-columns: 1fr; }
  .links { padding-left: 1rem; }
}
</style>
</head>
<body>
<div class="shell">
  <header>
    <div>
      <div class="brand">Mockifyer <span>Atlas</span></div>
      <p class="sub">Live hop stream from Metro — newest roots first (same SSE as <code>mockifyer-atlas</code>). Click ▸ rows to expand/collapse that level; nesting goes all the way down. <strong>curl</strong> (root hops) copies a runnable command with include-trace headers. <strong>trace</strong> re-calls that hop with <code>X-Mockifyer-Include-Trace</code> in a new tab. Use <strong>Dark mode</strong> (or <kbd>n</kbd>) for the dark theme.</p>
    </div>
    <div class="toolbar" role="toolbar" aria-label="Atlas controls">
      <button type="button" id="btn-expand" title="Expand or collapse all nested groups (e)">Expand all</button>
      <button type="button" id="btn-pause" title="Pause / resume live hops (p / Space)">Pause</button>
      <button type="button" id="btn-errors" title="Errors only (f)">Errors</button>
      <button type="button" id="btn-dedupe" class="on" title="Group duplicate consecutive hops at every level (d)">Dedupe</button>
      <button type="button" id="btn-analyze" title="Analyze buffer (a)">Analyze</button>
      <button type="button" id="btn-clear" title="Clear Metro hop buffer (c)">Clear</button>
      <button type="button" id="btn-dark" title="Toggle dark mode (n)" aria-pressed="false">Dark mode</button>
    </div>
  </header>
  <div class="status" id="status" aria-live="polite"></div>
  <div class="panel">
    <div id="hops" role="log" aria-relevant="additions"></div>
    <pre id="analyze"></pre>
  </div>
</div>
<script>
(function () {
  "use strict";

  var STREAM_PATH = ${JSON.stringify(streamPath)};
  var CLEAR_PATH = ${JSON.stringify(clearPath)};
  var ANALYZE_PATH = ${JSON.stringify(analyzePath)};
  var TRACE_PATH = ${JSON.stringify(tracePath)};
  var INCLUDE_TRACE_HEADER = ${JSON.stringify(includeTraceHeader)};
  var INCLUDE_TRACE_BODIES_HEADER = ${JSON.stringify(includeTraceBodiesHeader)};
  var BACKLOG = ${backlog ? "true" : "false"};
  var SLOW_MS = 3000;
  var MAX_ROOTS = 200;

  var hopsEl = document.getElementById("hops");
  var statusEl = document.getElementById("status");
  var analyzeEl = document.getElementById("analyze");
  var btnExpand = document.getElementById("btn-expand");
  var btnPause = document.getElementById("btn-pause");
  var btnErrors = document.getElementById("btn-errors");
  var btnDedupe = document.getElementById("btn-dedupe");
  var btnAnalyze = document.getElementById("btn-analyze");
  var btnClear = document.getElementById("btn-clear");
  var btnDark = document.getElementById("btn-dark");

  ${atlasSyntaxHighlightInlineScript()}

  var NL = String.fromCharCode(10);
  var THEME_KEY = "mockifyer-atlas-live-theme";
  var eventsByRequestId = new Map();
  var childrenByParent = new Map();
  var rootOrder = [];
  var expandOverride = new Map();
  var collapseChildren = true;
  var collapseDuplicates = true;
  var errorsOnly = false;
  var paused = false;
  var skippedWhilePaused = 0;
  var streamState = "connecting";
  var streamError = "";
  /** Follow live updates at the top (newest roots land first). */
  var stickToTop = true;
  var selectedHopId = "";
  var tracingHopId = "";
  var es = null;

  function requestIdOf(ev) {
    var id = (ev.requestId && String(ev.requestId).trim()) || ev.id;
    return id || "";
  }

  function parentIdOf(ev) {
    return (ev.parentRequestId && String(ev.parentRequestId).trim()) || "";
  }

  function isErrorHop(ev) {
    if (ev.source === "error" || ev.source === "blocked") return true;
    if (ev.kind === "incident") return true;
    if (typeof ev.status === "number" && ev.status >= 400) return true;
    var flags = ev.anomalyFlags || [];
    for (var i = 0; i < flags.length; i++) {
      var f = flags[i];
      if (
        f === "http_error_status" ||
        f === "network_error" ||
        f === "graphql_errors" ||
        (typeof f === "string" && f.indexOf("error") >= 0)
      ) {
        return true;
      }
    }
    return false;
  }

  function isSlowHop(ev) {
    if (typeof ev.durationMs === "number" && ev.durationMs >= SLOW_MS) return true;
    var flags = ev.anomalyFlags || [];
    return flags.indexOf("slow_response") >= 0;
  }

  function firstScreen(usage) {
    if (!usage) return "";
    if (Array.isArray(usage)) {
      for (var i = 0; i < usage.length; i++) {
        var s = usage[i] && usage[i].screen;
        if (s && String(s).trim()) return String(s).trim();
      }
      return "";
    }
    return (usage.screen && String(usage.screen).trim()) || "";
  }

  /** Domain for the hop — falls back to parsing the URL when host is absent. */
  function hostOf(ev) {
    var host = (ev.host && String(ev.host).trim()) || "";
    if (host) return host;
    var url = (ev.url && String(ev.url).trim()) || "";
    if (!url) return "";
    var m = url.match(/^[a-z][a-z0-9+.-]*:\\/\\/([^/?#]+)/i);
    return m ? m[1] : "";
  }

  /** Path + query for list rows (pathname alone drops GET params). */
  function pathWithQuery(ev) {
    var path = (ev.path && String(ev.path)) || "";
    var query = (ev.query && String(ev.query).trim()) || "";
    if (path) {
      if (!query) return path;
      return path + (query.charAt(0) === "?" ? query : "?" + query);
    }
    return hopUrl(ev) || "/";
  }

  /** Full hop URL for curl / links — merge event.query when url lost params. */
  function hopUrl(ev) {
    var url = (ev.url && String(ev.url).trim()) || "";
    var query = (ev.query && String(ev.query).trim()) || "";
    if (url && query && url.indexOf("?") === -1) {
      var q = query.charAt(0) === "?" ? query.slice(1) : query;
      return q ? url + "?" + q : url;
    }
    if (url) return url;
    var path = (ev.path && String(ev.path)) || "";
    if (path && query) {
      return path + (query.charAt(0) === "?" ? query : "?" + query);
    }
    return path || "";
  }

  function duplicateKey(ev) {
    return [
      (ev.method || "").toUpperCase(),
      hostOf(ev),
      pathWithQuery(ev),
      ev.status == null ? "" : String(ev.status),
      ev.source || "",
    ].join("|");
  }

  function isParentExpanded(parentId) {
    if (expandOverride.has(parentId)) return expandOverride.get(parentId);
    return collapseChildren === false;
  }

  function visibleChildren(children) {
    if (!errorsOnly) return children;
    return children.filter(isErrorHop);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += " ";
    return s;
  }

  /** Pad or ellipsize to a fixed width so the monospace columns stay aligned. */
  function fit(s, n) {
    s = String(s == null ? "" : s);
    if (s.length > n) return s.slice(0, n - 1) + "…";
    return pad(s, n);
  }

  function tsOf(ev) {
    if (!ev.timestamp) return "--:--:--.---";
    var d = new Date(ev.timestamp);
    if (isNaN(d.getTime())) {
      return String(ev.timestamp).slice(11, 23) || String(ev.timestamp);
    }
    function pad2(n) {
      return n < 10 ? "0" + n : String(n);
    }
    function pad3(n) {
      if (n < 10) return "00" + n;
      if (n < 100) return "0" + n;
      return String(n);
    }
    // Browser local timezone (not UTC slice of the ISO string).
    return (
      pad2(d.getHours()) +
      ":" +
      pad2(d.getMinutes()) +
      ":" +
      pad2(d.getSeconds()) +
      "." +
      pad3(d.getMilliseconds())
    );
  }

  function statusText(ev, err) {
    if (ev.status != null) return String(ev.status);
    return ev.source === "error" ? "ERR" : "-";
  }

  function msText(ev) {
    if (typeof ev.durationMs === "number" && isFinite(ev.durationMs)) {
      return Math.round(ev.durationMs) + "ms";
    }
    return "-";
  }

  function hopOpenUrl(ev, side) {
    var id = encodeURIComponent(ev.id || requestIdOf(ev));
    return "/mockifyer-atlas-open?id=" + id + "&side=" + side;
  }

  /** Only show req/res when this hop carries a preview or spill ref. */
  function hopHasBody(ev, side) {
    if (!ev) return false;
    if (side === "req") {
      return !!(
        (typeof ev.requestBodyPreview === "string" && ev.requestBodyPreview) ||
        (typeof ev.requestBodyRef === "string" && ev.requestBodyRef)
      );
    }
    return !!(
      (typeof ev.responseBodyPreview === "string" && ev.responseBodyPreview) ||
      (typeof ev.responseBodyRef === "string" && ev.responseBodyRef)
    );
  }

  // POSIX single-quote escape: close, add an escaped quote, reopen.
  var SQ_ESCAPE = "'" + String.fromCharCode(92) + "''";

  function shellQuote(value) {
    return "'" + String(value == null ? "" : value).split("'").join(SQ_ESCAPE) + "'";
  }

  function looksJsonText(text) {
    var t = String(text == null ? "" : text).trim();
    return (
      (t.charAt(0) === "{" && t.charAt(t.length - 1) === "}") ||
      (t.charAt(0) === "[" && t.charAt(t.length - 1) === "]")
    );
  }

  /**
   * Curl for a root hop. Nested hops usually lack outbound headers, so the
   * link is hidden there. Always stamps include-trace so a pasted curl can
   * return mockifyerTrace like the live-page trace action.
   * @param bodyOverride full request body when resolved from spill (avoids truncated preview)
   */
  function curlCommandFor(ev, bodyOverride) {
    if (!ev) return "";
    var method = (ev.method || "GET").toUpperCase();
    var url = hopUrl(ev) || pathWithQuery(ev) || "";
    var parts = ["curl -i -X " + method + " " + shellQuote(url)];

    var headers = Object.assign({}, ev.requestHeaders || {});
    if (!hasHeaderName(headers, INCLUDE_TRACE_HEADER)) {
      headers[INCLUDE_TRACE_HEADER] = "1";
    }
    if (!hasHeaderName(headers, INCLUDE_TRACE_BODIES_HEADER)) {
      headers[INCLUDE_TRACE_BODIES_HEADER] = "1";
    }

    var names = Object.keys(headers);
    var hasContentType = false;
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (String(name).toLowerCase() === "content-type") hasContentType = true;
      parts.push("-H " + shellQuote(name + ": " + headers[name]));
    }

    var body =
      typeof bodyOverride === "string" ? bodyOverride : ev.requestBodyPreview;
    if (body && method !== "GET" && method !== "HEAD") {
      if (!hasContentType) {
        parts.push(
          "-H " +
            shellQuote(
              "content-type: " +
                (looksJsonText(body) ? "application/json" : "text/plain")
            )
        );
      }
      parts.push("--data-raw " + shellQuote(body));
    }
    return parts.join(" ");
  }

  function hasHeaderName(headers, name) {
    var want = String(name).toLowerCase();
    var keys = Object.keys(headers || {});
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i]).toLowerCase() === want) return true;
    }
    return false;
  }

  /** True when the hop preview is truncated or a full spill ref exists. */
  function requestBodyNeedsFullFetch(ev) {
    if (!ev) return false;
    if (typeof ev.requestBodyRef === "string" && ev.requestBodyRef) return true;
    if (ev.requestBodyTruncated === true) return true;
    var preview = typeof ev.requestBodyPreview === "string" ? ev.requestBodyPreview : "";
    return preview.indexOf("[truncated]") !== -1;
  }

  /**
   * Prefer the spilled full request body for curl; fall back to the hop preview.
   */
  function resolveCurlRequestBody(ev) {
    var method = ((ev && ev.method) || "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") {
      return Promise.resolve("");
    }
    var preview =
      typeof ev.requestBodyPreview === "string" ? ev.requestBodyPreview : "";
    if (!requestBodyNeedsFullFetch(ev)) {
      return Promise.resolve(wireSafeCurlBody(preview));
    }
    var openUrl = hopOpenUrl(ev, "req");
    return fetch(openUrl, { cache: "no-store", redirect: "follow" })
      .then(function (r) {
        return r.text().then(function (text) {
          var source = (r.headers.get("X-Mockifyer-Body-Source") || "").toLowerCase();
          if (source === "preview") {
            try {
              var json = JSON.parse(text);
              if (json && typeof json.preview === "string") text = json.preview;
            } catch (e) {
              /* use raw text */
            }
          }
          return wireSafeCurlBody(text);
        });
      })
      .catch(function () {
        return wireSafeCurlBody(preview);
      });
  }

  /**
   * Hop previews may be GraphQL display form (# operationName: …). Convert back
   * to wire JSON so curl / servers accept the body.
   */
  function wireSafeCurlBody(text) {
    if (typeof text !== "string" || !text) return text || "";
    var trimmed = text.trim();
    if (!trimmed) return text;
    try {
      JSON.parse(trimmed);
      return trimmed.charAt(0) === "{" || trimmed.charAt(0) === "["
        ? trimmed
        : text;
    } catch (e) {
      /* fall through — maybe display form */
    }
    var restored = graphqlDisplayToJson(trimmed);
    return restored || text;
  }

  function graphqlDisplayToJson(text) {
    if (!/^(#\\s*operationName:|(query|mutation|subscription)\\b)/.test(text.trim())) {
      return null;
    }
    var lines = text.replace(/\\r\\n/g, String.fromCharCode(10)).split(String.fromCharCode(10));
    var operationName = "";
    var mode = null;
    var queryLines = [];
    var variableLines = [];
    var extensionLines = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var opMatch = line.match(/^#\\s*operationName:\\s*(.+)\\s*$/i);
      if (opMatch) {
        operationName = String(opMatch[1] || "").trim();
        continue;
      }
      if (/^#\\s*Variables\\s*$/i.test(line)) {
        mode = "variables";
        continue;
      }
      if (/^#\\s*Extensions\\s*$/i.test(line)) {
        mode = "extensions";
        continue;
      }
      if (mode === "variables") {
        variableLines.push(line);
        continue;
      }
      if (mode === "extensions") {
        extensionLines.push(line);
        continue;
      }
      if (!mode && queryLines.length === 0 && !String(line).trim()) continue;
      mode = "query";
      queryLines.push(line);
    }
    var query = queryLines.join(String.fromCharCode(10)).trim();
    if (!query) return null;
    var body = { query: query };
    if (operationName) body.operationName = operationName;
    if (variableLines.length) {
      try {
        body.variables = JSON.parse(variableLines.join(String.fromCharCode(10)));
      } catch (err) {
        return null;
      }
    }
    if (extensionLines.length) {
      try {
        body.extensions = JSON.parse(extensionLines.join(String.fromCharCode(10)));
      } catch (err) {
        return null;
      }
    }
    try {
      return JSON.stringify(body);
    } catch (err) {
      return null;
    }
  }

  /** Curl only on roots — nested hops rarely carry a full outbound header set. */
  function hopShowsCurl(ev) {
    return !parentIdOf(ev);
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // http origins / older webviews have no async clipboard.
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

  function copyHopCurl(hopId) {
    var ev = findHopById(hopId);
    if (!ev) {
      setAnalyzeContent("(hop not in the live buffer — nothing to copy)", "plain");
      return;
    }
    selectedHopId = hopId;
    render();
    setAnalyzeContent("resolving full request body for curl…", "plain");
    resolveCurlRequestBody(ev).then(function (body) {
      var cmd = curlCommandFor(ev, body);
      if (!cmd) {
        setAnalyzeContent("(nothing to copy)", "plain");
        return;
      }
      var note =
        requestBodyNeedsFullFetch(ev) &&
        typeof body === "string" &&
        body.indexOf("[truncated]") !== -1
          ? "warning: full body spill missing — curl still uses truncated preview" +
            NL +
            NL
          : "";
      copyTextToClipboard(cmd).then(
        function () {
          setAnalyzeContent(note + "copied curl to clipboard:" + NL + NL + cmd, "curl");
        },
        function () {
          setAnalyzeContent(
            note + "copy failed — select and copy manually:" + NL + NL + cmd,
            "curl"
          );
        }
      );
    });
  }

  function treeIndent(depth, isLast) {
    if (depth <= 0) return "";
    var indent = "";
    for (var d = 1; d < depth; d++) indent += "│  ";
    return indent + (isLast ? "└─ " : "├─ ");
  }

  function hopRowHtml(ev, opts) {
    opts = opts || {};
    var depth = opts.depth || 0;
    var isLast = opts.isLast !== false;
    var repeatSuffix = opts.repeatSuffix || "";
    var err = isErrorHop(ev);
    var slow = isSlowHop(ev);
    var hopId = ev.id || requestIdOf(ev);
    var prefix =
      depth > 0
        ? '<span class="tree">' + esc(treeIndent(depth, isLast)) + "</span>"
        : "";
    var badges = "";
    if (err) badges += '<span class="badge err">ERR</span>';
    if (slow) badges += '<span class="badge warn">SLOW</span>';
    var screen = firstScreen(ev.usage);
    if (screen) badges += '<span class="badge">' + esc(screen) + "</span>";
    if (repeatSuffix) {
      badges += '<span class="badge repeat">' + esc(repeatSuffix) + "</span>";
    }
    var st = statusText(ev, err);
    var stClass = err || (typeof ev.status === "number" && ev.status >= 400)
      ? "bad"
      : "ok";
    var rowClass =
      "row" +
      (err ? " is-err" : "") +
      (slow ? " is-slow" : "") +
      (selectedHopId && hopId === selectedHopId ? " selected" : "") +
      (tracingHopId && hopId === tracingHopId ? " tracing" : "");
    var links =
      '<span class="links">' +
      (hopHasBody(ev, "req")
        ? '<a href="' + hopOpenUrl(ev, "req") + '" target="_blank" rel="noopener">req</a>'
        : "") +
      (hopHasBody(ev, "res")
        ? '<a href="' + hopOpenUrl(ev, "res") + '" target="_blank" rel="noopener">res</a>'
        : "") +
      (hopShowsCurl(ev)
        ? '<a href="#" class="curl-link" data-curl-id="' +
          esc(hopId) +
          '" title="Copy root hop as curl (includes X-Mockifyer-Include-Trace)">curl</a>'
        : "") +
      '<a href="' + TRACE_PATH + '?id=' + encodeURIComponent(hopId) + '&amp;format=html" class="trace-link" data-trace-id="' + esc(hopId) + '" target="_blank" rel="noopener" title="Re-call with X-Mockifyer-Include-Trace and open the result in a new tab">trace</a>' +
      "</span>";
    return (
      '<div class="' + rowClass + '" data-hop-id="' + esc(hopId) + '">' +
      '<div class="main">' +
      prefix +
      '<span class="ts">' + esc(tsOf(ev)) + "</span>  " +
      '<span class="method">' + esc(pad((ev.method || "?").toUpperCase(), 6)) + "</span> " +
      '<span class="status-code ' + stClass + '">' + esc(pad(st, 3)) + "</span>  " +
      '<span class="ts">' + esc(pad(msText(ev), 7)) + "</span>  " +
      '<span class="source">' + esc(pad(ev.source || "", 10)) + "</span>  " +
      '<span class="host">' + esc(fit(hostOf(ev) || "-", 22)) + "</span> " +
      '<span class="path">' + esc(pathWithQuery(ev)) + "</span>" +
      badges +
      "</div>" +
      links +
      "</div>"
    );
  }

  function childrenOf(ev) {
    return childrenByParent.get(requestIdOf(ev)) || [];
  }

  /** Whole subtree size (not just direct children) for collapsed summaries. */
  function countDescendants(ev, guard) {
    guard = guard || {};
    var id = requestIdOf(ev);
    if (!id || guard[id]) return 0;
    guard[id] = true;
    var kids = childrenByParent.get(id) || [];
    var total = kids.length;
    for (var i = 0; i < kids.length; i++) {
      total += countDescendants(kids[i], guard);
    }
    return total;
  }

  function subtreeStats(children) {
    var stats = { total: 0, errors: 0, slow: 0, totalMs: 0, unique: 0 };
    var keys = {};
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      stats.total += 1 + countDescendants(c);
      if (isErrorHop(c)) stats.errors += 1;
      if (isSlowHop(c)) stats.slow += 1;
      if (typeof c.durationMs === "number") stats.totalMs += c.durationMs;
      keys[duplicateKey(c)] = true;
    }
    stats.unique = Object.keys(keys).length;
    return stats;
  }

  function collapseSummaryHtml(parentId, children, depth) {
    var stats = subtreeStats(children);
    var parts = [stats.total + " nested"];
    if (stats.unique > 0 && stats.unique < children.length) {
      parts.push(stats.unique + " unique");
    }
    if (stats.errors) parts.push(stats.errors + " err");
    if (stats.slow) parts.push(stats.slow + " slow");
    if (stats.totalMs > 0) parts.push(Math.round(stats.totalMs) + "ms");
    return (
      '<div class="summary" data-parent="' + esc(parentId) + '" role="button" tabindex="0" title="Expand nested hops">' +
      '<span class="tree">' + esc(treeIndent(depth, true)) + '</span><span class="glyph">▸</span> ' +
      esc(parts.join(" · ")) +
      ' <span class="badge">· click expand</span>' +
      "</div>"
    );
  }

  function expandFooterHtml(parentId, children, depth) {
    var stats = subtreeStats(children);
    return (
      '<div class="footer" data-parent="' + esc(parentId) + '" role="button" tabindex="0" title="Collapse nested hops">' +
      '<span class="tree">' + esc(treeIndent(depth, true)) + '</span><span class="glyph">▾</span> ' +
      esc(stats.total + " nested · click collapse") +
      "</div>"
    );
  }

  /**
   * Render hops at one depth, collapsing consecutive duplicates (same method,
   * path, status and source) that have no children of their own, and recursing
   * into every level so grandchildren are reachable. Each parent keeps its own
   * expand toggle.
   */
  function renderHopList(list, depth) {
    var html = "";
    var i = 0;
    while (i < list.length) {
      var ev = list[i];
      var kids = childrenOf(ev);
      var streakCount = 1;

      if (collapseDuplicates && kids.length === 0) {
        var key = duplicateKey(ev);
        var j = i + 1;
        while (j < list.length) {
          var next = list[j];
          if (childrenOf(next).length) break;
          if (duplicateKey(next) !== key) break;
          streakCount += 1;
          // Keep the first row (newest) — roots are newest-first.
          j += 1;
        }
        i = j;
      } else {
        i += 1;
      }

      html += hopRowHtml(ev, {
        depth: depth,
        isLast: i >= list.length,
        repeatSuffix: streakCount > 1 ? "×" + streakCount : "",
      });
      if (kids.length) {
        html += childrenBlockHtml(requestIdOf(ev), kids, depth + 1);
      }
    }
    return html;
  }

  function childrenBlockHtml(parentId, children, depth) {
    if (!children.length) return "";
    if (!isParentExpanded(parentId)) {
      return collapseSummaryHtml(parentId, children, depth);
    }
    var visible = visibleChildren(children);
    return (
      expandFooterHtml(parentId, children, depth) + renderHopList(visible, depth)
    );
  }

  function render() {
    var roots = [];
    for (var r = 0; r < rootOrder.length; r++) {
      var event = eventsByRequestId.get(rootOrder[r]);
      if (!event) continue;
      if (errorsOnly) {
        var kids = childrenByParent.get(rootOrder[r]) || [];
        if (!isErrorHop(event) && !kids.some(isErrorHop)) continue;
      }
      roots.push(event);
    }

    var html = renderHopList(roots, 0);

    if (!html) {
      html =
        '<div class="empty">Waiting for hops… open the app with Atlas capture, or keep this tab open while traffic flows.</div>';
    }
    var nearTop = hopsEl.scrollTop < 48;
    hopsEl.innerHTML = html;
    if (stickToTop || nearTop) {
      hopsEl.scrollTop = 0;
    }
    updateStatus();
    btnExpand.textContent = collapseChildren ? "Expand all" : "Collapse all";
    btnPause.textContent = paused ? "Resume" : "Pause";
    btnPause.classList.toggle("on", paused);
    btnErrors.classList.toggle("on", errorsOnly);
    btnDedupe.classList.toggle("on", collapseDuplicates);
  }

  function updateStatus() {
    var pauseBit = paused
      ? skippedWhilePaused > 0
        ? "paused · " + skippedWhilePaused + " skipped"
        : "paused"
      : "live";
    var streamBit =
      streamState === "open"
        ? "sse=open"
        : streamState === "connecting"
          ? "sse=connecting"
          : "sse=closed";
    var bits = [
      '<span class="' + (paused ? "paused" : "live") + '">' + pauseBit + "</span>",
      "roots=" + rootOrder.length,
      "hops=" + eventsByRequestId.size,
      collapseChildren ? "collapse=on" : "collapse=off",
      collapseDuplicates ? "dedupe=on" : "dedupe=off",
      errorsOnly ? "errors-only" : "all",
      streamBit,
    ];
    if (streamError) {
      bits.push('<span class="err">' + esc(streamError) + "</span>");
    }
    statusEl.innerHTML =
      bits.join(" · ") +
      ' · newest first · <kbd>e</kbd> all · <kbd>p</kbd> pause · <kbd>f</kbd> errors · <kbd>d</kbd> dedupe · <kbd>c</kbd> clear';
  }

  function ingest(ev) {
    if (!ev || typeof ev !== "object") return;
    if (paused) {
      skippedWhilePaused += 1;
      updateStatus();
      return;
    }
    var rid = requestIdOf(ev);
    if (!rid) return;
    eventsByRequestId.set(rid, ev);
    var parentId = parentIdOf(ev);
    if (parentId) {
      var list = childrenByParent.get(parentId) || [];
      list.push(ev);
      childrenByParent.set(parentId, list);
    } else {
      // Newest roots at the top (SSE backlog is oldest→newest; live hops append).
      rootOrder.unshift(rid);
      if (rootOrder.length > MAX_ROOTS) {
        rootOrder.length = MAX_ROOTS;
      }
    }
    render();
  }

  function toggleParent(parentId) {
    var children = childrenByParent.get(parentId) || [];
    if (!children.length) return;
    expandOverride.set(parentId, !isParentExpanded(parentId));
    render();
  }

  function toggleAllExpanded() {
    var parentIds = [];
    childrenByParent.forEach(function (children, parentId) {
      if (children.length) parentIds.push(parentId);
    });
    var anyCollapsed = parentIds.some(function (id) {
      return !isParentExpanded(id);
    });
    var expandAll = anyCollapsed || parentIds.length === 0;
    collapseChildren = !expandAll;
    expandOverride.clear();
    render();
  }

  function clearLocal() {
    eventsByRequestId.clear();
    childrenByParent.clear();
    rootOrder.length = 0;
    expandOverride.clear();
    skippedWhilePaused = 0;
    analyzeEl.classList.remove("show");
    analyzeEl.textContent = "";
    render();
  }

  function findHopById(hopId) {
    var found = null;
    eventsByRequestId.forEach(function (ev) {
      if (found) return;
      if (ev.id === hopId || requestIdOf(ev) === hopId) found = ev;
    });
    return found;
  }

  function runTraceReplay(hopId) {
    if (!hopId) return;
    selectedHopId = hopId;
    var ev = findHopById(hopId);
    var method = ((ev && ev.method) || "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      var target = (ev && ev.url) || hopId;
      if (
        !window.confirm(
          "Re-call " + method + " " + target + " with include-trace?\\n" +
            "This sends a real request and may change data."
        )
      ) {
        return;
      }
    }

    tracingHopId = hopId;
    render();
    var url =
      TRACE_PATH +
      "?id=" +
      encodeURIComponent(hopId) +
      "&format=html";
    var opened = window.open(url, "_blank", "noopener");
    tracingHopId = "";
    if (!opened) {
      setAnalyzeContent(
        "Popup blocked — allow popups for this origin, or open:" + NL + url,
        "plain"
      );
    }
    render();
  }

  hopsEl.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== hopsEl) {
      if (t.classList && t.classList.contains("curl-link")) {
        e.preventDefault();
        copyHopCurl(t.getAttribute("data-curl-id") || "");
        return;
      }
      if (t.classList && t.classList.contains("trace-link")) {
        e.preventDefault();
        runTraceReplay(t.getAttribute("data-trace-id") || "");
        return;
      }
      if (t.getAttribute && t.getAttribute("data-parent")) {
        e.preventDefault();
        toggleParent(t.getAttribute("data-parent"));
        return;
      }
      if (t.getAttribute && t.getAttribute("data-hop-id")) {
        selectedHopId = t.getAttribute("data-hop-id") || "";
        render();
        return;
      }
      t = t.parentNode;
    }
  });
  hopsEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-parent")) {
      e.preventDefault();
      toggleParent(t.getAttribute("data-parent"));
    }
  });
  hopsEl.addEventListener("scroll", function () {
    stickToTop = hopsEl.scrollTop < 48;
  });

  btnExpand.addEventListener("click", toggleAllExpanded);
  btnPause.addEventListener("click", function () {
    paused = !paused;
    if (!paused) skippedWhilePaused = 0;
    render();
  });
  btnErrors.addEventListener("click", function () {
    errorsOnly = !errorsOnly;
    render();
  });
  btnDedupe.addEventListener("click", function () {
    collapseDuplicates = !collapseDuplicates;
    render();
  });
  btnAnalyze.addEventListener("click", function () {
    fetch(ANALYZE_PATH, { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(function (json) {
        var a = json.analysis || json;
        setAnalyzeContent(JSON.stringify(a, null, 2), "json");
      })
      .catch(function (err) {
        setAnalyzeContent(String(err && err.message ? err.message : err), "plain");
      });
  });
  btnClear.addEventListener("click", function () {
    fetch(CLEAR_PATH, { method: "POST", cache: "no-store" })
      .then(function () {
        clearLocal();
      })
      .catch(function (err) {
        streamError = String(err && err.message ? err.message : err);
        updateStatus();
      });
  });

  function isDarkTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function applyTheme(theme) {
    var next = theme === "dark" ? "dark" : "";
    if (next) {
      document.documentElement.setAttribute("data-theme", next);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem(THEME_KEY, next || "default");
    } catch (err) {}
    if (btnDark) {
      if (next) btnDark.classList.add("on");
      else btnDark.classList.remove("on");
      btnDark.setAttribute("aria-pressed", next ? "true" : "false");
    }
  }

  function toggleDarkTheme() {
    applyTheme(isDarkTheme() ? "default" : "dark");
  }

  try {
    var storedTheme = localStorage.getItem(THEME_KEY);
    // Prefer "dark"; accept legacy "hacker" from earlier builds.
    applyTheme(storedTheme === "dark" || storedTheme === "hacker" ? "dark" : "default");
  } catch (err) {
    applyTheme("default");
  }
  if (btnDark) {
    btnDark.addEventListener("click", toggleDarkTheme);
  }

  document.addEventListener("keydown", function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    var k = e.key;
    if (k === "e" || k === "E") {
      e.preventDefault();
      toggleAllExpanded();
    } else if (k === "p" || k === "P" || k === " ") {
      e.preventDefault();
      paused = !paused;
      if (!paused) skippedWhilePaused = 0;
      render();
    } else if (k === "f" || k === "F") {
      e.preventDefault();
      errorsOnly = !errorsOnly;
      render();
    } else if (k === "d" || k === "D") {
      e.preventDefault();
      collapseDuplicates = !collapseDuplicates;
      render();
    } else if (k === "c" || k === "C") {
      e.preventDefault();
      btnClear.click();
    } else if (k === "a" || k === "A") {
      e.preventDefault();
      btnAnalyze.click();
    } else if (k === "n" || k === "N") {
      e.preventDefault();
      toggleDarkTheme();
    }
  });

  function connect() {
    if (es) {
      try {
        es.close();
      } catch (_) {}
    }
    streamState = "connecting";
    streamError = "";
    updateStatus();
    var url =
      STREAM_PATH + "?backlog=" + (BACKLOG ? "1" : "0");
    es = new EventSource(url);
    es.addEventListener("hello", function () {
      streamState = "open";
      streamError = "";
      updateStatus();
    });
    es.addEventListener("hop", function (msg) {
      streamState = "open";
      try {
        ingest(JSON.parse(msg.data));
      } catch (_) {}
    });
    es.onerror = function () {
      streamState = "closed";
      streamError = "SSE disconnected — is Metro still running?";
      updateStatus();
    };
  }

  render();
  connect();
})();
</script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
