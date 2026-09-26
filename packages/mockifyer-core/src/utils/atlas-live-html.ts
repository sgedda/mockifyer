/**
 * Self-contained live Atlas hop stream page for Metro.
 *
 * Served at `GET /mockifyer-atlas-live` (same origin as
 * `/mockifyer-network-events/stream`) so EventSource needs no CORS.
 * Mirrors the terminal CLI expand/collapse nesting model.
 */

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
  --ink: #1c1914;
  --muted: #6b6458;
  --line: #d9d2c4;
  --accent: #0f6b5c;
  --accent-soft: #d8efe9;
  --err: #9b2c2c;
  --warn: #8a5a00;
  --ok: #1f6b3a;
  --mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  --sans: "IBM Plex Sans", "Source Sans 3", "Segoe UI", sans-serif;
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
.brand span { color: var(--accent); }
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
button:hover { border-color: var(--accent); color: var(--accent); }
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
.row:hover { background: rgba(15, 107, 92, 0.06); }
.row.selected { background: rgba(15, 107, 92, 0.12); outline: 1px solid var(--accent); }
.row.tracing { opacity: 0.7; }
.main { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ts { color: var(--muted); }
.method { font-weight: 600; }
.status-code.ok { color: var(--ok); }
.status-code.bad { color: var(--err); }
.source { color: var(--muted); }
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
  background: rgba(15, 107, 92, 0.08);
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
  background: #faf7f0;
  color: var(--ink);
  max-height: 220px;
  overflow: auto;
}
#analyze.show { display: block; }
kbd {
  font-family: var(--mono);
  font-size: 0.72rem;
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 0 0.28rem;
  background: #fff;
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
      <p class="sub">Live hop stream from Metro — same SSE as <code>mockifyer-atlas</code>. Click ▸ nested rows to expand/collapse. <strong>trace</strong> re-calls that hop with <code>X-Mockifyer-Include-Trace</code>.</p>
    </div>
    <div class="toolbar" role="toolbar" aria-label="Atlas controls">
      <button type="button" id="btn-expand" title="Expand or collapse all nested groups (e)">Expand all</button>
      <button type="button" id="btn-pause" title="Pause / resume live hops (p / Space)">Pause</button>
      <button type="button" id="btn-errors" title="Errors only (f)">Errors</button>
      <button type="button" id="btn-dedupe" class="on" title="Collapse duplicate consecutive roots (d)">Dedupe</button>
      <button type="button" id="btn-analyze" title="Analyze buffer (a)">Analyze</button>
      <button type="button" id="btn-clear" title="Clear Metro hop buffer (c)">Clear</button>
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
  var stickToBottom = true;
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

  function duplicateKey(ev) {
    return [
      (ev.method || "").toUpperCase(),
      ev.path || ev.url || "",
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

  function tsOf(ev) {
    return ev.timestamp ? String(ev.timestamp).slice(11, 23) : "--:--:--.---";
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
        ? '<span class="tree">' + (isLast ? "└─ " : "├─ ") + "</span>"
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
      '<a href="' + hopOpenUrl(ev, "req") + '" target="_blank" rel="noopener">req</a>' +
      '<a href="' + hopOpenUrl(ev, "res") + '" target="_blank" rel="noopener">res</a>' +
      '<a href="' + hopOpenUrl(ev, "html") + '" target="_blank" rel="noopener">html</a>' +
      '<a href="#" class="trace-link" data-trace-id="' + esc(hopId) + '" title="Re-call with X-Mockifyer-Include-Trace">trace</a>' +
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
      '<span class="path">' + esc(ev.path || ev.url || "/") + "</span>" +
      badges +
      "</div>" +
      links +
      "</div>"
    );
  }

  function collapseSummaryHtml(parentId, children) {
    var n = children.length;
    var errors = 0;
    var slow = 0;
    var totalMs = 0;
    for (var i = 0; i < n; i++) {
      var c = children[i];
      if (isErrorHop(c)) errors += 1;
      if (isSlowHop(c)) slow += 1;
      if (typeof c.durationMs === "number") totalMs += c.durationMs;
    }
    var parts = [n + " nested"];
    if (errors) parts.push(errors + " err");
    if (slow) parts.push(slow + " slow");
    if (totalMs > 0) parts.push(Math.round(totalMs) + "ms");
    return (
      '<div class="summary" data-parent="' + esc(parentId) + '" role="button" tabindex="0" title="Expand nested hops">' +
      '<span class="tree">│  └─ </span><span class="glyph">▸</span> ' +
      esc(parts.join(" · ")) +
      ' <span class="badge">· click expand</span>' +
      "</div>"
    );
  }

  function expandFooterHtml(parentId, childCount) {
    return (
      '<div class="footer" data-parent="' + esc(parentId) + '" role="button" tabindex="0" title="Collapse nested hops">' +
      '<span class="tree">│  └─ </span><span class="glyph">▾</span> ' +
      esc(childCount + " nested · click collapse") +
      "</div>"
    );
  }

  function childrenBlockHtml(parentId, children) {
    if (!children.length) return "";
    if (!isParentExpanded(parentId)) {
      return collapseSummaryHtml(parentId, children);
    }
    var visible = visibleChildren(children);
    var html = expandFooterHtml(parentId, children.length);
    for (var i = 0; i < visible.length; i++) {
      html += hopRowHtml(visible[i], {
        depth: 1,
        isLast: i === visible.length - 1,
      });
    }
    return html;
  }

  function render() {
    var html = "";
    var r = 0;
    while (r < rootOrder.length) {
      var rootId = rootOrder[r];
      var event = eventsByRequestId.get(rootId);
      if (!event) {
        r += 1;
        continue;
      }
      var children = childrenByParent.get(rootId) || [];
      if (errorsOnly) {
        if (!isErrorHop(event) && !children.some(isErrorHop)) {
          r += 1;
          continue;
        }
      }

      var key = duplicateKey(event);
      var streakCount = 1;
      var streakEvent = event;
      var streakRootId = rootId;
      var streakChildren = children;

      if (collapseDuplicates && children.length === 0) {
        var j = r + 1;
        while (j < rootOrder.length) {
          var nextId = rootOrder[j];
          var nextEv = eventsByRequestId.get(nextId);
          if (!nextEv) break;
          var nextChildren = childrenByParent.get(nextId) || [];
          if (nextChildren.length) break;
          if (errorsOnly && !isErrorHop(nextEv)) break;
          if (duplicateKey(nextEv) !== key) break;
          streakCount += 1;
          streakEvent = nextEv;
          streakRootId = nextId;
          streakChildren = nextChildren;
          j += 1;
        }
        r = j;
      } else {
        r += 1;
      }

      html += hopRowHtml(streakEvent, {
        repeatSuffix: streakCount > 1 ? "×" + streakCount : "",
      });
      if (streakChildren.length) {
        html += childrenBlockHtml(streakRootId, streakChildren);
      }
    }

    if (!html) {
      html =
        '<div class="empty">Waiting for hops… open the app with Atlas capture, or keep this tab open while traffic flows.</div>';
    }
    var nearBottom =
      hopsEl.scrollHeight - hopsEl.scrollTop - hopsEl.clientHeight < 48;
    hopsEl.innerHTML = html;
    if (stickToBottom || nearBottom) {
      hopsEl.scrollTop = hopsEl.scrollHeight;
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
      ' · <kbd>e</kbd> all · <kbd>p</kbd> pause · <kbd>f</kbd> errors · <kbd>d</kbd> dedupe · <kbd>c</kbd> clear';
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
      rootOrder.push(rid);
      if (rootOrder.length > MAX_ROOTS) {
        rootOrder.splice(0, rootOrder.length - MAX_ROOTS);
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

  function runTraceReplay(hopId) {
    if (!hopId) return;
    selectedHopId = hopId;
    tracingHopId = hopId;
    render();
    analyzeEl.textContent = "Re-calling hop with X-Mockifyer-Include-Trace…";
    analyzeEl.classList.add("show");
    var url = TRACE_PATH + "?id=" + encodeURIComponent(hopId);
    fetch(url, { cache: "no-store" })
      .then(function (r) {
        return r.json().then(function (json) {
          return { ok: r.ok, json: json };
        });
      })
      .then(function (result) {
        tracingHopId = "";
        var json = result.json;
        var lines = [];
        lines.push(
          (json.success ? "OK" : "FAIL") +
            "  " +
            (json.method || "") +
            "  " +
            (json.url || "") +
            (json.status != null ? "  → " + json.status : "") +
            (json.durationMs != null ? "  " + json.durationMs + "ms" : "")
        );
        lines.push("headers: " + JSON.stringify(json.requestHeaders || {}, null, 2));
        if (json.error) lines.push("error: " + json.error);
        if (json.mockifyerTrace) {
          lines.push("mockifyerTrace:");
          lines.push(JSON.stringify(json.mockifyerTrace, null, 2));
        } else {
          lines.push("(no mockifyerTrace on response — is include-trace supported upstream?)");
        }
        lines.push("body:");
        lines.push(
          typeof json.body === "string"
            ? json.body
            : JSON.stringify(json.body, null, 2)
        );
        analyzeEl.textContent = lines.join("\n");
        analyzeEl.classList.add("show");
        render();
      })
      .catch(function (err) {
        tracingHopId = "";
        analyzeEl.textContent = String(err && err.message ? err.message : err);
        analyzeEl.classList.add("show");
        render();
      });
  }

  hopsEl.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== hopsEl) {
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
    stickToBottom =
      hopsEl.scrollHeight - hopsEl.scrollTop - hopsEl.clientHeight < 48;
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
        analyzeEl.textContent = JSON.stringify(a, null, 2);
        analyzeEl.classList.add("show");
      })
      .catch(function (err) {
        analyzeEl.textContent = String(err && err.message ? err.message : err);
        analyzeEl.classList.add("show");
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
