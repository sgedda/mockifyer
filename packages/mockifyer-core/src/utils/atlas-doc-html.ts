/**
 * Self-contained Atlas auto-doc HTML for local browsing (file:// / VS Code).
 * Written on Node capture upserts when {@link setAtlasDocHtmlOutputPath} is set.
 * Interactive: Map (collapse), Trace, Waterfall, Gantt, Journey — embedded hop snapshot.
 * Safe on React Native: `fs`/`path` require is try/caught; writes no-op.
 */

import type { AtlasDocMap, AtlasDocNode, AtlasDocPage } from './atlas-doc';
import type { NetworkEvent } from './network-event-types';

let fs: typeof import('fs') | undefined;
let pathMod: typeof import('path') | undefined;

try {
  fs = require('fs');
  pathMod = require('path');
} catch {
  fs = undefined;
  pathMod = undefined;
}

const HTML_WRITE_DEBOUNCE_MS = 250;
const MAX_HTML_NETWORK_EVENTS = 500;

/** Directory for generated `index.html` + `pages/*.html` (Node only). */
let htmlOutputPath: string | undefined;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingMap: AtlasDocMap | null = null;

/** Recent hops for interactive Trace / Waterfall / Gantt / Journey in HTML. */
const htmlNetworkEvents: NetworkEvent[] = [];

export function setAtlasDocHtmlOutputPath(dir: string | undefined): void {
  const trimmed = dir?.trim();
  htmlOutputPath = trimmed || undefined;
}

export function getAtlasDocHtmlOutputPath(): string | undefined {
  return htmlOutputPath;
}

/** Remember a hop for the next HTML rewrite (no-op when HTML path unset). */
export function rememberAtlasHtmlNetworkEvent(event: NetworkEvent): void {
  if (!htmlOutputPath?.trim()) return;
  htmlNetworkEvents.unshift(event);
  if (htmlNetworkEvents.length > MAX_HTML_NETWORK_EVENTS) {
    htmlNetworkEvents.length = MAX_HTML_NETWORK_EVENTS;
  }
}

export function getAtlasHtmlNetworkEvents(): readonly NetworkEvent[] {
  return htmlNetworkEvents;
}

export function clearAtlasHtmlNetworkEvents(): void {
  htmlNetworkEvents.length = 0;
}

/** Cancel pending debounced write (tests / reset). */
export function resetAtlasDocHtmlRuntime(): void {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingMap = null;
  htmlOutputPath = undefined;
  clearAtlasHtmlNetworkEvents();
}

/**
 * Escape text for HTML text/attribute contexts.
 */
export function escapeHtml(value: unknown): string {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize a page id for use as a filename segment.
 */
export function safeAtlasPageFileId(pageId: string): string {
  const cleaned = pageId
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'page';
}

function sharedCss(): string {
  return `
:root { color-scheme: light; --bg: #f7f7f5; --fg: #1a1a1a; --muted: #5c5c5c; --border: #d8d8d4; --accent: #0b5fff; --card: #fff; --bar: #3b82f6; --bar2: #10b981; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.45; }
header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--card); }
header h1 { margin: 0 0 0.25rem; font-size: 1.35rem; }
header p { margin: 0; color: var(--muted); font-size: 0.9rem; }
main { padding: 1.25rem 1.5rem 2.5rem; max-width: 1100px; }
a { color: var(--accent); }
h2 { font-size: 1.1rem; margin: 1.75rem 0 0.75rem; }
ul { padding-left: 1.2rem; }
li { margin: 0.35rem 0; }
.meta { color: var(--muted); font-size: 0.85rem; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 0.9rem 1rem; margin: 0.75rem 0; }
.card h3 { margin: 0 0 0.4rem; font-size: 1rem; }
.badge { display: inline-block; font-size: 0.75rem; color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.4rem; margin-right: 0.35rem; }
pre { background: #f0f0ec; border: 1px solid var(--border); border-radius: 6px; padding: 0.75rem; overflow: auto; font-size: 0.8rem; }
nav.crumb { margin-bottom: 1rem; font-size: 0.9rem; }
.empty { color: var(--muted); font-style: italic; }
.tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0; }
.tabs button { border: 1px solid var(--border); background: var(--card); border-radius: 6px; padding: 0.35rem 0.75rem; cursor: pointer; font-size: 0.85rem; }
.tabs button.active { background: var(--fg); color: var(--card); border-color: var(--fg); }
.panel { display: none; }
.panel.active { display: block; }
.tree-row, .hop-row { display: flex; align-items: flex-start; gap: 0.35rem; padding: 0.35rem 0.25rem; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
.tree-row:hover, .hop-row:hover { background: #eee; }
.chev { width: 1.1rem; border: 0; background: transparent; cursor: pointer; font-family: inherit; padding: 0; }
.indent { display: inline-block; }
.timing-row { display: grid; grid-template-columns: minmax(10rem, 14rem) 1fr 3.5rem; gap: 0.5rem; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
.track { position: relative; height: 1.1rem; background: #ebebe6; border-radius: 3px; overflow: hidden; }
.bar { position: absolute; top: 2px; bottom: 2px; border-radius: 2px; background: var(--bar); min-width: 2px; }
.bar.mock { background: var(--bar2); }
.bar.err { background: #dc2626; }
.group { border: 1px solid var(--border); border-radius: 8px; margin: 0.75rem 0; overflow: hidden; background: var(--card); }
.group-h { padding: 0.5rem 0.75rem; background: #efefe9; font-size: 0.85rem; font-weight: 600; display: flex; justify-content: space-between; }
.journey-strip { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.5rem 0 1rem; }
.journey-step { min-width: 9rem; max-width: 14rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.75rem; background: var(--card); flex-shrink: 0; }
.used-by { color: #0369a1; font-size: 0.75rem; }
`.trim();
}

function shell(title: string, body: string, crumb?: string, extraHead = ''): string {
  const crumbHtml = crumb ? `<nav class="crumb">${crumb}</nav>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${sharedCss()}
</style>
${extraHead}
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <p>Mockifyer Atlas auto-doc (generated on capture)</p>
</header>
<main>
${crumbHtml}
${body}
</main>
</body>
</html>
`;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return String(value);
  }
}

function renderNode(node: AtlasDocNode): string {
  const dsRows =
    node.datasources.length === 0
      ? `<p class="empty">No datasources</p>`
      : `<ul>${node.datasources
          .map((d) => {
            const ops = d.operations.length ? d.operations.map(escapeHtml).join(', ') : '—';
            const req = d.lastRequestId
              ? ` · lastRequestId <code>${escapeHtml(d.lastRequestId)}</code>`
              : '';
            const root = d.dataRoot ? ` · root <code>${escapeHtml(d.dataRoot)}</code>` : '';
            const kind = d.kind ? ` <span class="badge">${escapeHtml(d.kind)}</span>` : '';
            return `<li><code>${escapeHtml(d.datasourceId)}</code>${kind}${root} · ops: ${ops}${req}</li>`;
          })
          .join('')}</ul>`;

  return `<article class="card">
  <h3>${escapeHtml(node.label || node.type)} <span class="badge">${escapeHtml(node.source)}</span></h3>
  <p class="meta">nodeId <code>${escapeHtml(node.nodeId)}</code> · type <code>${escapeHtml(node.type)}</code> · path <code>${escapeHtml(node.path)}</code></p>
  <p class="meta">lastSeenAt ${escapeHtml(node.lastSeenAt)}</p>
  <h4>Datasources</h4>
  ${dsRows}
  <h4>Props schema</h4>
  <pre>${escapeHtml(formatJson(node.propsSchema ?? null))}</pre>
  <h4>Last sample</h4>
  <pre>${escapeHtml(formatJson(node.propsSample ?? null))}</pre>
</article>`;
}

function renderPageBody(page: AtlasDocPage): string {
  const nodes = Object.values(page.nodes).sort(
    (a, b) => a.path.localeCompare(b.path) || a.nodeId.localeCompare(b.nodeId)
  );
  const slug = page.pageSlug ? ` · slug <code>${escapeHtml(page.pageSlug)}</code>` : '';
  const nodesHtml =
    nodes.length === 0 ? `<p class="empty">No nodes yet</p>` : nodes.map(renderNode).join('\n');
  return `<p class="meta">pageId <code>${escapeHtml(page.pageId)}</code>${slug} · lastSeenAt ${escapeHtml(page.lastSeenAt)}</p>
${nodesHtml}`;
}

function slimNetworkEvent(ev: NetworkEvent): Record<string, unknown> {
  return {
    id: ev.id,
    timestamp: ev.timestamp,
    method: ev.method,
    url: ev.url,
    path: ev.path,
    status: ev.status,
    durationMs: ev.durationMs,
    source: ev.source,
    requestId: ev.requestId,
    parentRequestId: ev.parentRequestId,
    usage: ev.usage,
  };
}

function interactiveClientScript(): string {
  // Plain browser JS — keep self-contained for file://
  return `
(function () {
  var raw = document.getElementById('atlas-data');
  if (!raw) return;
  var DATA = JSON.parse(raw.textContent);
  var doc = DATA.doc || {};
  var events = DATA.events || [];
  var collapsed = {};
  var view = 'map';

  function usageList(u) {
    if (!u) return [];
    return Array.isArray(u) ? u : [u];
  }
  function formatUsage(u) {
    if (u.label) return u.label;
    var parts = [u.screen, u.component].filter(Boolean);
    if (parts.length) return parts.join(' / ');
    if (u.cms && u.cms.type) return u.cms.type;
    return u.datasourceId || 'app';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function filterEvents() {
    var screens = Object.keys(doc.screens || {});
    var pages = Object.keys(doc.pages || {});
    Object.keys(doc.pages || {}).forEach(function (id) {
      var p = doc.pages[id];
      if (p.pageSlug) screens.push(p.pageSlug);
    });
    var screenSet = {};
    screens.forEach(function (s) { screenSet[s] = true; });
    var pageSet = {};
    pages.forEach(function (p) { pageSet[p] = true; });
    var hasPref = Object.keys(doc.prefetches || {}).length > 0;
    var byReq = {};
    events.forEach(function (e) { if (e.requestId) byReq[e.requestId] = e; });
    var matched = events.filter(function (ev) {
      var us = usageList(ev.usage);
      if (!us.length) return hasPref && !ev.parentRequestId;
      return us.some(function (u) {
        return (u.screen && screenSet[u.screen]) ||
          (u.cms && u.cms.pageId && (pageSet[u.cms.pageId] || screenSet[u.cms.pageId]));
      });
    });
    var include = {};
    matched.forEach(function (ev) {
      var cur = ev;
      var guard = 0;
      while (cur && guard++ < 20) {
        include[cur.id] = true;
        if (!cur.parentRequestId) break;
        cur = byReq[cur.parentRequestId];
      }
    });
    return events.filter(function (e) { return include[e.id]; })
      .sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
  }

  function buildForest(list) {
    var byId = {};
    list.forEach(function (e) { byId[e.id] = { event: e, children: [] }; });
    var byReq = {};
    list.forEach(function (e) { if (e.requestId) byReq[e.requestId] = e; });
    var attached = {};
    var roots = [];
    list.forEach(function (e) {
      var parent = e.parentRequestId ? byReq[e.parentRequestId] : null;
      if (parent && byId[parent.id] && parent.id !== e.id) {
        byId[parent.id].children.push(byId[e.id]);
        attached[e.id] = true;
      }
    });
    list.forEach(function (e) {
      if (!attached[e.id]) roots.push(byId[e.id]);
    });
    function sortRec(nodes) {
      nodes.sort(function (a, b) { return new Date(a.event.timestamp) - new Date(b.event.timestamp); });
      nodes.forEach(function (n) { sortRec(n.children); });
    }
    sortRec(roots);
    return roots;
  }

  function flatten(forest) {
    var rows = [];
    function walk(nodes, depth) {
      nodes.forEach(function (n) {
        var has = n.children.length > 0;
        rows.push({ event: n.event, depth: depth, hasChildren: has });
        if (has && !collapsed[n.event.id]) walk(n.children, depth + 1);
      });
    }
    walk(forest, 0);
    return rows;
  }

  function timing(list) {
    if (!list.length) return { span: 1, bars: [] };
    var t0 = Infinity, t1 = -Infinity;
    list.forEach(function (e) {
      var s = new Date(e.timestamp).getTime();
      var d = e.durationMs > 0 ? e.durationMs : 8;
      t0 = Math.min(t0, s);
      t1 = Math.max(t1, s + d);
    });
    if (!(t1 > t0)) t1 = t0 + 1;
    var span = t1 - t0;
    return {
      span: span,
      bars: list.map(function (e) {
        var s = new Date(e.timestamp).getTime() - t0;
        var d = Math.max(e.durationMs > 0 ? e.durationMs : 8, 1);
        return { event: e, start: s, dur: d };
      }).sort(function (a, b) { return a.start - b.start; })
    };
  }

  function journey(list) {
    var steps = {};
    function add(key, label, ev) {
      if (!steps[key]) steps[key] = { key: key, label: label, first: new Date(ev.timestamp).getTime(), events: [], seen: {} };
      var st = steps[key];
      st.first = Math.min(st.first, new Date(ev.timestamp).getTime());
      if (st.seen[ev.id]) return;
      st.seen[ev.id] = true;
      st.events.push(ev);
    }
    list.forEach(function (ev) {
      var screens = {};
      usageList(ev.usage).forEach(function (u) {
        if (u.screen) screens[u.screen] = true;
      });
      var keys = Object.keys(screens);
      if (!keys.length) {
        add(ev.parentRequestId ? '__other__' : '__prefetch__',
          ev.parentRequestId ? 'Unattributed' : 'Prefetch / login', ev);
        return;
      }
      keys.forEach(function (s) { add('screen:' + s, s, ev); });
    });
    return Object.keys(steps).map(function (k) { return steps[k]; })
      .sort(function (a, b) { return a.first - b.first; });
  }

  function barClass(src) {
    if (src === 'mock-hit') return 'bar mock';
    if (src === 'error' || src === 'blocked') return 'bar err';
    return 'bar';
  }

  function renderMap(el) {
    var pages = Object.keys(doc.pages || {}).sort();
    var html = '<p class="meta">scenario <code>' + esc(doc.scenario) + '</code> · updatedAt ' + esc(doc.updatedAt) + '</p>';
    html += '<p class="meta">' + events.length + ' hop(s) embedded · click chevrons to expand/collapse pages</p>';
    html += '<h2>Pages</h2>';
    if (!pages.length) html += '<p class="empty">No pages yet</p>';
    pages.forEach(function (pid) {
      var p = doc.pages[pid];
      var open = !collapsed['page:' + pid];
      var nodes = Object.keys(p.nodes || {}).map(function (id) { return p.nodes[id]; })
        .sort(function (a, b) { return (a.path || '').localeCompare(b.path || ''); });
      html += '<div class="card">';
      html += '<div class="tree-row"><button type="button" class="chev" data-collapse="page:' + esc(pid) + '">' + (open ? '▼' : '▶') + '</button>';
      html += '<div><strong>' + esc(p.pageSlug || p.pageId) + '</strong> <span class="badge">' + nodes.length + ' nodes</span>';
      html += ' <a href="pages/' + esc(pid.replace(/[^a-zA-Z0-9._-]+/g, '_')) + '.html">static page →</a></div></div>';
      if (open) {
        nodes.forEach(function (n) {
          html += '<div class="tree-row" style="padding-left:1.5rem"><span class="indent"></span><div>';
          html += '<strong>' + esc(n.label || n.type) + '</strong> <span class="badge">' + esc(n.source) + '</span>';
          html += '<div class="meta">' + esc(n.path) + '</div>';
          if (n.datasources && n.datasources.length) {
            html += '<div class="used-by">' + n.datasources.map(function (d) {
              return esc(d.datasourceId) + (d.dataRoot ? ' · ' + esc(d.dataRoot) : '');
            }).join('; ') + '</div>';
          }
          html += '</div></div>';
        });
      }
      html += '</div>';
    });
    html += '<h2>Screens</h2>';
    var screens = Object.keys(doc.screens || {}).sort();
    if (!screens.length) html += '<p class="empty">No screens yet</p>';
    else {
      html += '<ul>';
      screens.forEach(function (s) {
        var sc = doc.screens[s];
        html += '<li><strong>' + esc(s) + '</strong><br/>components: ' + esc((sc.components || []).join(', ') || '—');
        html += '<br/>datasources: ' + esc((sc.datasourceIds || []).join(', ') || '—') + '</li>';
      });
      html += '</ul>';
    }
    html += '<h2>Prefetches</h2>';
    var prefs = Object.keys(doc.prefetches || {}).sort();
    if (!prefs.length) html += '<p class="empty">No prefetches yet</p>';
    else {
      html += '<ul>';
      prefs.forEach(function (id) {
        var p = doc.prefetches[id];
        html += '<li><code>' + esc(id) + '</code> ops: ' + esc((p.operations || []).join(', ') || '—');
        if (p.lastRequestId) html += ' · <code>' + esc(p.lastRequestId) + '</code>';
        html += '</li>';
      });
      html += '</ul>';
    }
    el.innerHTML = html;
  }

  function renderTrace(el, list) {
    var forest = buildForest(list);
    var rows = flatten(forest);
    if (!rows.length) {
      el.innerHTML = '<p class="empty">No hops match the doc yet (need network logging + usage/screen tags).</p>';
      return;
    }
    var html = '<p class="meta">Collapse/expand correlated request trees</p>';
    rows.forEach(function (r) {
      var e = r.event;
      var pad = 8 + r.depth * 14;
      html += '<div class="hop-row" style="padding-left:' + pad + 'px">';
      if (r.hasChildren) {
        html += '<button type="button" class="chev" data-collapse="' + esc(e.id) + '">' + (collapsed[e.id] ? '▶' : '▼') + '</button>';
      } else html += '<span class="chev"></span>';
      html += '<div><strong>' + esc(e.method) + '</strong> ' + esc(e.path || e.url);
      html += ' <span class="meta">' + (e.durationMs != null ? e.durationMs + 'ms' : '') + (e.status != null ? ' · ' + e.status : '') + '</span>';
      var us = usageList(e.usage);
      if (us.length) html += '<div class="used-by">used by: ' + us.map(formatUsage).map(esc).join(', ') + '</div>';
      html += '</div></div>';
    });
    el.innerHTML = html;
  }

  function renderWaterfall(el, list) {
    var tw = timing(list);
    if (!tw.bars.length) {
      el.innerHTML = '<p class="empty">No timing data</p>';
      return;
    }
    var html = '<p class="meta">Absolute time bars (parallel vs sequential)</p>';
    tw.bars.forEach(function (b) {
      var left = (b.start / tw.span) * 100;
      var width = Math.max((b.dur / tw.span) * 100, 0.4);
      html += '<div class="timing-row"><div>' + esc(b.event.method) + ' ' + esc(b.event.path || b.event.url);
      var us = usageList(b.event.usage);
      if (us.length) html += '<div class="used-by">' + us.map(formatUsage).map(esc).join(', ') + '</div>';
      html += '</div><div class="track"><div class="' + barClass(b.event.source) + '" style="left:' + left + '%;width:' + width + '%"></div></div>';
      html += '<div class="meta">' + (b.event.durationMs != null ? b.event.durationMs + 'ms' : '—') + '</div></div>';
    });
    el.innerHTML = html;
  }

  function renderGantt(el, list) {
    var steps = journey(list);
    if (!steps.length) {
      el.innerHTML = '<p class="empty">No journey groups</p>';
      return;
    }
    var all = [];
    var seen = {};
    steps.forEach(function (st) {
      st.events.forEach(function (e) {
        if (!seen[e.id]) { seen[e.id] = true; all.push(e); }
      });
    });
    var global = timing(all);
    var html = '<p class="meta">Same timeline, grouped by screen / prefetch</p>';
    steps.forEach(function (st) {
      html += '<div class="group"><div class="group-h"><span>' + esc(st.label) + '</span><span class="meta">' + st.events.length + ' hops</span></div>';
      var local = timing(st.events);
      local.bars.forEach(function (b) {
        var startAbs = new Date(b.event.timestamp).getTime() - (global.bars.length ? new Date(all[0] ? Math.min.apply(null, all.map(function (x) { return new Date(x.timestamp).getTime(); })) : Date.now()) : 0);
        // recompute vs global t0
      });
      // use global span with absolute offsets
      var t0 = Infinity;
      all.forEach(function (e) { t0 = Math.min(t0, new Date(e.timestamp).getTime()); });
      st.events.forEach(function (e) {
        var s = new Date(e.timestamp).getTime() - t0;
        var d = Math.max(e.durationMs > 0 ? e.durationMs : 8, 1);
        var left = (s / global.span) * 100;
        var width = Math.max((d / global.span) * 100, 0.4);
        html += '<div class="timing-row" style="padding:0.3rem 0.75rem"><div>' + esc(e.method) + ' ' + esc(e.path || e.url) + '</div>';
        html += '<div class="track"><div class="' + barClass(e.source) + '" style="left:' + left + '%;width:' + width + '%"></div></div>';
        html += '<div class="meta">' + (e.durationMs != null ? e.durationMs + 'ms' : '—') + '</div></div>';
      });
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderJourney(el, list) {
    var steps = journey(list);
    if (!steps.length) {
      el.innerHTML = '<p class="empty">No journey steps</p>';
      return;
    }
    var html = '<div class="journey-strip">';
    steps.forEach(function (st, i) {
      if (i) html += '<div class="meta" style="align-self:center">→</div>';
      html += '<div class="journey-step"><strong>' + esc(st.label) + '</strong><div class="meta">' + st.events.length + ' hops</div></div>';
    });
    html += '</div>';
    steps.forEach(function (st) {
      html += '<div class="group"><div class="group-h">' + esc(st.label) + '</div>';
      st.events.forEach(function (e) {
        html += '<div class="hop-row"><div><strong>' + esc(e.method) + '</strong> ' + esc(e.path || e.url);
        var us = usageList(e.usage);
        if (us.length) html += '<div class="used-by">' + us.map(formatUsage).map(esc).join(', ') + '</div>';
        html += '</div></div>';
      });
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function render() {
    var list = filterEvents();
    var mapEl = document.getElementById('view-map');
    var traceEl = document.getElementById('view-trace');
    var wfEl = document.getElementById('view-waterfall');
    var ganttEl = document.getElementById('view-gantt');
    var journeyEl = document.getElementById('view-journey');
    if (view === 'map') renderMap(mapEl);
    if (view === 'trace') renderTrace(traceEl, list);
    if (view === 'waterfall') renderWaterfall(wfEl, list);
    if (view === 'gantt') renderGantt(ganttEl, list);
    if (view === 'journey') renderJourney(journeyEl, list);
    document.querySelectorAll('.tabs button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'view-' + view);
    });
  }

  document.getElementById('atlas-app').addEventListener('click', function (ev) {
    var t = ev.target;
    if (t && t.getAttribute && t.getAttribute('data-view')) {
      view = t.getAttribute('data-view');
      render();
      return;
    }
    if (t && t.getAttribute && t.getAttribute('data-collapse')) {
      var id = t.getAttribute('data-collapse');
      collapsed[id] = !collapsed[id];
      render();
    }
  });

  render();
})();
`.trim();
}

function buildInteractiveIndex(map: AtlasDocMap, events: NetworkEvent[]): string {
  const payload = {
    doc: map,
    events: events.map(slimNetworkEvent),
  };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const body = `
<div id="atlas-app">
  <p class="meta">Interactive Atlas — Map structure plus Trace / Waterfall / Gantt / Journey from hops captured while running.</p>
  <div class="tabs">
    <button type="button" class="active" data-view="map">Map</button>
    <button type="button" data-view="trace">Trace</button>
    <button type="button" data-view="waterfall">Waterfall</button>
    <button type="button" data-view="gantt">Gantt</button>
    <button type="button" data-view="journey">Journey</button>
  </div>
  <div id="view-map" class="panel active"></div>
  <div id="view-trace" class="panel"></div>
  <div id="view-waterfall" class="panel"></div>
  <div id="view-gantt" class="panel"></div>
  <div id="view-journey" class="panel"></div>
</div>
<script type="application/json" id="atlas-data">${json}</script>
<script>
${interactiveClientScript()}
</script>`;
  return shell(`Atlas — ${map.scenario}`, body);
}

/**
 * Build relative path → HTML content map (`index.html`, `pages/<id>.html`).
 */
export function buildAtlasDocHtmlFiles(
  map: AtlasDocMap,
  networkEvents: readonly NetworkEvent[] = []
): Record<string, string> {
  const pages = Object.values(map.pages).sort((a, b) => a.pageId.localeCompare(b.pageId));
  const files: Record<string, string> = {
    'index.html': buildInteractiveIndex(map, [...networkEvents]),
  };

  for (const page of pages) {
    const fileId = safeAtlasPageFileId(page.pageId);
    const title = page.pageSlug || page.pageId;
    files[`pages/${fileId}.html`] = shell(
      `Atlas page — ${title}`,
      renderPageBody(page),
      `<a href="../index.html">← Overview (interactive)</a>`
    );
  }

  return files;
}

/**
 * Synchronously write HTML files under `dir`. No-op when Node `fs` is unavailable.
 * @returns number of files written, or 0 on no-op / failure
 */
export function writeAtlasDocHtml(
  dir: string,
  map: AtlasDocMap,
  networkEvents?: readonly NetworkEvent[]
): number {
  if (!fs || !pathMod) return 0;
  const root = dir.trim();
  if (!root) return 0;

  try {
    const events = networkEvents ?? htmlNetworkEvents;
    const files = buildAtlasDocHtmlFiles(map, events);
    const pagesDir = pathMod.join(root, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });

    let written = 0;
    for (const [rel, content] of Object.entries(files)) {
      const abs = pathMod.join(root, rel);
      const parent = pathMod.dirname(abs);
      fs.mkdirSync(parent, { recursive: true });
      fs.writeFileSync(abs, content, 'utf8');
      written += 1;
    }
    return written;
  } catch {
    return 0;
  }
}

/**
 * Debounced rewrite of the configured HTML output directory for the given map.
 * No-op when path unset or `fs` missing (e.g. React Native).
 */
export function scheduleAtlasDocHtmlRewrite(map: AtlasDocMap): void {
  const dir = htmlOutputPath?.trim();
  if (!dir || !fs) return;

  pendingMap = map;
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const snapshot = pendingMap;
    pendingMap = null;
    if (snapshot && htmlOutputPath?.trim()) {
      writeAtlasDocHtml(htmlOutputPath.trim(), snapshot, htmlNetworkEvents);
    }
  }, HTML_WRITE_DEBOUNCE_MS);

  if (typeof debounceTimer === 'object' && debounceTimer !== null && 'unref' in debounceTimer) {
    (debounceTimer as NodeJS.Timeout).unref?.();
  }
}

/** Flush any pending debounced write immediately (tests). */
export function flushAtlasDocHtmlRewrite(): void {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const snapshot = pendingMap;
  pendingMap = null;
  const dir = htmlOutputPath?.trim();
  if (snapshot && dir && fs) {
    writeAtlasDocHtml(dir, snapshot, htmlNetworkEvents);
  }
}
