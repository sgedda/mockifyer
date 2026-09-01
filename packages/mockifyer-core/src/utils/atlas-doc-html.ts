/**
 * Self-contained Atlas auto-doc HTML for local browsing (file:// / VS Code).
 * Written on Node capture upserts when {@link setAtlasDocHtmlOutputPath} is set.
 * Interactive: Map, Trace, Chains, Waterfall, Gantt, Journey — kind filters, dedup, colored chain boxes,
 * JSON syntax highlighting, hop error/slow panels, Errors/Slow filters.
 * Safe on React Native: `fs`/`path` require is try/caught; writes no-op.
 */

import type { AtlasDocMap, AtlasDocNode, AtlasDocPage } from './atlas-doc';
import type { NetworkEvent } from './network-event-types';
import { getAtlasUsageAnnotations, mergeUsageOntoNetworkEvents } from './atlas-usage';

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
/** Cap body previews embedded in HTML to keep files openable. */
const MAX_BODY_CHARS_IN_HTML = 12_000;

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
:root { color-scheme: light; --bg: #f7f7f5; --fg: #1a1a1a; --muted: #5c5c5c; --border: #d8d8d4; --accent: #0b5fff; --card: #fff; --bar: #3b82f6; --bar2: #10b981; --err: #b91c1c; --err-bg: #fef2f2; --ok: #15803d; --warn: #a16207; --slow: #d97706; --slow-bg: #fffbeb; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.45; }
header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--card); }
header h1 { margin: 0 0 0.25rem; font-size: 1.35rem; }
header p { margin: 0; color: var(--muted); font-size: 0.9rem; }
main { padding: 1.25rem 1.5rem 2.5rem; max-width: 1280px; }
a { color: var(--accent); }
h2 { font-size: 1.1rem; margin: 1.75rem 0 0.75rem; }
ul { padding-left: 1.2rem; }
li { margin: 0.35rem 0; }
.meta { color: var(--muted); font-size: 0.85rem; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 0.9rem 1rem; margin: 0.75rem 0; }
.card h3 { margin: 0 0 0.4rem; font-size: 1rem; }
.badge { display: inline-block; font-size: 0.75rem; color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.4rem; margin-right: 0.35rem; }
.badge.status-ok { color: var(--ok); border-color: #86efac; background: #f0fdf4; }
.badge.status-warn { color: var(--warn); border-color: #fde68a; background: #fffbeb; }
.badge.status-err, .badge.err { color: #fff; border-color: var(--err); background: var(--err); font-weight: 600; }
.badge.slow { color: #92400e; border-color: #fbbf24; background: #fde68a; font-weight: 600; }
.badge.dur-est { border-style: dashed; color: var(--muted); }
.badge.status-muted { color: var(--muted); }
pre { background: #1e1e1e; color: #d4d4d4; border: 1px solid #333; border-radius: 6px; padding: 0.75rem; overflow: auto; font-size: 0.78rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.45; }
pre.json { white-space: pre; }
.json-k { color: #9cdcfe; }
.json-s { color: #ce9178; }
.json-n { color: #b5cea8; }
.json-b { color: #569cd6; }
.json-null { color: #569cd6; }
.error-panel { background: var(--err-bg); border: 1px solid #fecaca; border-left: 4px solid var(--err); border-radius: 6px; padding: 0.65rem 0.75rem; margin: 0.5rem 0 0.75rem; }
.error-panel-title { font-size: 0.8rem; font-weight: 700; color: var(--err); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.35rem; }
.error-item { margin: 0.35rem 0; font-size: 0.85rem; }
.error-msg { color: #7f1d1d; font-weight: 600; word-break: break-word; }
.error-meta { color: #991b1b; font-size: 0.75rem; opacity: 0.9; }
.slow-panel { background: var(--slow-bg); border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 0.65rem 0.75rem; margin: 0.5rem 0 0.75rem; }
.slow-panel-title { font-size: 0.8rem; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.35rem; }
.slow-item { margin: 0.35rem 0; font-size: 0.85rem; }
.slow-msg { color: #92400e; font-weight: 600; }
.slow-meta { color: #b45309; font-size: 0.75rem; opacity: 0.9; }
.hop-row.has-error, .timing-row.has-error { background: #fff1f1; }
.hop-row.has-error.selected, .timing-row.has-error.selected { background: #ffe4e4; }
.hop-row.has-slow, .timing-row.has-slow { background: #fffbeb; }
.hop-row.has-slow.selected, .timing-row.has-slow.selected { background: #fef3c7; }
.hop-row.error-context, .timing-row.error-context { opacity: 0.78; }
.badge.ctx { color: var(--muted); border-style: dashed; }
.chain-box.has-error { border-color: var(--err); background: var(--err-bg); }
.chain-box.has-slow { border-color: #f59e0b; background: var(--slow-bg); }
.chain-box.error-context { opacity: 0.8; border-style: dashed; }
.kind-filters button.errors-toggle.on { background: var(--err); color: #fff; border-color: var(--err); }
.kind-filters button.slow-toggle.on { background: #f59e0b; color: #78350f; border-color: #d97706; }
.bar.slow { background: #f59e0b; }
nav.crumb { margin-bottom: 1rem; font-size: 0.9rem; }
.empty { color: var(--muted); font-style: italic; }
.tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0; }
.tabs button { border: 1px solid var(--border); background: var(--card); border-radius: 6px; padding: 0.35rem 0.75rem; cursor: pointer; font-size: 0.85rem; }
.tabs button.active { background: var(--fg); color: var(--card); border-color: var(--fg); }
.panel { display: none; }
.panel.active { display: block; }
.tree-row, .hop-row { display: flex; align-items: flex-start; gap: 0.35rem; padding: 0.35rem 0.25rem; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
.tree-row:hover, .hop-row:hover { background: #eee; }
.tree-row.map-selectable { cursor: pointer; }
.tree-row.map-selectable.selected { background: #e8eefc; }
.chev { width: 1.1rem; border: 0; background: transparent; cursor: pointer; font-family: inherit; padding: 0; }
.indent { display: inline-block; }
.timing-row { display: grid; grid-template-columns: minmax(10rem, 14rem) 1fr 3.5rem; gap: 0.5rem; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
.track { position: relative; height: 1.1rem; background: #ebebe6; border-radius: 3px; overflow: hidden; }
.bar { position: absolute; top: 2px; bottom: 2px; border-radius: 2px; background: var(--bar); min-width: 2px; }
.bar.mock { background: var(--bar2); }
.bar.err { background: #dc2626; }
.group { border: 1px solid var(--border); border-radius: 8px; margin: 0.75rem 0; overflow: hidden; background: var(--card); }
.group-h { padding: 0.5rem 0.75rem; background: #efefe9; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 0.35rem; justify-content: flex-start; }
.group-h .spacer { margin-left: auto; font-weight: 500; color: var(--muted); }
.toolbar { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.35rem 0 0.75rem; }
.toolbar button { border: 1px solid var(--border); background: var(--card); border-radius: 6px; padding: 0.25rem 0.55rem; cursor: pointer; font-size: 0.75rem; }
.kind-filters { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.5rem 0 0.75rem; align-items: center; }
.kind-filters .label { font-size: 0.75rem; color: var(--muted); margin-right: 0.15rem; }
.kind-filters button { border: 1px solid var(--border); background: var(--card); border-radius: 999px; padding: 0.2rem 0.65rem; cursor: pointer; font-size: 0.75rem; }
.kind-filters button.on { background: var(--fg); color: var(--card); border-color: var(--fg); }
.kind-filters button .n { opacity: 0.75; margin-left: 0.2rem; }
.kind-section { margin: 1rem 0 0.35rem; font-size: 0.95rem; }
.kind-section .hint { font-weight: 400; color: var(--muted); font-size: 0.8rem; }
.hop-path { word-break: break-all; }
.muted-inline { color: var(--muted); font-weight: 400; }
.map-row { display: flex; align-items: flex-start; gap: 0.4rem; padding: 0.45rem 0.65rem; border-bottom: 1px solid var(--border); font-size: 0.85rem; cursor: pointer; }
.map-row:hover { background: #eee; }
.map-row.selected { background: #e8eefc; }
.map-row .col { flex: 1; min-width: 0; }
.map-row .col-side { flex: 0 0 auto; text-align: right; color: var(--muted); font-size: 0.75rem; white-space: nowrap; }
.map-sub { margin-left: 1.25rem; border-left: 2px solid var(--border); }
.journey-strip { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.4rem 0.3rem; padding: 0.35rem 0 0.85rem; }
.journey-step { flex: 1 1 7.5rem; min-width: 6.5rem; max-width: 11rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.6rem; background: var(--card); text-align: left; cursor: pointer; font-family: inherit; color: inherit; }
.journey-step:hover { border-color: var(--accent); background: #f5f8ff; }
.journey-step.active { border-color: var(--accent); background: #e8eefc; box-shadow: 0 0 0 1px var(--accent); }
.journey-step strong { display: block; font-size: 0.82rem; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.journey-step .meta { margin-top: 0.15rem; font-size: 0.72rem; }
.journey-arrow { flex: 0 0 auto; align-self: center; color: var(--muted); font-size: 0.85rem; padding: 0 0.05rem; user-select: none; }
.journey-group { scroll-margin-top: 0.85rem; }
.journey-group.journey-group-active { border-color: #93c5fd; box-shadow: 0 0 0 1px #bfdbfe; }
.journey-group .group-h { gap: 0.5rem; }
.journey-hop { padding: 0.55rem 0.75rem; gap: 0.5rem; align-items: flex-start; }
.journey-hop .hop-main { flex: 1; min-width: 0; }
.journey-hop .hop-line { display: flex; align-items: baseline; gap: 0.4rem; min-width: 0; }
.journey-hop .hop-line strong { flex: 0 0 auto; font-size: 0.8rem; }
.journey-hop .hop-path-trunc { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; word-break: normal; }
.journey-hop .hop-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem; margin-top: 0.3rem; }
.journey-hop .hop-badges .badge { margin-right: 0; }
.journey-hop .hop-meta { display: block; margin-top: 0.2rem; font-size: 0.72rem; }
.journey-hop .used-by { margin-top: 0.2rem; }
.used-by { color: #0369a1; font-size: 0.75rem; }
.trigger-panel { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 6px; padding: 0.65rem 0.75rem; margin: 0.5rem 0 0.75rem; }
.trigger-panel-title { font-size: 0.8rem; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.35rem; }
.trigger-detail { font-size: 0.85rem; color: #1e3a8a; word-break: break-word; }
.trigger-meta { font-size: 0.75rem; color: #1d4ed8; opacity: 0.85; margin-top: 0.25rem; }
.badge.trigger { font-weight: 600; }
.badge.trigger-prefetch { color: #6d28d9; border-color: #c4b5fd; background: #f5f3ff; }
.badge.trigger-navigation { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; }
.badge.trigger-child { color: #0f766e; border-color: #99f6e4; background: #f0fdfa; }
.badge.trigger-unknown { color: var(--muted); }
.layout { display: grid; grid-template-columns: 1fr; gap: 1rem; min-width: 0; }
.layout > div { min-width: 0; }
@media (min-width: 900px) {
  .layout { grid-template-columns: minmax(0, 1.55fr) minmax(16rem, 1fr); }
  .layout.layout-journey { grid-template-columns: minmax(0, 2.1fr) minmax(15rem, 0.85fr); }
}
.detail { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 0.9rem 1rem; position: sticky; top: 0.75rem; max-height: 80vh; overflow: auto; min-width: 0; }
.detail h3 { margin: 0 0 0.5rem; font-size: 0.95rem; }
.hop-row.selected, .timing-row.selected { background: #e8eefc; }
.hop-row { cursor: pointer; }
.timing-row { cursor: pointer; }
.body-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--muted); margin: 0.75rem 0 0.25rem; }
.unique-filters { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.35rem 0 0.5rem; align-items: center; }
.unique-filters.secondary { margin-top: 0; margin-bottom: 0.75rem; }
.unique-filters .label { font-size: 0.75rem; color: var(--muted); margin-right: 0.15rem; }
.unique-filters button { border: 1px solid var(--border); background: var(--card); border-radius: 999px; padding: 0.2rem 0.65rem; cursor: pointer; font-size: 0.75rem; }
.unique-filters button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.unique-summary { font-size: 0.75rem; }
.unique-hint { font-size: 0.75rem; color: var(--muted); margin: 0 0 0.75rem; font-style: italic; }
.badge.repeat { cursor: pointer; background: #e8eefc; border-color: var(--accent); color: var(--accent); font-weight: 600; }
.hop-row.dup-member, .timing-row.dup-member { opacity: 0.88; background: #f3f4f6; font-size: 0.78rem; }
.chain-card { border: 1px solid var(--border); border-radius: 8px; margin: 0.75rem 0; background: var(--card); overflow: hidden; }
.chain-h { padding: 0.5rem 0.75rem; background: #efefe9; font-size: 0.85rem; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
.chain-h .spacer { margin-left: auto; }
.chain-flow { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.35rem; padding: 0.75rem; }
.chain-tree { padding: 0.75rem; }
.chain-orchestrator { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; margin-bottom: 0.35rem; }
.chain-orchestrator-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.chain-fan-connector { display: flex; flex-direction: column; align-items: center; margin: 0.25rem 0 0.65rem; }
.chain-fan-line { width: 2px; height: 1.1rem; background: var(--border); }
.chain-fan-label { font-size: 0.78rem; color: var(--muted); text-align: center; max-width: 28rem; line-height: 1.35; }
.chain-fan-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
.chain-fan-item { display: flex; flex-direction: column; align-items: stretch; gap: 0.35rem; max-width: 18rem; }
.chain-level { margin-top: 0.35rem; }
.chain-level-sep { display: flex; flex-direction: column; align-items: center; margin: 0.55rem 0 0.4rem; }
.chain-level-sep .chain-fan-line { height: 0.85rem; }
.chain-level-label { font-size: 0.72rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.chain-nested { border-left: 2px dashed var(--border); margin: 0.35rem 0 0 0.75rem; padding: 0.35rem 0 0.15rem 0.65rem; }
.chain-nested-label { font-size: 0.68rem; color: var(--muted); margin-bottom: 0.25rem; display: block; }
.chain-nested-row { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.chain-box.chain-box-root { min-width: 10rem; max-width: 18rem; border-width: 2px; }
.chain-box.chain-box-sm { min-width: 5.5rem; max-width: 14rem; padding: 0.35rem 0.5rem; font-size: 0.9em; }
.chain-arrow { color: var(--muted); font-weight: 600; align-self: center; padding: 0 0.1rem; font-size: 1rem; }
.chain-box { border: 2px solid var(--border); border-radius: 8px; padding: 0.5rem 0.65rem; min-width: 6.5rem; max-width: 15rem; text-align: left; cursor: pointer; background: var(--card); font-family: inherit; flex: 0 1 auto; }
.chain-box:hover { border-color: var(--accent); }
.chain-box.selected { border-color: var(--accent); background: #e8eefc; box-shadow: 0 0 0 1px var(--accent); }
.chain-box-kind { display: block; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.chain-box-host { display: block; font-size: 0.82rem; font-weight: 600; margin: 0.12rem 0; word-break: break-word; }
.chain-box-op { display: block; font-size: 0.72rem; color: var(--muted); word-break: break-all; }
.chain-box-n { display: block; font-size: 0.68rem; color: var(--accent); margin-top: 0.15rem; }
.chain-box.kind-cms { border-left: 4px solid #059669; }
.chain-box.kind-bff { border-left: 4px solid #2563eb; }
.chain-box.kind-backend { border-left: 4px solid #7c3aed; }
.chain-box.kind-other { border-left: 4px solid #64748b; }
.chain-box.kind-noise { border-left: 4px solid #94a3b8; opacity: 0.85; }
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

function truncateBodyPreview(text: string | undefined): string | undefined {
  if (text == null || text === '') return undefined;
  if (text.length <= MAX_BODY_CHARS_IN_HTML) return text;
  return `${text.slice(0, MAX_BODY_CHARS_IN_HTML)}\n… [truncated ${text.length - MAX_BODY_CHARS_IN_HTML} chars]`;
}

function slimNetworkEvent(ev: NetworkEvent): Record<string, unknown> {
  const slim: Record<string, unknown> = {
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
    requestBodyPreview: truncateBodyPreview(ev.requestBodyPreview),
    responseBodyPreview: truncateBodyPreview(ev.responseBodyPreview),
  };
  if (ev.errorMessage) slim.errorMessage = ev.errorMessage;
  if (ev.kind) slim.kind = ev.kind;
  if (ev.anomalyFlags?.length) slim.anomalyFlags = ev.anomalyFlags;
  return slim;
}

function interactiveClientScript(): string {
  return `
(function () {
function normalizeGraphQLQueryForKey(query) {
  if (!query) return '';
  return String(query).replace(/\\s+/g, ' ').trim();
}
function hashObjectForKey(obj) {
  if (!obj) return '';
  try {
    var record = obj;
    var keys = Object.keys(record).sort();
    var sorted = {};
    for (var i = 0; i < keys.length; i++) sorted[keys[i]] = record[keys[i]];
    return JSON.stringify(sorted);
  } catch (err) {
    return String(obj);
  }
}
function buildGraphQLBodyKeyClient(query, variables) {
  var normalizedQuery = normalizeGraphQLQueryForKey(query);
  var variablesHash = variables ? hashObjectForKey(variables) : '';
  return 'gql:' + normalizedQuery + ':vars:' + variablesHash;
}
function stripUrlQuery(raw) {
  var s = String(raw || '').toLowerCase();
  var q = s.indexOf('?');
  if (q >= 0) s = s.slice(0, q);
  while (s.length > 1 && s.charAt(s.length - 1) === '/') s = s.slice(0, -1);
  return s;
}
function bodyKeyForHop(e) {
  var body = e.requestBodyPreview;
  if (body == null || body === '') return '';
  try {
    var parsed = JSON.parse(String(body));
    if (parsed && typeof parsed === 'object' && parsed.query) {
      return buildGraphQLBodyKeyClient(parsed.query, parsed.variables);
    }
    return hashObjectForKey(parsed);
  } catch (err) {
    return String(body);
  }
}
function endpointKeyForHop(e) {
  var method = String(e.method || 'GET').toUpperCase();
  var path = String(e.path || e.url || '');
  return method + ' ' + stripUrlQuery(path);
}
function requestKeyForHop(e) {
  var method = String(e.method || 'GET').toUpperCase();
  var url = stripUrlQuery(String(e.url || e.path || ''));
  var key = method + ':' + url;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    var bk = bodyKeyForHop(e);
    if (bk) key += '|body:' + bk;
  }
  return key;
}
function screenScopeKeyForHop(e, usageListFn) {
  var screens = {};
  usageListFn(e.usage).forEach(function (u) {
    if (u && u.screen) screens[u.screen] = true;
  });
  var keys = Object.keys(screens).sort();
  if (!keys.length) return '__none__';
  return keys.join('|');
}
function buildHopDedupKey(e, mode, scope, usageListFn) {
  var base = mode === 'request' ? requestKeyForHop(e) : endpointKeyForHop(e);
  if (scope === 'per-screen') return screenScopeKeyForHop(e, usageListFn) + '::' + base;
  return base;
}
function pickRepresentativeHop(members, keep) {
  if (!members || !members.length) return null;
  if (keep === 'last') return members[members.length - 1];
  if (keep === 'slowest') {
    var best = members[0];
    var bestDur = best.durationMs > 0 ? best.durationMs : 0;
    for (var i = 1; i < members.length; i++) {
      var d = members[i].durationMs > 0 ? members[i].durationMs : 0;
      if (d >= bestDur) { best = members[i]; bestDur = d; }
    }
    return best;
  }
  return members[0];
}
function applyUniqueFilter(list, opts, usageListFn) {
  var mode = (opts && opts.mode) || 'off';
  var scope = (opts && opts.scope) || 'global';
  var keep = (opts && opts.keep) || 'first';
  var totalCount = list.length;
  if (mode === 'off' || !list.length) {
    return {
      list: list,
      totalCount: totalCount,
      uniqueCount: totalCount,
      repeatCountByKey: {},
      membersByKey: {},
      keyFor: function (e) { return e.id; }
    };
  }
  var membersByKey = {};
  list.forEach(function (e) {
    var k = buildHopDedupKey(e, mode, scope, usageListFn);
    if (!membersByKey[k]) membersByKey[k] = [];
    membersByKey[k].push(e);
  });
  Object.keys(membersByKey).forEach(function (k) {
    membersByKey[k].sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  });
  var repeatCountByKey = {};
  var reps = [];
  Object.keys(membersByKey).forEach(function (k) {
    var members = membersByKey[k];
    repeatCountByKey[k] = members.length;
    var rep = pickRepresentativeHop(members, keep);
    if (rep) reps.push(rep);
  });
  reps.sort(function (a, b) {
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
  return {
    list: reps,
    totalCount: totalCount,
    uniqueCount: reps.length,
    repeatCountByKey: repeatCountByKey,
    membersByKey: membersByKey,
    keyFor: function (e) { return buildHopDedupKey(e, mode, scope, usageListFn); }
  };
}
function formatHopCountLabel(total, unique, mode) {
  if (mode === 'off' || total === unique) return String(total) + ' hops';
  return String(total) + ' (' + String(unique) + ' unique)';
}
function renderRepeatBadgeHtml(key, count, expanded) {
  if (!key || count < 2) return '';
  var label = expanded ? '▼' : '×' + count;
  var enc = encodeURIComponent(key);
  return ' <button type="button" class="badge repeat" data-unique-expand="' + enc + '" title="' + count + ' identical requests — click to ' + (expanded ? 'collapse' : 'expand') + '">' + label + '</button>';
}
function parseBodyJson(text) {
  if (text == null || text === '') return { ok: false, value: null, raw: '' };
  var raw = String(text);
  try {
    return { ok: true, value: JSON.parse(raw), raw: raw };
  } catch (err) {
    return { ok: false, value: null, raw: raw };
  }
}
function pushErrorItem(out, item) {
  if (!item || !item.message) return;
  var msg = String(item.message).trim();
  if (!msg) return;
  for (var i = 0; i < out.length; i++) {
    if (out[i].message === msg && out[i].where === item.where) return;
  }
  out.push(item);
}
function isErrorishObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  if (typeof obj.message === 'string' && obj.message) return true;
  if (typeof obj.ErrorMessage === 'string' && obj.ErrorMessage) return true;
  if (typeof obj.errorMessage === 'string' && obj.errorMessage) return true;
  if (typeof obj.error === 'string' && obj.error) return true;
  if (obj.exception != null) return true;
  if (obj.stacktrace != null || obj.stack != null) return true;
  if (typeof obj.code === 'string' && /error|fail|exception|fault/i.test(obj.code)) return true;
  return false;
}
function messageFromErrorish(obj) {
  if (!obj || typeof obj !== 'object') return '';
  if (typeof obj.message === 'string' && obj.message) return obj.message;
  if (typeof obj.ErrorMessage === 'string' && obj.ErrorMessage) return obj.ErrorMessage;
  if (typeof obj.errorMessage === 'string' && obj.errorMessage) return obj.errorMessage;
  if (typeof obj.error === 'string' && obj.error) return obj.error;
  if (typeof obj.code === 'string' && obj.code) return String(obj.code);
  if (obj.exception && typeof obj.exception === 'object' && typeof obj.exception.message === 'string') {
    return obj.exception.message;
  }
  return 'error';
}
function collectGraphqlErrorsFromNode(node, where, out, depth) {
  if (node == null || depth > 6) return;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) collectGraphqlErrorsFromNode(node[i], where + '[' + i + ']', out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  if (Array.isArray(node.errors) && node.errors.length) {
    collectGraphqlErrorsFromNode(node.errors, where ? where + '.errors' : 'errors', out, depth + 1);
  }
  if (isErrorishObject(node) && (where.indexOf('errors') >= 0 || where.indexOf('extensions') >= 0)) {
    var pathStr = '';
    if (Array.isArray(node.path)) pathStr = node.path.join('.');
    else if (node.path != null) pathStr = String(node.path);
    var code = null;
    if (node.extensions && typeof node.extensions === 'object' && node.extensions.code != null) code = node.extensions.code;
    else if (node.code != null) code = node.code;
    else if (node.StatusCode != null) code = node.StatusCode;
    pushErrorItem(out, {
      message: messageFromErrorish(node),
      code: code != null ? String(code) : null,
      path: pathStr || null,
      where: where || 'errors'
    });
  }
  if (node.extensions != null) collectExtensionErrors(node.extensions, where ? where + '.extensions' : 'extensions', out, depth + 1);
}
function collectExtensionErrors(ext, where, out, depth) {
  if (ext == null || depth > 6) return;
  if (Array.isArray(ext)) {
    for (var i = 0; i < ext.length; i++) collectExtensionErrors(ext[i], where + '[' + i + ']', out, depth + 1);
    return;
  }
  if (typeof ext !== 'object') return;
  if (isErrorishObject(ext)) {
    pushErrorItem(out, {
      message: messageFromErrorish(ext),
      code: ext.code != null ? String(ext.code) : null,
      path: null,
      where: where
    });
  }
  var keys = ['errors', 'error', 'exception', 'exceptions', 'fault', 'failures', 'problem', 'problems'];
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (ext[key] != null) collectGraphqlErrorsFromNode(ext[key], where + '.' + key, out, depth + 1);
  }
  if (typeof ext.code === 'string' && /error|fail|exception|fault/i.test(ext.code) && !isErrorishObject(ext)) {
    pushErrorItem(out, { message: String(ext.code), code: String(ext.code), path: null, where: where });
  }
}
function collectBodyErrorItems(parsed, raw) {
  var out = [];
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    collectGraphqlErrorsFromNode(parsed, '', out, 0);
    if (typeof parsed.ErrorMessage === 'string' && parsed.ErrorMessage) {
      pushErrorItem(out, {
        message: parsed.ErrorMessage,
        code: parsed.StatusCode != null ? String(parsed.StatusCode) : null,
        path: null,
        where: 'body'
      });
    }
    if (parsed.success === false) {
      pushErrorItem(out, {
        message: (typeof parsed.message === 'string' && parsed.message) ? parsed.message : 'success: false',
        code: parsed.code != null ? String(parsed.code) : null,
        path: null,
        where: 'body'
      });
    }
  }
  if (!out.length && raw) {
    var lower = raw.toLowerCase();
    if (lower.indexOf('"errors"') >= 0 || lower.indexOf('"errormessage"') >= 0) {
      pushErrorItem(out, {
        message: 'Error payload detected (body may be truncated)',
        code: null,
        path: null,
        where: 'body-scan'
      });
    }
  }
  return out;
}
/** Analyze hop for HTTP / network / GraphQL / extension / body errors. */
function analyzeHopErrors(e) {
  var items = [];
  var httpError = typeof e.status === 'number' && e.status >= 400;
  var networkError = e.source === 'error' || e.source === 'blocked';
  if (e.errorMessage) {
    pushErrorItem(items, { message: String(e.errorMessage), code: null, path: null, where: 'errorMessage' });
  }
  var parsedRes = parseBodyJson(e.responseBodyPreview);
  var bodyItems = collectBodyErrorItems(parsedRes.value, parsedRes.raw);
  for (var i = 0; i < bodyItems.length; i++) items.push(bodyItems[i]);
  var graphqlError = false;
  for (var j = 0; j < items.length; j++) {
    var w = String(items[j].where || '');
    if (w.indexOf('errors') === 0 || w.indexOf('extensions') === 0 || w === 'body-scan') graphqlError = true;
  }
  if (parsedRes.ok && parsedRes.value && typeof parsedRes.value === 'object' && !Array.isArray(parsedRes.value)) {
    if (Array.isArray(parsedRes.value.errors) && parsedRes.value.errors.length) graphqlError = true;
    if (parsedRes.value.extensions != null && bodyItems.length) graphqlError = true;
  }
  var bodyError = items.length > 0 && !graphqlError && !httpError && !networkError;
  var isError = httpError || networkError || items.length > 0;
  var badgeLabel = 'error';
  if (graphqlError) badgeLabel = 'GQL error';
  else if (httpError) badgeLabel = 'HTTP ' + e.status;
  else if (networkError) badgeLabel = 'network';
  else if (items.length) badgeLabel = 'error';
  var summary = items.length ? items[0].message : (httpError ? ('HTTP ' + e.status) : (networkError ? 'network error' : ''));
  if (items.length > 1) summary += ' (+' + (items.length - 1) + ' more)';
  return {
    isError: isError,
    httpError: httpError,
    networkError: networkError,
    graphqlError: graphqlError,
    bodyError: bodyError,
    badgeLabel: badgeLabel,
    summary: summary,
    items: items
  };
}
/**
 * Keep matched hops plus ancestors (overlying) and descendants (underlying) via parentRequestId.
 * @param {Array} list
 * @param {(e: any) => boolean} matchFn
 */
function expandMatchedContextHops(list, matchFn) {
  var byReq = {};
  var childrenOf = {};
  list.forEach(function (e) {
    if (e.requestId) byReq[e.requestId] = e;
    if (e.parentRequestId) {
      if (!childrenOf[e.parentRequestId]) childrenOf[e.parentRequestId] = [];
      childrenOf[e.parentRequestId].push(e);
    }
  });
  var keep = {};
  function markAncestors(e) {
    var cur = e;
    var guard = 0;
    while (cur && guard++ < 48) {
      keep[cur.id] = true;
      if (!cur.parentRequestId) break;
      cur = byReq[cur.parentRequestId];
    }
  }
  function markDescendants(e) {
    if (!e || !e.requestId) return;
    var stack = (childrenOf[e.requestId] || []).slice();
    var guard = 0;
    while (stack.length && guard++ < 4000) {
      var child = stack.pop();
      keep[child.id] = true;
      if (child.requestId && childrenOf[child.requestId]) {
        childrenOf[child.requestId].forEach(function (c) { stack.push(c); });
      }
    }
  }
  var any = false;
  list.forEach(function (e) {
    if (!matchFn(e)) return;
    any = true;
    markAncestors(e);
    markDescendants(e);
  });
  if (!any) return [];
  return list.filter(function (e) { return !!keep[e.id]; });
}
/** @deprecated use expandMatchedContextHops — kept for callers/tests */
function expandErrorContextHops(list, analyzeFn) {
  var analyze = analyzeFn || analyzeHopErrors;
  return expandMatchedContextHops(list, function (e) { return !!analyze(e).isError; });
}
/** Default slow threshold (ms) — matches detectResponseAnomalies; override via DATA.slowThresholdMs / MOCKIFYER_ATLAS_SLOW_MS. */
var ATLAS_DEFAULT_SLOW_MS = 3000;
function isSlowHop(e, thresholdMs) {
  var th = typeof thresholdMs === 'number' && thresholdMs > 0 ? thresholdMs : ATLAS_DEFAULT_SLOW_MS;
  var dur = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
  return typeof dur === 'number' && dur >= th;
}
function statusClassFor(status, analysis) {
  if (analysis && analysis.isError) return 'status-err';
  if (typeof status !== 'number') return 'status-muted';
  if (status >= 400) return 'status-err';
  if (status >= 300) return 'status-warn';
  return 'status-ok';
}
function hopStatusBadgesHtml(e) {
  var a = analyzeHopErrors(e);
  var html = '';
  if (e.status != null) {
    html += ' <span class="badge ' + statusClassFor(e.status, a) + '">' + String(e.status) + '</span>';
  }
  if (a.isError) {
    var title = a.summary || a.badgeLabel;
    html += ' <span class="badge err" title="' + String(title).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' + a.badgeLabel + '</span>';
  }
  return html;
}
function hopDurationBadgeHtml(e, thresholdMs) {
  var dur = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
  if (dur == null) return '';
  var slow = typeof dur === 'number' && dur >= (thresholdMs || ATLAS_DEFAULT_SLOW_MS);
  var estimated = e.durationMs == null && e._estimatedDurationMs != null;
  var label = String(dur) + 'ms' + (estimated ? '~' : '');
  if (!slow) {
    return ' <span class="badge' + (estimated ? ' dur-est' : '') + '" title="' + (estimated ? 'Estimated from child hop span (parent duration not captured)' : '') + '">' + label + '</span>';
  }
  return ' <span class="badge slow" title="' + (estimated ? 'Estimated from child hop span · ' : '') + 'Slow (≥ ' + String(thresholdMs || ATLAS_DEFAULT_SLOW_MS) + 'ms)">' + label + '</span>';
}
function renderSlowPanelHtml(e, thresholdMs, escFn) {
  if (!isSlowHop(e, thresholdMs)) return '';
  var th = typeof thresholdMs === 'number' && thresholdMs > 0 ? thresholdMs : ATLAS_DEFAULT_SLOW_MS;
  var dur = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
  var estimated = e.durationMs == null && e._estimatedDurationMs != null;
  var html = '<div class="slow-panel">';
  html += '<div class="slow-panel-title">Slow response' + (estimated ? ' (estimated)' : '') + '</div>';
  html += '<div class="slow-item"><div class="slow-msg">' + escFn(String(dur) + 'ms' + (estimated ? '~' : '')) + '</div>';
  html += '<div class="slow-meta">threshold ≥ ' + escFn(String(th)) + 'ms';
  if (estimated) html += ' · estimated from child hop wall-clock span';
  html += '</div></div>';
  html += '</div>';
  return html;
}
function prettyJsonText(text) {
  if (text == null || text === '') return null;
  var parsed = parseBodyJson(text);
  if (parsed.ok) {
    try { return JSON.stringify(parsed.value, null, 2); } catch (err) { return parsed.raw; }
  }
  return parsed.raw;
}
function highlightJsonHtml(prettyText) {
  if (prettyText == null || prettyText === '') return '';
  var s = String(prettyText);
  var out = '';
  var i = 0;
  function escSlice(from, to) {
    return s.slice(from, to)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  while (i < s.length) {
    var ch = s.charAt(i);
    if (ch === '"') {
      var j = i + 1;
      while (j < s.length) {
        if (s.charAt(j) === '\\\\') { j += 2; continue; }
        if (s.charAt(j) === '"') { j += 1; break; }
        j += 1;
      }
      var strHtml = escSlice(i, j);
      var k = j;
      while (k < s.length && (s.charAt(k) === ' ' || s.charAt(k) === '\\t')) k += 1;
      if (s.charAt(k) === ':') {
        out += '<span class="json-k">' + strHtml + '</span>';
      } else {
        out += '<span class="json-s">' + strHtml + '</span>';
      }
      i = j;
      continue;
    }
    if (ch === 't' && s.slice(i, i + 4) === 'true') {
      out += '<span class="json-b">true</span>';
      i += 4;
      continue;
    }
    if (ch === 'f' && s.slice(i, i + 5) === 'false') {
      out += '<span class="json-b">false</span>';
      i += 5;
      continue;
    }
    if (ch === 'n' && s.slice(i, i + 4) === 'null') {
      out += '<span class="json-null">null</span>';
      i += 4;
      continue;
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      var n = i + 1;
      while (n < s.length) {
        var c = s.charAt(n);
        if ((c >= '0' && c <= '9') || c === '.' || c === 'e' || c === 'E' || c === '+' || c === '-') n += 1;
        else break;
      }
      out += '<span class="json-n">' + escSlice(i, n) + '</span>';
      i = n;
      continue;
    }
    out += escSlice(i, i + 1);
    i += 1;
  }
  return out;
}
function renderJsonPre(text) {
  var pretty = prettyJsonText(text);
  if (pretty == null) return '<p class="empty">No body captured.</p>';
  return '<pre class="json">' + highlightJsonHtml(pretty) + '</pre>';
}
function renderErrorPanelHtml(analysis, escFn) {
  if (!analysis || !analysis.isError) return '';
  var html = '<div class="error-panel">';
  html += '<div class="error-panel-title">' + escFn(analysis.badgeLabel);
  if (analysis.graphqlError) html += ' · check GraphQL errors / extensions';
  html += '</div>';
  if (!analysis.items.length) {
    html += '<div class="error-item">' + escFn(analysis.summary || 'Request failed') + '</div>';
  } else {
    analysis.items.forEach(function (it) {
      html += '<div class="error-item">';
      html += '<div class="error-msg">' + escFn(it.message) + '</div>';
      var meta = [];
      if (it.code) meta.push('code ' + it.code);
      if (it.path) meta.push('path ' + it.path);
      if (it.where) meta.push(it.where);
      if (meta.length) html += '<div class="error-meta">' + escFn(meta.join(' · ')) + '</div>';
      html += '</div>';
    });
  }
  html += '</div>';
  return html;
}
  var raw = document.getElementById('atlas-data');
  if (!raw) return;
  var DATA = JSON.parse(raw.textContent);
  var doc = DATA.doc || {};
  var events = DATA.events || [];
  /** Fill missing parent durationMs from child wall-clock span (GraphQL BFF often lacked client duration). */
  (function estimateMissingParentDurations(list) {
    var childrenOf = {};
    list.forEach(function (e) {
      if (!e.parentRequestId) return;
      if (!childrenOf[e.parentRequestId]) childrenOf[e.parentRequestId] = [];
      childrenOf[e.parentRequestId].push(e);
    });
    list.forEach(function (e) {
      if (typeof e.durationMs === 'number') return;
      if (!e.requestId || !childrenOf[e.requestId]) return;
      var parentStart = new Date(e.timestamp).getTime();
      if (!isFinite(parentStart)) return;
      var maxEnd = parentStart;
      childrenOf[e.requestId].forEach(function (c) {
        var cs = new Date(c.timestamp).getTime();
        var cd = typeof c.durationMs === 'number' ? c.durationMs : 0;
        if (isFinite(cs)) maxEnd = Math.max(maxEnd, cs + cd);
      });
      var est = Math.round(maxEnd - parentStart);
      if (est > 0) e._estimatedDurationMs = est;
    });
  })(events);
  var collapsed = {};
  var view = 'map';
  var selectedId = null;
  /** Map selection: { type: 'page'|'prefetch'|'node', id, pageId? } */
  var selectedMap = null;
  /** Traffic lanes — Noise off by default to cut probe/analytics clutter. */
  var kindEnabled = { cms: true, bff: true, backend: true, other: true, noise: false };
  var errorsOnly = false;
  var slowOnly = false;
  var slowThresholdMs = (DATA.slowThresholdMs > 0) ? DATA.slowThresholdMs : ATLAS_DEFAULT_SLOW_MS;
  var uniqueMode = 'off';
  var uniqueScope = 'global';
  var uniqueKeep = 'first';
  var expandedUniqueGroups = {};
  /** Selected journey strip step key (scrolls / highlights matching group). */
  var selectedJourneyStep = null;
  var KIND_ORDER = ['cms', 'bff', 'backend', 'other', 'noise'];
  var KIND_META = {
    cms: { label: 'CMS', hint: 'deliveryapi / Umbraco content' },
    bff: { label: 'BFF', hint: 'capp GraphQL gateway' },
    backend: { label: 'Backend', hint: 'booking / CRM / tokens / hotspot' },
    other: { label: 'Other', hint: 'uncategorized' },
    noise: { label: 'Noise', hint: 'probes / diagnostics' }
  };

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
  function prettyBody(text) {
    return prettyJsonText(text);
  }
  /** Reverse map hop.id → prefetch entry (rebuilt each render). */
  var prefetchByHopId = null;
  function getPrefetchByHopId() {
    if (prefetchByHopId) return prefetchByHopId;
    prefetchByHopId = {};
    var prefs = doc.prefetches || {};
    Object.keys(prefs).forEach(function (pid) {
      var pref = prefs[pid];
      if (pref && pref.lastRequestId && String(pref.lastRequestId).indexOf('prefetch-') !== 0) {
        var byId = findByRequestId(pref.lastRequestId);
        if (byId) prefetchByHopId[byId.id] = { id: pid, pref: pref };
      }
    });
    var matched = matchPrefetchesToHops();
    Object.keys(matched).forEach(function (pid) {
      var hop = matched[pid];
      if (hop && !prefetchByHopId[hop.id]) {
        prefetchByHopId[hop.id] = { id: pid, pref: prefs[pid] };
      }
    });
    return prefetchByHopId;
  }
  function prefetchLaneLabel(pref, hop) {
    var ds = String((pref && pref.datasourceId) || '');
    var lane = hop ? hopKind(hop) : 'other';
    var kind = String((pref && pref.kind) || '');
    if (lane === 'cms' || ds.indexOf('oden:') === 0 || ds.indexOf('deliveryapi') >= 0) return 'Prefetch CMS';
    if (lane === 'bff' || kind === 'graphql' || ds.indexOf('graphql') >= 0) return 'Prefetch GraphQL';
    if (lane === 'backend' || ds.indexOf('crm') >= 0 || ds.indexOf('booking') >= 0) return 'Prefetch backend';
    if (ds.indexOf('prefetch-spec') === 0 || ds === 'prefetch-specification') return 'Prefetch spec';
    return 'Prefetch';
  }
  /**
   * Best-effort “what triggered this hop”: prefetch map, parent chain, or screen usage.
   */
  function resolveHopTrigger(e, depth) {
    depth = depth || 0;
    if (!e || depth > 4) {
      return { kind: 'unknown', label: 'Unattributed', detail: 'No trigger annotation', badgeClass: 'trigger-unknown' };
    }
    var prefHit = getPrefetchByHopId()[e.id];
    if (prefHit && prefHit.pref) {
      var pref = prefHit.pref;
      var phase = (pref.phases && pref.phases.length) ? pref.phases.join('+') : 'prefetch';
      var lane = prefetchLaneLabel(pref, e);
      var ds = pref.datasourceId || prefHit.id;
      var ops = (pref.operations && pref.operations.length) ? pref.operations.join(', ') : '';
      var detail = lane + ' · phase ' + phase + ' · ' + ds;
      if (ops) detail += ' · ' + ops;
      return { kind: 'prefetch', label: lane, detail: detail, badgeClass: 'trigger-prefetch', phase: phase, datasourceId: ds };
    }
    var us = usageList(e.usage);
    for (var i = 0; i < us.length; i++) {
      var u = us[i];
      var comp = String(u.component || '').toLowerCase();
      if (comp.indexOf('prefetch') >= 0) {
        var plabel = u.label || u.datasourceId || 'Prefetch';
        if (String(u.datasourceId || '').indexOf('oden:') === 0) plabel = 'Prefetch CMS';
        return {
          kind: 'prefetch',
          label: plabel.indexOf('Prefetch') === 0 ? plabel : ('Prefetch · ' + plabel),
          detail: formatUsage(u),
          badgeClass: 'trigger-prefetch',
          datasourceId: u.datasourceId
        };
      }
    }
    if (e.parentRequestId) {
      var parent = findByRequestId(e.parentRequestId);
      if (parent) {
        var parentTrig = resolveHopTrigger(parent, depth + 1);
        var parentPath = shortPathLabel(parent.path || parent.url);
        var detailC = 'Child of ' + parent.method + ' ' + parentPath;
        if (parentTrig.kind === 'prefetch') detailC += ' · via ' + parentTrig.label;
        else if (parentTrig.kind === 'navigation') detailC += ' · on ' + parentTrig.label;
        return {
          kind: 'child',
          label: 'Child hop',
          detail: detailC,
          badgeClass: 'trigger-child',
          parentId: parent.id
        };
      }
    }
    if (us.length) {
      var u0 = us[0];
      if (u0.screen) {
        var navLabel = 'Screen · ' + u0.screen;
        var navDetail = 'Navigation / screen context';
        if (u0.component) navDetail += ' · ' + u0.component;
        if (u0.cms && u0.cms.pageId) navDetail += ' · CMS page ' + u0.cms.pageId;
        if (u0.datasourceId) navDetail += ' · ' + u0.datasourceId;
        return { kind: 'navigation', label: navLabel, detail: navDetail, badgeClass: 'trigger-navigation', screen: u0.screen };
      }
      if (u0.component || u0.label || u0.datasourceId) {
        return {
          kind: 'navigation',
          label: formatUsage(u0),
          detail: formatUsage(u0),
          badgeClass: 'trigger-navigation'
        };
      }
    }
    return { kind: 'unknown', label: 'Unattributed', detail: 'No screen / prefetch annotation on this hop', badgeClass: 'trigger-unknown' };
  }
  function hopTriggerBadgeHtml(e) {
    var t = resolveHopTrigger(e);
    return ' <span class="badge trigger ' + t.badgeClass + '" title="' + esc(t.detail) + '">' + esc(t.label) + '</span>';
  }
  function renderTriggerPanelHtml(e) {
    var t = resolveHopTrigger(e);
    var html = '<div class="trigger-panel">';
    html += '<div class="trigger-panel-title">Triggered by</div>';
    html += '<div class="trigger-detail">' + esc(t.detail) + '</div>';
    if (t.kind === 'prefetch' && t.phase) {
      html += '<div class="trigger-meta">prefetch phase: ' + esc(t.phase) + '</div>';
    }
    if (t.kind === 'child' && e.parentRequestId) {
      html += '<div class="trigger-meta">parentRequestId <code>' + esc(e.parentRequestId) + '</code></div>';
    }
    if (t.screen) html += '<div class="trigger-meta">screen <code>' + esc(t.screen) + '</code></div>';
    if (t.datasourceId) html += '<div class="trigger-meta">datasource <code>' + esc(t.datasourceId) + '</code></div>';
    html += '</div>';
    return html;
  }
  function applyIssueFilters(list) {
    if (!errorsOnly && !slowOnly) return list;
    var keep = {};
    function merge(subset) {
      subset.forEach(function (e) { keep[e.id] = true; });
    }
    if (errorsOnly) {
      merge(expandMatchedContextHops(list, function (e) { return analyzeHopErrors(e).isError; }));
    }
    if (slowOnly) {
      merge(expandMatchedContextHops(list, function (e) { return isSlowHop(e, slowThresholdMs); }));
    }
    return list.filter(function (e) { return !!keep[e.id]; });
  }
  function countErrors(list) {
    var n = 0;
    list.forEach(function (e) { if (analyzeHopErrors(e).isError) n++; });
    return n;
  }
  function countSlow(list) {
    var n = 0;
    list.forEach(function (e) { if (isSlowHop(e, slowThresholdMs)) n++; });
    return n;
  }
  function hopRowIssueClass(e) {
    var err = analyzeHopErrors(e).isError;
    var slow = isSlowHop(e, slowThresholdMs);
    if (err) return ' has-error';
    if (slow) return ' has-slow';
    if (errorsOnly || slowOnly) return ' error-context';
    return '';
  }
  function hopContextBadgeHtml(e) {
    var err = analyzeHopErrors(e).isError;
    var slow = isSlowHop(e, slowThresholdMs);
    if (!(errorsOnly || slowOnly) || err || slow) return '';
    return ' <span class="badge ctx" title="Kept for chain context around an error or slow hop">context</span>';
  }
  function eventHost(e) {
    if (e && e.host) return e.host;
    try { return new URL(e.url).host || '(unknown)'; } catch (err) { return '(unknown)'; }
  }
  /** Compact local datetime for list rows. */
  function formatWhen(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      function pad(n) { return n < 10 ? '0' + n : String(n); }
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    } catch (err) {
      return String(ts);
    }
  }
  /** Classify hop for CMS vs app-backend separation. */
  function hopKind(e) {
    var path = String((e && e.path) || (e && e.url) || '').toLowerCase();
    var host = String(eventHost(e) || '').toLowerCase();
    if (path.indexOf('deliveryapi') >= 0 || path.indexOf('/umbraco') >= 0) return 'cms';
    if (path.indexOf('/graphql') >= 0 || path.indexOf('capp-graphql') >= 0) return 'bff';
    if (
      host.indexOf('google') >= 0 ||
      path.indexOf('generate_204') >= 0 ||
      path.indexOf('/mobile/events') >= 0 ||
      path.indexOf('/diagnostic') >= 0
    ) return 'noise';
    if (
      host.indexOf('booking') >= 0 ||
      host.indexOf('crm') >= 0 ||
      host.indexOf('token') >= 0 ||
      host.indexOf('member') >= 0 ||
      host.indexOf('origo') >= 0 ||
      host.indexOf('hotspot') >= 0 ||
      path.indexOf('/api/booking') >= 0
    ) return 'backend';
    return 'other';
  }
  function applyKindFilter(list) {
    return applyIssueFilters(list.filter(function (e) { return kindEnabled[hopKind(e)] !== false; }));
  }
  function countByKind(list) {
    var counts = { cms: 0, bff: 0, backend: 0, other: 0, noise: 0 };
    list.forEach(function (e) { counts[hopKind(e)] = (counts[hopKind(e)] || 0) + 1; });
    return counts;
  }
  function renderKindFilters(_list) {
    // Counts ignore issue toggles so buttons stay stable while filtering.
    var kindBase = filterEvents().filter(function (e) { return kindEnabled[hopKind(e)] !== false; });
    var counts = countByKind(kindBase);
    var errCount = countErrors(kindBase);
    var slowCount = countSlow(kindBase);
    var html = '<div class="kind-filters"><span class="label">Show:</span>';
    KIND_ORDER.forEach(function (k) {
      var meta = KIND_META[k];
      var on = kindEnabled[k] !== false;
      html += '<button type="button" class="' + (on ? 'on' : '') + '" data-kind-toggle="' + k + '" title="' + esc(meta.hint) + '">';
      html += esc(meta.label) + '<span class="n">' + (counts[k] || 0) + '</span></button>';
    });
    html += '<button type="button" class="errors-toggle' + (errorsOnly ? ' on' : '') + '" data-errors-only="1" title="Show errors plus parent/child hops in the same chain (parentRequestId). HTTP 4xx/5xx, network, GraphQL errors / extensions, ErrorMessage bodies.">';
    html += 'Errors<span class="n">' + errCount + '</span></button>';
    html += '<button type="button" class="slow-toggle' + (slowOnly ? ' on' : '') + '" data-slow-only="1" title="Show slow hops (≥ ' + slowThresholdMs + 'ms) plus parent/child chain context. Override with MOCKIFYER_ATLAS_SLOW_MS when rendering.">';
    html += 'Slow<span class="n">' + slowCount + '</span></button>';
    html += '</div>';
    return html;
  }
  function buildViewList() {
    var base = applyKindFilter(filterEvents());
    return applyUniqueFilter(base, { mode: uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
  }
  function renderUniqueFilters(baseList, uniqueMeta) {
    var html = '<div class="unique-filters"><span class="label">Unique:</span>';
    html += '<button type="button" class="' + (uniqueMode === 'off' ? 'on' : '') + '" data-unique-mode="off">All</button>';
    html += '<button type="button" class="' + (uniqueMode === 'endpoint' ? 'on' : '') + '" data-unique-mode="endpoint">Endpoints</button>';
    html += '<button type="button" class="' + (uniqueMode === 'request' ? 'on' : '') + '" data-unique-mode="request">Requests</button>';
    if (uniqueMode !== 'off') {
      html += '<span class="meta unique-summary">' + esc(String(uniqueMeta.totalCount)) + ' hops → ' + esc(String(uniqueMeta.uniqueCount)) + ' unique</span>';
    }
    html += '</div>';
    if (uniqueMode !== 'off') {
      html += '<div class="unique-filters secondary"><span class="label">Scope:</span>';
      html += '<button type="button" class="' + (uniqueScope === 'global' ? 'on' : '') + '" data-unique-scope="global">Global</button>';
      html += '<button type="button" class="' + (uniqueScope === 'per-screen' ? 'on' : '') + '" data-unique-scope="per-screen">Per screen</button>';
      html += '<span class="label">Keep:</span>';
      html += '<button type="button" class="' + (uniqueKeep === 'first' ? 'on' : '') + '" data-unique-keep="first">First</button>';
      html += '<button type="button" class="' + (uniqueKeep === 'last' ? 'on' : '') + '" data-unique-keep="last">Last</button>';
      html += '<button type="button" class="' + (uniqueKeep === 'slowest' ? 'on' : '') + '" data-unique-keep="slowest">Slowest</button>';
      html += '</div>';
      if (view === 'waterfall' || view === 'gantt') {
        html += '<p class="meta unique-hint">Unique mode hides repeat timing — switch to All to compare latencies.</p>';
      }
    }
    return html;
  }
  function renderListFilters(baseList, uniqueMeta) {
    return renderKindFilters(baseList) + renderUniqueFilters(baseList, uniqueMeta);
  }
  function hopCountLabel(hops) {
    if (!hops || !hops.length) return '0 hops';
    if (uniqueMode === 'off') return hops.length + ' hops';
    var u = applyUniqueFilter(hops, { mode: uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
    return formatHopCountLabel(hops.length, u.uniqueCount, uniqueMode);
  }
  function repeatBadgeHtml(uniqueMeta, e) {
    if (!uniqueMeta || uniqueMode === 'off') return '';
    var k = uniqueMeta.keyFor(e);
    var count = uniqueMeta.repeatCountByKey[k] || 1;
    return renderRepeatBadgeHtml(k, count, !!expandedUniqueGroups[k]);
  }
  function renderDupMemberRows(uniqueMeta, rep, padBase, depth) {
    if (!uniqueMeta || uniqueMode === 'off') return '';
    var k = uniqueMeta.keyFor(rep);
    if (!expandedUniqueGroups[k]) return '';
    var members = uniqueMeta.membersByKey[k] || [];
    var html = '';
    var pad = (padBase || 8) + (depth || 0) * 14 + 14;
    members.forEach(function (m) {
      if (m.id === rep.id) return;
      html += '<div class="hop-row dup-member' + (selectedId === m.id ? ' selected' : '') + hopRowIssueClass(m) + '" style="padding-left:' + pad + 'px" data-select="' + esc(m.id) + '">';
      html += '<span class="chev"></span><div class="hop-path"><strong>' + esc(m.method) + '</strong> ' + esc(m.path || m.url);
      html += ' <span class="meta">' + esc(formatWhen(m.timestamp)) + '</span>';
      html += hopStatusBadgesHtml(m);
      html += hopDurationBadgeHtml(m, slowThresholdMs);
      html += hopTriggerBadgeHtml(m);
      html += hopContextBadgeHtml(m);
      html += '</div></div>';
    });
    return html;
  }
  /** Missing key → defaultCollapsed (pages / hop trees / prefetches start collapsed; domains open). */
  function defaultCollapsedFor(id) {
    var s = String(id);
    if (s.indexOf('domain:') === 0 || s.indexOf('wf-domain:') === 0 || s.indexOf('kind:') === 0 || s.indexOf('wf-kind:') === 0) return false;
    return true;
  }
  function isCollapsed(id) {
    if (Object.prototype.hasOwnProperty.call(collapsed, id)) return !!collapsed[id];
    return defaultCollapsedFor(id);
  }
  function toggleCollapsed(id) {
    collapsed[id] = !isCollapsed(id);
  }
  function findEvent(id) {
    for (var i = 0; i < events.length; i++) if (events[i].id === id) return events[i];
    return null;
  }
  function findByRequestId(rid) {
    if (!rid) return null;
    for (var i = 0; i < events.length; i++) if (events[i].requestId === rid) return events[i];
    return null;
  }

  function renderHopBodies(e) {
    var html = '';
    html += '<div class="body-label">Request body</div>';
    html += e.requestBodyPreview ? renderJsonPre(e.requestBodyPreview) : '<p class="empty">No request body captured.</p>';
    html += '<div class="body-label">Response body</div>';
    html += e.responseBodyPreview ? renderJsonPre(e.responseBodyPreview) : '<p class="empty">No response body captured.</p>';
    return html;
  }

  function renderHopSummary(e) {
    var analysis = analyzeHopErrors(e);
    var html = '<h3>' + esc(e.method) + ' ' + esc(e.path || e.url) + '</h3>';
    html += '<p class="meta">' + esc(eventHost(e)) + '<br/>' + esc(e.timestamp);
    html += hopStatusBadgesHtml(e);
    html += hopDurationBadgeHtml(e, slowThresholdMs);
    html += hopTriggerBadgeHtml(e);
    html += ' · ' + esc(e.source) + '</p>';
    if (e.requestId) html += '<p class="meta">requestId <code>' + esc(e.requestId) + '</code></p>';
    if (e.parentRequestId) html += '<p class="meta">parentRequestId <code>' + esc(e.parentRequestId) + '</code></p>';
    var us = usageList(e.usage);
    if (us.length) html += '<p class="used-by">used by: ' + us.map(formatUsage).map(esc).join(', ') + '</p>';
    html += renderTriggerPanelHtml(e);
    html += renderErrorPanelHtml(analysis, esc);
    html += renderSlowPanelHtml(e, slowThresholdMs, esc);
    html += renderHopBodies(e);
    return html;
  }

  function renderDetail(el) {
    if (!el) return;
    if (selectedMap && selectedMap.type === 'page') {
      var page = (doc.pages || {})[selectedMap.id];
      if (!page) { el.innerHTML = '<p class="empty">Page not found</p>'; return; }
      var pageHops = hopsForPage(page);
      var html = '<h3>' + esc(page.pageSlug || page.pageId) + '</h3>';
      html += '<p class="meta">pageId <code>' + esc(page.pageId) + '</code>';
      if (page.documentId) html += '<br/>documentId <code>' + esc(page.documentId) + '</code>';
      html += '<br/>lastSeenAt ' + esc(page.lastSeenAt || '') + '</p>';
      if (page.editUrl) html += '<p class="meta"><a href="' + esc(page.editUrl) + '" target="_blank" rel="noopener noreferrer">Edit page in CMS ↗</a></p>';
      html += '<div class="body-label">Linked hops (' + pageHops.length + ')</div>';
      if (!pageHops.length) html += '<p class="empty">No hops linked yet (usage screen / datasource requestId).</p>';
      else {
        pageHops.forEach(function (hop) {
          html += '<div class="map-row' + (selectedId === hop.id ? ' selected' : '') + '" data-select="' + esc(hop.id) + '">';
          html += '<div class="col"><strong>' + esc(hop.method) + '</strong> ' + esc(hop.path || hop.url) + '</div>';
          html += '<div class="col-side">' + esc(formatWhen(hop.timestamp)) + '</div></div>';
        });
        html += '<p class="meta">Click a hop row above (or in the page list) for request / response bodies.</p>';
      }
      var nodes = Object.keys(page.nodes || {});
      html += '<div class="body-label">Nodes (' + nodes.length + ')</div>';
      nodes.forEach(function (nid) {
        var n = page.nodes[nid];
        html += '<div class="map-row" data-select-node="' + esc(page.pageId) + '" data-node-id="' + esc(nid) + '">';
        html += '<div class="col"><strong>' + esc(n.label || n.type) + '</strong> <span class="badge">' + esc(n.source) + '</span>';
        html += '<div class="meta">' + esc(n.path) + '</div></div></div>';
      });
      el.innerHTML = html;
      return;
    }
    if (selectedMap && selectedMap.type === 'node') {
      var pg = (doc.pages || {})[selectedMap.pageId];
      var node = pg && pg.nodes ? pg.nodes[selectedMap.id] : null;
      if (!node) { el.innerHTML = '<p class="empty">Node not found</p>'; return; }
      var htmlN = '<h3>' + esc(node.label || node.type) + '</h3>';
      htmlN += '<p class="meta">type <code>' + esc(node.type) + '</code> · ' + esc(node.source);
      htmlN += '<br/>path <code>' + esc(node.path) + '</code></p>';
      if (node.editUrl) htmlN += '<p class="meta"><a href="' + esc(node.editUrl) + '" target="_blank" rel="noopener noreferrer">Edit in CMS ↗</a></p>';
      if (node.datasources && node.datasources.length) {
        htmlN += '<div class="body-label">Datasources</div><ul>';
        node.datasources.forEach(function (d) {
          var hop = findByRequestId(d.lastRequestId);
          htmlN += '<li><code>' + esc(d.datasourceId) + '</code>';
          if (hop) htmlN += ' · <a href="#" data-select="' + esc(hop.id) + '">' + esc(hop.method + ' ' + (hop.path || hop.url)) + '</a>';
          else if (d.lastRequestId) htmlN += ' · lastRequestId <code>' + esc(d.lastRequestId) + '</code>';
          htmlN += '</li>';
        });
        htmlN += '</ul>';
      }
      if (node.propsSample != null) {
        htmlN += '<div class="body-label">Last sample</div>';
        htmlN += renderJsonPre(typeof node.propsSample === 'string' ? node.propsSample : JSON.stringify(node.propsSample));
      }
      var firstHop = null;
      (node.datasources || []).some(function (d) { firstHop = findByRequestId(d.lastRequestId); return !!firstHop; });
      if (firstHop) {
        htmlN += '<div class="body-label">Linked hop</div>' + renderHopSummary(firstHop);
      } else {
        htmlN += '<p class="empty">No linked network hop for this node yet.</p>';
      }
      el.innerHTML = htmlN;
      return;
    }
    if (selectedMap && selectedMap.type === 'screen') {
      var scDoc = (doc.screens || {})[selectedMap.id];
      if (!scDoc) { el.innerHTML = '<p class="empty">Screen not found</p>'; return; }
      var scHops = hopsForScreen(selectedMap.id, scDoc);
      var htmlS = '<h3>' + esc(selectedMap.id) + '</h3>';
      htmlS += '<p class="meta">Route / flow screen (not a CMS page — see Pages for presentation tree).</p>';
      htmlS += '<div class="meta">components: ' + esc((scDoc.components || []).join(', ') || '—') + '</div>';
      htmlS += '<div class="meta">datasources: ' + esc((scDoc.datasourceIds || []).join(', ') || '—') + '</div>';
      htmlS += '<div class="body-label">Linked hops (' + scHops.length + ')</div>';
      if (!scHops.length) {
        htmlS += '<p class="empty">No hops tagged with this exact screen yet.</p>';
      } else {
        scHops.forEach(function (hop) {
          htmlS += '<div class="map-row' + (selectedId === hop.id ? ' selected' : '') + '" data-select="' + esc(hop.id) + '">';
          htmlS += '<div class="col"><strong>' + esc(hop.method) + '</strong> ' + esc(hop.path || hop.url);
          htmlS += ' <span class="badge">' + esc(KIND_META[hopKind(hop)].label) + '</span></div>';
          htmlS += '<div class="col-side">' + esc(formatWhen(hop.timestamp)) + '</div></div>';
        });
        htmlS += '<p class="meta">Click a hop for request / response bodies.</p>';
      }
      el.innerHTML = htmlS;
      return;
    }
        if (selectedMap && selectedMap.type === 'prefetch') {
      var pref = (doc.prefetches || {})[selectedMap.id];
      if (!pref) { el.innerHTML = '<p class="empty">Prefetch not found</p>'; return; }
      var hop = findHopForPrefetch(pref, selectedMap.id, matchPrefetchesToHops());
      var htmlP = '<h3>' + esc(pref.datasourceId || selectedMap.id) + '</h3>';
      htmlP += '<p class="meta">';
      if (pref.kind) htmlP += 'kind <code>' + esc(pref.kind) + '</code><br/>';
      htmlP += 'phases: ' + esc((pref.phases || []).join(', ') || '—') + '<br/>';
      htmlP += 'ops: ' + esc((pref.operations || []).join(', ') || '—') + '<br/>';
      htmlP += 'lastSeenAt ' + esc(pref.lastSeenAt || '');
      if (pref.lastRequestId) htmlP += '<br/>lastRequestId <code>' + esc(pref.lastRequestId) + '</code>';
      htmlP += '</p>';
      if (hop) {
        htmlP += '<div class="body-label">Matched network hop</div>' + renderHopSummary(hop);
      } else {
        htmlP += '<p class="empty">No hop matched yet. Prefetch capture often uses a synthetic id; matching uses collection path in the request body / operation name when available (Bodies must be on).</p>';
      }
      el.innerHTML = htmlP;
      return;
    }
    var e = selectedId ? findEvent(selectedId) : null;
    if (!e) {
      el.innerHTML = '<h3>Detail</h3><p class="empty">Select a page, prefetch, or hop to inspect.</p>';
      return;
    }
    el.innerHTML = renderHopSummary(e);
  }

  function sortByTs(list) {
    return list.slice().sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  }

  /** Normalize route/CMS labels so "my-profile" matches "My Profile" / "Min Profil". */
  function normLabel(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function softLabelMatch(a, b) {
    var na = normLabel(a);
    var nb = normLabel(b);
    if (!na || !nb) return false;
    return na === nb || na.indexOf(nb) === 0 || nb.indexOf(na) === 0;
  }

  /** Route screen names — prefix match caused "booking" to swallow all booking-* hops. */
  function exactScreenMatch(a, b) {
    var na = normLabel(a);
    var nb = normLabel(b);
    return Boolean(na && nb && na === nb);
  }

  function screenDuplicatesPage(screenName) {
    var pages = doc.pages || {};
    return Object.keys(pages).some(function (pid) {
      var p = pages[pid];
      return exactScreenMatch(screenName, pid) || exactScreenMatch(screenName, p.pageSlug || '');
    });
  }

  function isOdenCollectionScreenArtifact(name, sc) {
    if (!sc) return false;
    // Legacy: screen key was a CMS collection path (listed under Prefetches as oden:{name}).
    if (doc.prefetches && doc.prefetches['oden:' + name]) return true;
    var ds = sc.datasourceIds || [];
    return ds.length === 1 && ds[0] === 'oden:' + name;
  }

  function hopsForScreen(screenName, screenDoc) {
    var dsSet = {};
    (screenDoc && screenDoc.datasourceIds ? screenDoc.datasourceIds : []).forEach(function (d) {
      dsSet[d] = true;
    });
    return events.filter(function (e) {
      return usageList(e.usage).some(function (u) {
        if (u.screen && exactScreenMatch(u.screen, screenName)) return true;
        if (u.datasourceId && dsSet[u.datasourceId]) return true;
        return false;
      });
    }).sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  }

  function labelInSet(label, set) {
    if (!label) return false;
    if (set[label]) return true;
    for (var key in set) {
      if (Object.prototype.hasOwnProperty.call(set, key) && softLabelMatch(label, key)) return true;
    }
    return false;
  }

  function filterEvents() {
    if (DATA.mode === 'crash') {
      return sortByTs(events);
    }
    var screens = Object.keys(doc.screens || {});
    var pages = Object.keys(doc.pages || {});
    Object.keys(doc.pages || {}).forEach(function (id) {
      var p = doc.pages[id];
      if (p.pageSlug) screens.push(p.pageSlug);
    });
    var hasPref = Object.keys(doc.prefetches || {}).length > 0;
    var hasDocStructure = screens.length > 0 || pages.length > 0 || hasPref;
    // Network-only HTML (atlas on, no captures yet): show every embedded hop.
    if (!hasDocStructure) {
      return sortByTs(events);
    }
    var screenSet = {};
    screens.forEach(function (s) { screenSet[s] = true; });
    var pageSet = {};
    pages.forEach(function (p) { pageSet[p] = true; });
    var byReq = {};
    events.forEach(function (e) { if (e.requestId) byReq[e.requestId] = e; });
    var matched = events.filter(function (ev) {
      var us = usageList(ev.usage);
      // Untagged hops: keep root requests when prefetch map exists (bootstrap traffic).
      if (!us.length) return hasPref && !ev.parentRequestId;
      return us.some(function (u) {
        if (u.screen && (labelInSet(u.screen, screenSet) || labelInSet(u.screen, pageSet))) return true;
        var pageId = u.cms && u.cms.pageId;
        return !!(pageId && (labelInSet(pageId, pageSet) || labelInSet(pageId, screenSet)));
      });
    });
    // Screen session ids (route paths) often diverge from CMS pageIds/slugs — never blank Trace.
    if (!matched.length) {
      return sortByTs(events);
    }
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
    return sortByTs(events.filter(function (e) { return include[e.id]; }));
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

  function shortHostLabel(host) {
    var h = String(host || '').toLowerCase();
    if (!h || h === '(unknown)') return '(unknown)';
    var parts = h.split('.');
    if (parts.length >= 2) return parts[parts.length - 2] + '.' + parts[parts.length - 1];
    return h;
  }

  function shortPathLabel(path) {
    var s = String(path || '');
    if (s.length > 52) return s.slice(0, 49) + String.fromCharCode(8230);
    return s;
  }

  function serviceForHop(e) {
    var host = eventHost(e);
    var kind = hopKind(e);
    return {
      id: String(host || '(unknown)').toLowerCase(),
      label: shortHostLabel(host),
      kind: kind,
      kindLabel: KIND_META[kind].label
    };
  }

  function chainRequestKeyMode() {
    return uniqueMode === 'off' ? 'endpoint' : uniqueMode;
  }

  function countDescendants(node) {
    var n = 0;
    function walk(nd) {
      nd.children.forEach(function (c) {
        n += 1;
        walk(c);
      });
    }
    walk(node);
    return n;
  }

  function treeSignature(node) {
    var reqMode = chainRequestKeyMode();
    function sig(n) {
      var k = buildHopDedupKey(n.event, reqMode, 'global', usageList);
      if (!n.children.length) return k;
      return k + '(' + n.children.map(sig).sort().join('|') + ')';
    }
    return sig(node);
  }

  /** Group direct child hops by unique request fingerprint (order-independent fan-out). */
  function groupDownstreamCalls(childNodes) {
    var reqMode = chainRequestKeyMode();
    var groups = {};
    childNodes.forEach(function (childNode) {
      var key = buildHopDedupKey(childNode.event, reqMode, 'global', usageList);
      if (!groups[key]) {
        groups[key] = {
          requestKey: key,
          service: serviceForHop(childNode.event),
          hops: [],
          node: childNode,
          nestedCount: 0
        };
      }
      groups[key].hops.push(childNode.event);
      groups[key].nestedCount += countDescendants(childNode);
    });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) {
        var la = a.service.label;
        var lb = b.service.label;
        if (la !== lb) return la.localeCompare(lb);
        return a.requestKey.localeCompare(b.requestKey);
      });
  }

  function buildChainFromRoot(rootNode) {
    var rootHop = rootNode.event;
    var level1 = groupDownstreamCalls(rootNode.children);
    var totalDownstream = countDescendants(rootNode);
    var uniqueDownstream = 0;
    var hostSet = {};
    function countUnique(groups) {
      groups.forEach(function (g) {
        uniqueDownstream += 1;
        hostSet[g.service.label] = true;
        if (g.node && g.node.children.length) {
          countUnique(groupDownstreamCalls(g.node.children));
        }
      });
    }
    countUnique(level1);
    return {
      root: { hop: rootHop, service: serviceForHop(rootHop), node: rootNode },
      level1: level1,
      totalDownstream: totalDownstream,
      uniqueDownstream: uniqueDownstream,
      hostCount: Object.keys(hostSet).length
    };
  }

  function chainKindSummary(tree) {
    var kinds = {};
    function walkGroups(groups) {
      groups.forEach(function (g) {
        var k = g.service.kindLabel;
        kinds[k] = (kinds[k] || 0) + 1;
        if (g.node && g.node.children.length) {
          walkGroups(groupDownstreamCalls(g.node.children));
        }
      });
    }
    walkGroups(tree.level1 || []);
    return Object.keys(kinds).sort().map(function (k) {
      return kinds[k] + ' ' + k;
    }).join(', ');
  }

  /** Compact host path for header — e.g. nltg.com → azurewebsites.net → acctest.int */
  function chainHostPath(tree) {
    var levels = [];
    levels.push(tree.root.service.label);
    function hostsAt(groups) {
      var seen = {};
      var order = [];
      groups.forEach(function (g) {
        var h = g.service.label;
        if (!seen[h]) { seen[h] = true; order.push(h); }
      });
      return order;
    }
    var cur = tree.level1 || [];
    var depth = 0;
    while (cur.length && depth < 6) {
      var hosts = hostsAt(cur);
      if (hosts.length === 1) levels.push(hosts[0]);
      else if (hosts.length > 1) levels.push(hosts.length + ' hosts');
      var next = [];
      cur.forEach(function (g) {
        if (g.node && g.node.children.length) {
          groupDownstreamCalls(g.node.children).forEach(function (c) { next.push(c); });
        }
      });
      cur = next;
      depth += 1;
    }
    return levels.join(' → ');
  }

  function chainTitleFromTree(tree) {
    var root = tree.root.service;
    var entry = root.kindLabel + ' (' + root.label + ')';
    if (!tree.uniqueDownstream) return entry + ' — standalone';
    return entry + ' · ' + tree.uniqueDownstream + ' unique downstream · ' + tree.hostCount + ' host' + (tree.hostCount === 1 ? '' : 's');
  }

  function chainContextLabel(rootEvent) {
    var screens = {};
    usageList(rootEvent.usage).forEach(function (u) {
      if (u && u.screen) screens[u.screen] = true;
    });
    var keys = Object.keys(screens).sort();
    if (keys.length) return keys.join(', ');
    var us = usageList(rootEvent.usage);
    if (us.length && us[0].label) return us[0].label;
    return shortHostLabel(eventHost(rootEvent));
  }

  function buildUniqueChains(list) {
    var forest = buildForest(list);
    var bySig = {};
    forest.forEach(function (root) {
      var tree = buildChainFromRoot(root);
      var sig = treeSignature(root);
      if (!bySig[sig]) {
        bySig[sig] = {
          signature: sig,
          tree: tree,
          count: 0,
          firstAt: root.event.timestamp,
          context: chainContextLabel(root.event),
          title: chainTitleFromTree(tree)
        };
      }
      bySig[sig].count += 1;
      if (new Date(root.event.timestamp) < new Date(bySig[sig].firstAt)) {
        bySig[sig].firstAt = root.event.timestamp;
      }
    });
    return Object.keys(bySig).map(function (k) { return bySig[k]; })
      .sort(function (a, b) { return new Date(a.firstAt) - new Date(b.firstAt); });
  }

  function renderChainBox(hop, service, opts) {
    opts = opts || {};
    var selected = selectedId === hop.id;
    var err = analyzeHopErrors(hop);
    var slow = isSlowHop(hop, slowThresholdMs);
    var ctx = (errorsOnly || slowOnly) && !err.isError && !slow;
    var cls = 'chain-box kind-' + service.kind + (opts.isRoot ? ' chain-box-root' : '') + (opts.small ? ' chain-box-sm' : '') + (selected ? ' selected' : '') + (err.isError ? ' has-error' : '') + (!err.isError && slow ? ' has-slow' : '') + (ctx ? ' error-context' : '');
    var html = '<button type="button" class="' + cls + '" data-select="' + esc(hop.id) + '">';
    html += '<span class="chain-box-kind">' + esc(service.kindLabel) + '</span>';
    html += '<span class="chain-box-host">' + esc(service.label) + '</span>';
    html += '<span class="chain-box-op">' + esc(hop.method) + ' ' + esc(shortPathLabel(hop.path || hop.url)) + '</span>';
    if (opts.callCount > 1) html += '<span class="chain-box-n">' + opts.callCount + ' identical calls</span>';
    if (opts.childCount > 0) {
      html += '<span class="chain-box-n">' + opts.childCount + ' unique call' + (opts.childCount === 1 ? '' : 's') + ' below</span>';
    }
    if (err.isError) html += '<span class="chain-box-n">' + esc(err.badgeLabel) + '</span>';
    else if (slow) {
      var dShow = hop.durationMs != null ? hop.durationMs : hop._estimatedDurationMs;
      html += '<span class="chain-box-n">' + esc(String(dShow) + 'ms' + (hop.durationMs == null ? '~' : '') + ' slow') + '</span>';
    }
    else if (ctx) html += '<span class="chain-box-n">context</span>';
    else if (hop.responseBodyPreview) html += '<span class="chain-box-n">body captured</span>';
    html += '</button>';
    return html;
  }

  function renderLevelSeparator(label) {
    var html = '<div class="chain-level-sep"><div class="chain-fan-line"></div>';
    html += '<span class="chain-level-label">' + esc(label) + '</span></div>';
    return html;
  }

  /** Recursively render unique groups at this level; nest children under each parent box. */
  function renderChainLevel(groups, depth) {
    if (!groups || !groups.length || depth > 8) return '';
    var html = '<div class="chain-fan-grid">';
    groups.forEach(function (g) {
      var hop = pickRepresentativeHop(g.hops, uniqueKeep) || g.hops[0];
      var childGroups = g.node && g.node.children.length
        ? groupDownstreamCalls(g.node.children)
        : [];
      html += '<div class="chain-fan-item">';
      html += renderChainBox(hop, g.service, {
        callCount: g.hops.length,
        childCount: childGroups.length,
        small: depth > 1
      });
      if (childGroups.length) {
        html += '<div class="chain-nested">';
        html += '<span class="chain-nested-label">called from here (level ' + (depth + 1) + ')</span>';
        html += '<div class="chain-nested-row">';
        childGroups.forEach(function (cg) {
          var chop = pickRepresentativeHop(cg.hops, uniqueKeep) || cg.hops[0];
          var grandGroups = cg.node && cg.node.children.length
            ? groupDownstreamCalls(cg.node.children)
            : [];
          html += '<div class="chain-fan-item">';
          html += renderChainBox(chop, cg.service, {
            callCount: cg.hops.length,
            childCount: grandGroups.length,
            small: true
          });
          if (grandGroups.length) {
            html += '<div class="chain-nested">';
            html += '<span class="chain-nested-label">called from here (level ' + (depth + 2) + ')</span>';
            html += renderChainLevel(grandGroups, depth + 2);
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div></div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderChainTree(tree) {
    var rootHop = pickRepresentativeHop([tree.root.hop], uniqueKeep) || tree.root.hop;
    var html = '<div class="chain-tree">';
    html += '<div class="chain-orchestrator">';
    html += '<span class="chain-orchestrator-label">Entry / orchestrator</span>';
    html += renderChainBox(rootHop, tree.root.service, { isRoot: true });
    html += '</div>';
    var level1 = tree.level1 || [];
    if (!level1.length) {
      html += '<p class="meta" style="text-align:center;margin:0.5rem 0 0">No nested downstream hops linked to this entry.</p>';
    } else {
      var path = chainHostPath(tree);
      html += '<div class="chain-fan-connector"><div class="chain-fan-line"></div>';
      html += '<span class="chain-fan-label">Call path: <strong>' + esc(path) + '</strong>';
      html += ' · <strong>' + tree.uniqueDownstream + '</strong> unique hop';
      html += tree.uniqueDownstream === 1 ? '' : 's';
      if (tree.totalDownstream > tree.uniqueDownstream) {
        html += ' (' + tree.totalDownstream + ' total including repeats)';
      }
      html += '. Same-level boxes are parallel; nested boxes are deeper calls.</span></div>';
      html += renderLevelSeparator('Level 1 — called by entry');
      html += '<div class="chain-level">' + renderChainLevel(level1, 1) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function flatten(forest) {
    var rows = [];
    function walk(nodes, depth) {
      nodes.forEach(function (n) {
        var has = n.children.length > 0;
        rows.push({ event: n.event, depth: depth, hasChildren: has, childCount: n.children.length });
        // Hop trees start collapsed (isCollapsed default true).
        if (has && !isCollapsed(n.event.id)) walk(n.children, depth + 1);
      });
    }
    walk(forest, 0);
    return rows;
  }

  function countForest(nodes) {
    var n = 0;
    nodes.forEach(function (node) {
      n += 1 + countForest(node.children || []);
    });
    return n;
  }

  function renderHopRows(forest, padBase, uniqueMeta) {
    var rows = flatten(forest);
    var html = '';
    rows.forEach(function (r) {
      var e = r.event;
      var pad = (padBase || 8) + r.depth * 14;
      html += '<div class="hop-row' + (selectedId === e.id ? ' selected' : '') + hopRowIssueClass(e) + '" style="padding-left:' + pad + 'px" data-select="' + esc(e.id) + '">';
      if (r.hasChildren) {
        html += '<button type="button" class="chev" data-collapse="' + esc(e.id) + '">' + (isCollapsed(e.id) ? '▶' : '▼') + '</button>';
      } else html += '<span class="chev"></span>';
      html += '<div class="hop-path"><strong>' + esc(e.method) + '</strong> ' + esc(e.path || e.url);
      html += ' <span class="meta">' + esc(formatWhen(e.timestamp)) + '</span>';
      html += hopStatusBadgesHtml(e);
      html += hopDurationBadgeHtml(e, slowThresholdMs);
      html += hopTriggerBadgeHtml(e);
      html += hopContextBadgeHtml(e);
      html += repeatBadgeHtml(uniqueMeta, e);
      if (r.hasChildren) html += ' <span class="badge">' + r.childCount + ' nested</span>';
      if (e.responseBodyPreview) html += ' <span class="badge">body</span>';
      var us = usageList(e.usage);
      if (us.length) html += '<div class="used-by">used by: ' + us.map(formatUsage).map(esc).join(', ') + '</div>';
      html += '</div></div>';
      html += renderDupMemberRows(uniqueMeta, e, padBase, r.depth);
    });
    return html;
  }

  function timing(list) {
    if (!list.length) return { span: 1, bars: [] };
    var t0 = Infinity, t1 = -Infinity;
    list.forEach(function (e) {
      var s = new Date(e.timestamp).getTime();
      var raw = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
      var d = raw > 0 ? raw : 8;
      t0 = Math.min(t0, s);
      t1 = Math.max(t1, s + d);
    });
    if (!(t1 > t0)) t1 = t0 + 1;
    var span = t1 - t0;
    return {
      span: span,
      bars: list.map(function (e) {
        var s = new Date(e.timestamp).getTime() - t0;
        var raw = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
        var d = Math.max(raw > 0 ? raw : 8, 1);
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

  function barClass(e) {
    var src = e && e.source;
    if (analyzeHopErrors(e).isError || src === 'error' || src === 'blocked') return 'bar err';
    if (isSlowHop(e, slowThresholdMs)) return 'bar slow';
    if (src === 'mock-hit') return 'bar mock';
    return 'bar';
  }

  function prefetchPathHint(pref) {
    var id = String(pref.datasourceId || '');
    if (id.indexOf('oden:') !== 0) return null;
    // Avoid regex with "/" — this script is embedded in a TS template literal.
    var p = id.slice(5);
    while (p.charAt(0) === '/') p = p.slice(1);
    return p || null;
  }

  function scorePrefetchHop(pref, e) {
    if (!pref || !e) return 0;
    if (pref.lastRequestId && e.requestId === pref.lastRequestId
        && String(pref.lastRequestId).indexOf('prefetch-') !== 0) {
      return 100000;
    }
    var body = String(e.requestBodyPreview || '') + String.fromCharCode(10) + String(e.responseBodyPreview || '');
    var bodyLower = body.toLowerCase();
    var path = String(e.path || e.url || '').toLowerCase();
    var score = 0;
    var hint = prefetchPathHint(pref);
    if (hint) {
      var needle = hint.toLowerCase();
      if (bodyLower.indexOf('"path":"' + needle + '"') >= 0 || bodyLower.indexOf('"path":"/' + needle + '"') >= 0) {
        score += 5000;
      } else if (bodyLower.indexOf(needle) >= 0 && path.indexOf('deliveryapi/collection') >= 0) {
        score += 800;
      } else {
        return 0;
      }
    }
    var ops = pref.operations || [];
    for (var i = 0; i < ops.length; i++) {
      var op = String(ops[i] || '').toLowerCase();
      if (!op || op.length < 6) continue;
      if (op === 'deliveryapi/collection') {
        if (!hint) score += 5;
        continue;
      }
      if (path.indexOf(op) >= 0) score += 120 + op.length;
      if (bodyLower.indexOf(op) >= 0) score += 80 + op.length;
    }
    if (pref.kind === 'graphql') {
      for (var j = 0; j < ops.length; j++) {
        var gop = String(ops[j] || '');
        if (gop.length > 4 && body.indexOf(gop) >= 0) score += 2000;
      }
    }
    if (pref.lastSeenAt && e.timestamp) {
      var dt = Math.abs(new Date(e.timestamp).getTime() - new Date(pref.lastSeenAt).getTime());
      if (dt < 30000) score += Math.max(0, 150 - Math.floor(dt / 200));
    }
    return score;
  }

  /** 1:1 prefetch→hop map so generic ops do not all bind the same hop. */
  function matchPrefetchesToHops() {
    var prefs = doc.prefetches || {};
    var ids = Object.keys(prefs);
    var pairs = [];
    ids.forEach(function (pid) {
      var pref = prefs[pid];
      events.forEach(function (e) {
        var s = scorePrefetchHop(pref, e);
        if (s > 0) pairs.push({ pid: pid, eid: e.id, s: s, e: e });
      });
    });
    pairs.sort(function (a, b) { return b.s - a.s; });
    var byPref = {};
    var claimed = {};
    pairs.forEach(function (p) {
      if (byPref[p.pid] || claimed[p.eid]) return;
      byPref[p.pid] = p.e;
      claimed[p.eid] = true;
    });
    return byPref;
  }

  function findHopForPrefetch(pref, prefId, hopByPref) {
    if (!pref) return null;
    if (hopByPref && prefId && hopByPref[prefId]) return hopByPref[prefId];
    var byId = pref.lastRequestId && String(pref.lastRequestId).indexOf('prefetch-') !== 0
      ? findByRequestId(pref.lastRequestId)
      : null;
    if (byId) return byId;
    var best = null;
    var bestScore = 0;
    events.forEach(function (e) {
      var s = scorePrefetchHop(pref, e);
      if (s > bestScore) { bestScore = s; best = e; }
    });
    return bestScore > 0 ? best : null;
  }

  function hopsForPage(page) {
    var byId = {};
    Object.keys(page.nodes || {}).forEach(function (nid) {
      var n = page.nodes[nid];
      (n.datasources || []).forEach(function (d) {
        var hop = findByRequestId(d.lastRequestId);
        if (hop) byId[hop.id] = hop;
      });
    });
    var labels = [page.pageId, page.pageSlug].filter(Boolean);
    events.forEach(function (e) {
      usageList(e.usage).forEach(function (u) {
        if (u.screen && labels.some(function (l) { return softLabelMatch(u.screen, l); })) {
          byId[e.id] = e;
        }
        var pageId = u.cms && u.cms.pageId;
        if (pageId && labels.some(function (l) { return softLabelMatch(pageId, l); })) {
          byId[e.id] = e;
        }
      });
    });
    return Object.keys(byId).map(function (id) { return byId[id]; })
      .sort(function (a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
  }

  function renderMap(el) {
    var base = applyKindFilter(filterEvents());
    var uniqueMeta = applyUniqueFilter(base, { mode: uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
    var pages = Object.keys(doc.pages || {}).sort();
    var html = renderUniqueFilters(base, uniqueMeta);
    html += '<p class="meta">scenario <code>' + esc(doc.scenario) + '</code> · updatedAt ' + esc(doc.updatedAt) + '</p>';
    html += '<p class="meta">' + events.length + ' hop(s) · click a row to inspect request / response in the detail pane</p>';
    html += '<h2>Pages</h2>';
    if (!pages.length) html += '<p class="empty">No pages yet</p>';
    pages.forEach(function (pid) {
      var p = doc.pages[pid];
      var open = !isCollapsed('page:' + pid);
      var nodes = Object.keys(p.nodes || {}).map(function (id) { return p.nodes[id]; })
        .sort(function (a, b) { return (a.path || '').localeCompare(b.path || ''); });
      var pageHops = hopsForPage(p);
      html += '<div class="card">';
      var pageSelected = selectedMap && selectedMap.type === 'page' && selectedMap.id === pid;
      html += '<div class="tree-row map-selectable' + (pageSelected ? ' selected' : '') + '" data-select-page="' + esc(pid) + '">';
      html += '<button type="button" class="chev" data-collapse="page:' + esc(pid) + '">' + (open ? '▼' : '▶') + '</button>';
      html += '<div><strong>' + esc(p.pageSlug || p.pageId) + '</strong> <span class="badge">' + nodes.length + ' nodes</span>';
      if (pageHops.length) html += ' <span class="badge">' + esc(hopCountLabel(pageHops)) + '</span>';
      if (p.editUrl) html += ' <a href="' + esc(p.editUrl) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Edit in CMS ↗</a>';
      html += ' <a href="pages/' + esc(pid.replace(/[^a-zA-Z0-9._-]+/g, '_')) + '.html" onclick="event.stopPropagation()">static page →</a></div></div>';
      if (open) {
        if (nodes.length) {
          html += '<div class="meta" style="padding:0.25rem 0.65rem">Nodes</div>';
          nodes.forEach(function (n) {
            var nodeHop = null;
            (n.datasources || []).some(function (d) {
              nodeHop = findByRequestId(d.lastRequestId);
              return !!nodeHop;
            });
            if (!nodeHop && pageHops.length === 1) nodeHop = pageHops[0];
            var nodeSelected = (selectedMap && selectedMap.type === 'node' && selectedMap.pageId === pid && selectedMap.id === n.nodeId)
              || (nodeHop && !selectedMap && selectedId === nodeHop.id);
            html += '<div class="map-row' + (nodeSelected ? ' selected' : '') + '" data-select-node="' + esc(pid) + '" data-node-id="' + esc(n.nodeId) + '"';
            html += '><div class="col">';
            html += '<strong>' + esc(n.label || n.type) + '</strong> <span class="badge">' + esc(n.source) + '</span>';
            if (n.editUrl) html += ' <a href="' + esc(n.editUrl) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">edit ↗</a>';
            html += '<div class="meta">' + esc(n.path) + '</div>';
            if (n.datasources && n.datasources.length) {
              html += '<div class="used-by">' + n.datasources.map(function (d) {
                return esc(d.datasourceId) + (d.dataRoot ? ' · ' + esc(d.dataRoot) : '');
              }).join('; ') + '</div>';
            } else if (!nodeHop) {
              html += '<div class="meta empty">No linked hop yet</div>';
            }
            html += '</div>';
            html += '<div class="col-side">' + (nodeHop ? esc(formatWhen(nodeHop.timestamp)) : '') + (nodeHop && nodeHop.responseBodyPreview ? '<div class="badge">body</div>' : '') + '</div>';
            html += '</div>';
            if ((n.datasources || []).length > 1) {
              html += '<div class="map-sub">';
              n.datasources.forEach(function (d) {
                var hop = findByRequestId(d.lastRequestId);
                html += '<div class="map-row' + (hop && selectedId === hop.id ? ' selected' : '') + '"';
                if (hop) html += ' data-select="' + esc(hop.id) + '"';
                html += '><div class="col"><code>' + esc(d.datasourceId) + '</code>';
                if (d.dataRoot) html += ' <span class="meta">' + esc(d.dataRoot) + '</span>';
                if (!hop) html += '<div class="meta empty">No hop for lastRequestId</div>';
                else html += '<div class="meta">' + esc(hop.method) + ' ' + esc(hop.path || hop.url) + '</div>';
                html += '</div><div class="col-side">' + (hop ? esc(formatWhen(hop.timestamp)) : '') + '</div></div>';
              });
              html += '</div>';
            }
          });
        }
        if (pageHops.length) {
          html += '<div class="meta" style="padding:0.35rem 0.65rem 0.15rem">Linked hops · click for request / response</div>';
          pageHops.forEach(function (hop) {
            html += '<div class="map-row' + (selectedId === hop.id ? ' selected' : '') + '" data-select="' + esc(hop.id) + '">';
            html += '<div class="col"><strong>' + esc(hop.method) + '</strong> ' + esc(hop.path || hop.url);
            html += ' <span class="badge">' + esc(hopKind(hop)) + '</span>';
            html += hopStatusBadgesHtml(hop);
            html += hopDurationBadgeHtml(hop, slowThresholdMs);
            if (hop.responseBodyPreview) html += ' <span class="badge">body</span>';
            var us = usageList(hop.usage);
            if (us.length) html += '<div class="used-by">' + us.map(formatUsage).map(esc).join(', ') + '</div>';
            html += '</div><div class="col-side">' + esc(formatWhen(hop.timestamp));
            html += '</div></div>';
          });
        }
      }
      html += '</div>';
    });

    html += '<h2>Screens</h2>';
    html += '<p class="meta">App routes / flows — hop grouping by where you were in the app. CMS tree is under Pages.</p>';
    var screens = Object.keys(doc.screens || {}).sort().filter(function (s) {
      return !isOdenCollectionScreenArtifact(s, doc.screens[s]);
    });
    if (!screens.length) html += '<p class="empty">No route-only screens yet</p>';
    else {
      screens.forEach(function (s) {
        var sc = doc.screens[s];
        var screenHops = hopsForScreen(s, sc);
        var screenSelected = selectedMap && selectedMap.type === 'screen' && selectedMap.id === s;
        html += '<div class="map-row' + (screenSelected ? ' selected' : '') + '" data-select-screen="' + esc(s) + '">';
        html += '<div class="col"><strong>' + esc(s) + '</strong>';
        html += '<div class="meta">components: ' + esc((sc.components || []).join(', ') || '—') + '</div>';
        html += '<div class="meta">datasources: ' + esc((sc.datasourceIds || []).join(', ') || '—') + '</div>';
        html += '</div><div class="col-side">' + esc(hopCountLabel(screenHops)) + '</div></div>';
      });
    }

    var prefs = Object.keys(doc.prefetches || {}).sort();
    var hopByPref = matchPrefetchesToHops();
    var prefOpen = !isCollapsed('prefetches');
    html += '<div class="card" style="padding:0;overflow:hidden">';
    html += '<div class="tree-row" style="padding:0.65rem 0.75rem"><button type="button" class="chev" data-collapse="prefetches">' + (prefOpen ? '▼' : '▶') + '</button>';
    html += '<div><strong>Prefetches</strong> <span class="badge">' + prefs.length + '</span></div></div>';
    if (prefOpen) {
      if (!prefs.length) html += '<p class="empty" style="padding:0.75rem">No prefetches yet</p>';
      else {
        prefs.forEach(function (id) {
          var pref = doc.prefetches[id];
          var hop = findHopForPrefetch(pref, id, hopByPref);
          var ops = (pref.operations || []).join(', ') || '—';
          var phases = (pref.phases || []).join(', ') || '—';
          var prefSelected = selectedMap && selectedMap.type === 'prefetch' && selectedMap.id === id;
          html += '<div class="map-row' + (prefSelected ? ' selected' : '') + '" data-select-prefetch="' + esc(id) + '">';
          html += '<div class="col">';
          html += '<strong>' + esc(pref.datasourceId || id) + '</strong>';
          if (pref.kind) html += ' <span class="badge">' + esc(pref.kind) + '</span>';
          if (hop && hop.responseBodyPreview) html += ' <span class="badge">body</span>';
          if (hop) {
            html += hopStatusBadgesHtml(hop);
            html += hopDurationBadgeHtml(hop, slowThresholdMs);
          }
          if (!hop) html += ' <span class="badge">no hop</span>';
          html += '<div class="meta">phase: ' + esc(phases) + '</div>';
          html += '<div class="meta">ops: ' + esc(ops) + '</div>';
          if (hop) html += '<div class="meta">' + esc(hop.method) + ' ' + esc(hop.path || hop.url) + '</div>';
          html += '</div>';
          html += '<div class="col-side">' + esc(formatWhen(hop ? hop.timestamp : pref.lastSeenAt));
          html += '</div></div>';
        });
      }
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function renderChains(el, baseList, uniqueMeta) {
    var html = renderListFilters(baseList, uniqueMeta);
    var chains = buildUniqueChains(baseList);
    if (!chains.length) {
      html += '<p class="empty">No call chains yet. Need hops with parentRequestId nesting (enable includeTraceHeader) or standalone roots.</p>';
      el.innerHTML = html;
      return;
    }
    html += '<p class="meta">Orchestrator view — entry on top, then nested levels from parentRequestId (same level = parallel). Click any box for request / response.</p>';
    html += '<p class="meta"><strong>' + chains.length + '</strong> unique orchestration pattern(s) from <strong>' + baseList.length + '</strong> hop(s)';
    var totalRuns = 0;
    chains.forEach(function (c) { totalRuns += c.count; });
    if (totalRuns > chains.length) html += ' · <strong>' + totalRuns + '</strong> total executions';
    html += '</p>';
    chains.forEach(function (ch) {
      html += '<div class="chain-card">';
      html += '<div class="chain-h"><span><strong>' + esc(ch.title) + '</strong></span>';
      var hostPath = chainHostPath(ch.tree);
      if (hostPath && hostPath.indexOf('→') >= 0) {
        html += ' <span class="meta">' + esc(hostPath) + '</span>';
      }
      var kindSummary = chainKindSummary(ch.tree);
      if (kindSummary) html += ' <span class="meta">· ' + esc(kindSummary) + '</span>';
      if (ch.context) html += ' <span class="meta">· ' + esc(ch.context) + '</span>';
      if (ch.count > 1) html += ' <span class="badge repeat" title="Same orchestration ran ' + ch.count + ' times">×' + ch.count + '</span>';
      html += '<span class="spacer meta">' + esc(formatWhen(ch.firstAt)) + '</span></div>';
      html += renderChainTree(ch.tree);
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderTrace(el, list, uniqueMeta) {
    var base = applyKindFilter(filterEvents());
    var html = renderListFilters(base, uniqueMeta);
    var forest = buildForest(list);
    if (!forest.length) {
      html += '<p class="empty">No hops in the selected kinds. Toggle CMS / BFF / Backend / Noise above.</p>';
      el.innerHTML = html;
      return;
    }
    // Primary: traffic kind (CMS vs backend…) · Secondary: domain
    var byKind = {};
    forest.forEach(function (node) {
      var k = hopKind(node.event);
      if (!byKind[k]) byKind[k] = {};
      var h = eventHost(node.event);
      if (!byKind[k][h]) byKind[k][h] = [];
      byKind[k][h].push(node);
    });
    html += '<p class="meta">Grouped by kind → domain · nested trees collapsed by default</p>';
    html += '<div class="toolbar">';
    html += '<button type="button" data-domains="collapse">Collapse domains</button>';
    html += '<button type="button" data-domains="expand">Expand domains</button>';
    html += '<button type="button" data-trees="collapse">Collapse trees</button>';
    html += '<button type="button" data-trees="expand">Expand trees</button>';
    html += '</div>';
    KIND_ORDER.forEach(function (kind) {
      var domainsMap = byKind[kind];
      if (!domainsMap) return;
      var domains = Object.keys(domainsMap).sort();
      var kindTotal = 0;
      domains.forEach(function (d) { kindTotal += countForest(domainsMap[d]); });
      var kindKey = 'kind:' + kind;
      var kindOpen = !isCollapsed(kindKey);
      var meta = KIND_META[kind];
      html += '<h3 class="kind-section"><button type="button" class="chev" data-collapse="' + esc(kindKey) + '">' + (kindOpen ? '▼' : '▶') + '</button> ';
      html += esc(meta.label) + ' <span class="badge">' + kindTotal + '</span> <span class="hint">' + esc(meta.hint) + '</span></h3>';
      if (!kindOpen) return;
      domains.forEach(function (domain) {
        var key = 'domain:' + kind + ':' + domain;
        var open = !isCollapsed(key);
        var roots = domainsMap[domain];
        var total = countForest(roots);
        html += '<div class="group">';
        html += '<div class="group-h"><button type="button" class="chev" data-collapse="' + esc(key) + '">' + (open ? '▼' : '▶') + '</button>';
        html += '<span>' + esc(domain) + '</span>';
        html += '<span class="spacer">' + total + ' hop' + (total === 1 ? '' : 's') + ' · ' + roots.length + ' root' + (roots.length === 1 ? '' : 's') + '</span></div>';
        if (open) html += renderHopRows(roots, 8, uniqueMeta);
        html += '</div>';
      });
    });
    el.innerHTML = html;
  }

  function renderWaterfall(el, list, uniqueMeta) {
    var base = applyKindFilter(filterEvents());
    var html = renderListFilters(base, uniqueMeta);
    if (!list.length) {
      html += '<p class="empty">No timing data for the selected kinds.</p>';
      el.innerHTML = html;
      return;
    }
    html += '<p class="meta">Absolute time bars · kind → domain</p>';
    var byKind = {};
    list.forEach(function (e) {
      var k = hopKind(e);
      if (!byKind[k]) byKind[k] = {};
      var h = eventHost(e);
      if (!byKind[k][h]) byKind[k][h] = [];
      byKind[k][h].push(e);
    });
    KIND_ORDER.forEach(function (kind) {
      var domainsMap = byKind[kind];
      if (!domainsMap) return;
      var meta = KIND_META[kind];
      var kindKey = 'wf-kind:' + kind;
      var kindOpen = !isCollapsed(kindKey);
      var kindCount = 0;
      Object.keys(domainsMap).forEach(function (d) { kindCount += domainsMap[d].length; });
      html += '<h3 class="kind-section"><button type="button" class="chev" data-collapse="' + esc(kindKey) + '">' + (kindOpen ? '▼' : '▶') + '</button> ';
      html += esc(meta.label) + ' <span class="badge">' + kindCount + '</span> <span class="hint">' + esc(meta.hint) + '</span></h3>';
      if (!kindOpen) return;
      Object.keys(domainsMap).sort().forEach(function (domain) {
        var key = 'wf-domain:' + kind + ':' + domain;
        var open = !isCollapsed(key);
        var domainList = domainsMap[domain];
        var tw = timing(domainList);
        html += '<div class="group"><div class="group-h"><button type="button" class="chev" data-collapse="' + esc(key) + '">' + (open ? '▼' : '▶') + '</button>';
        html += '<span>' + esc(domain) + '</span><span class="spacer">' + domainList.length + ' hops</span></div>';
        if (open) {
          tw.bars.forEach(function (b) {
            var left = (b.start / tw.span) * 100;
            var width = Math.max((b.dur / tw.span) * 100, 0.4);
            var e = b.event;
            html += '<div class="timing-row' + (selectedId === e.id ? ' selected' : '') + hopRowIssueClass(e) + '" data-select="' + esc(e.id) + '"><div>' + esc(e.method) + ' ' + esc(e.path || e.url);
            html += repeatBadgeHtml(uniqueMeta, e);
            html += hopStatusBadgesHtml(e);
            html += hopDurationBadgeHtml(e, slowThresholdMs);
            html += hopTriggerBadgeHtml(e);
            html += hopContextBadgeHtml(e);
            html += '<div class="meta">' + esc(formatWhen(e.timestamp)) + '</div>';
            if (e.responseBodyPreview) html += ' <span class="badge">body</span>';
            var us = usageList(e.usage);
            if (us.length) html += '<div class="used-by">' + us.map(formatUsage).map(esc).join(', ') + '</div>';
            html += '</div><div class="track"><div class="' + barClass(e) + '" style="left:' + left + '%;width:' + width + '%"></div></div>';
            var durRight = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
            html += '<div class="meta">' + (durRight != null ? durRight + 'ms' + (e.durationMs == null ? '~' : '') : '—') + '</div></div>';
            html += renderDupMemberRows(uniqueMeta, e, 0, 0);
          });
        }
        html += '</div>';
      });
    });
    el.innerHTML = html;
  }

  function renderGantt(el, uniqueMeta) {
    var base = applyKindFilter(filterEvents());
    var html = renderListFilters(base, uniqueMeta);
    var steps = journey(base);
    if (!steps.length) {
      html += '<p class="empty">No journey groups for the selected kinds.</p>';
      el.innerHTML = html;
      return;
    }
    var all = [];
    var seen = {};
    steps.forEach(function (st) {
      var stepUnique = applyUniqueFilter(st.events, { mode: uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
      var stepList = uniqueMode === 'off' ? st.events : stepUnique.list;
      stepList.forEach(function (e) {
        if (!seen[e.id]) { seen[e.id] = true; all.push(e); }
      });
    });
    var global = timing(all);
    html += '<p class="meta">Same timeline, grouped by screen / prefetch</p>';
    steps.forEach(function (st) {
      var stepUnique = applyUniqueFilter(st.events, { mode: uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
      var stepList = uniqueMode === 'off' ? st.events : stepUnique.list;
      html += '<div class="group"><div class="group-h"><span>' + esc(st.label) + '</span><span class="meta">' + esc(formatHopCountLabel(st.events.length, stepUnique.uniqueCount, uniqueMode)) + '</span></div>';
      var t0 = Infinity;
      all.forEach(function (e) { t0 = Math.min(t0, new Date(e.timestamp).getTime()); });
      stepList.forEach(function (e) {
        var s = new Date(e.timestamp).getTime() - t0;
        var rawD = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
        var d = Math.max(rawD > 0 ? rawD : 8, 1);
        var left = (s / global.span) * 100;
        var width = Math.max((d / global.span) * 100, 0.4);
        html += '<div class="timing-row' + (selectedId === e.id ? ' selected' : '') + hopRowIssueClass(e) + '" style="padding:0.3rem 0.75rem" data-select="' + esc(e.id) + '"><div>' + esc(e.method) + ' ' + esc(e.path || e.url);
        html += repeatBadgeHtml(stepUnique, e);
        html += hopStatusBadgesHtml(e);
        html += hopDurationBadgeHtml(e, slowThresholdMs);
        html += hopTriggerBadgeHtml(e);
        html += hopContextBadgeHtml(e);
        html += '<div class="meta">' + esc(formatWhen(e.timestamp)) + ' · ' + esc(KIND_META[hopKind(e)].label) + '</div>';
        if (e.responseBodyPreview) html += ' <span class="badge">body</span>';
        html += '</div>';
        html += '<div class="track"><div class="' + barClass(e) + '" style="left:' + left + '%;width:' + width + '%"></div></div>';
        var durRight = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
        html += '<div class="meta">' + (durRight != null ? durRight + 'ms' + (e.durationMs == null ? '~' : '') : '—') + '</div></div>';
        html += renderDupMemberRows(stepUnique, e, 0, 0);
      });
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderJourney(el, uniqueMeta) {
    var base = applyKindFilter(filterEvents());
    var html = renderListFilters(base, uniqueMeta);
    var steps = journey(base);
    if (!steps.length) {
      html += '<p class="empty">No journey steps for the selected kinds.</p>';
      el.innerHTML = html;
      return;
    }
    if (!selectedJourneyStep || !steps.some(function (st) { return st.key === selectedJourneyStep; })) {
      selectedJourneyStep = steps[0].key;
    }
    html += '<div class="journey-strip" role="list">';
    steps.forEach(function (st, i) {
      if (i) html += '<span class="journey-arrow" aria-hidden="true">→</span>';
      var stepUnique = applyUniqueFilter(st.events, { mode: uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
      var hopLabel = uniqueMode === 'off'
        ? st.events.length + ' hops'
        : formatHopCountLabel(st.events.length, stepUnique.uniqueCount, uniqueMode);
      var active = selectedJourneyStep === st.key;
      html += '<button type="button" class="journey-step' + (active ? ' active' : '') + '" role="listitem" data-journey-step="' + esc(st.key) + '" title="' + esc(st.label) + '">';
      html += '<strong>' + esc(st.label) + '</strong><div class="meta">' + esc(hopLabel) + '</div></button>';
    });
    html += '</div>';
    steps.forEach(function (st) {
      var stepUnique = applyUniqueFilter(st.events, { mode: uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
      var stepList = uniqueMode === 'off' ? st.events : stepUnique.list;
      var groupActive = selectedJourneyStep === st.key;
      html += '<div class="group journey-group' + (groupActive ? ' journey-group-active' : '') + '" id="journey-step-' + esc(st.key) + '" data-journey-group="' + esc(st.key) + '">';
      html += '<div class="group-h">' + esc(st.label);
      html += '<span class="spacer">' + esc(uniqueMode === 'off'
        ? st.events.length + ' hops'
        : formatHopCountLabel(st.events.length, stepUnique.uniqueCount, uniqueMode)) + '</span></div>';
      stepList.forEach(function (e) {
        var fullPath = e.path || e.url || '';
        var shortPath = shortPathLabel(fullPath);
        html += '<div class="hop-row journey-hop' + (selectedId === e.id ? ' selected' : '') + hopRowIssueClass(e) + '" data-select="' + esc(e.id) + '">';
        html += '<div class="hop-main"><div class="hop-line"><strong>' + esc(e.method) + '</strong>';
        html += '<span class="hop-path-trunc" title="' + esc(fullPath) + '">' + esc(shortPath) + '</span></div>';
        html += '<div class="hop-badges">';
        html += repeatBadgeHtml(stepUnique, e);
        html += hopStatusBadgesHtml(e);
        html += hopDurationBadgeHtml(e, slowThresholdMs);
        html += hopTriggerBadgeHtml(e);
        html += hopContextBadgeHtml(e);
        if (e.responseBodyPreview) html += '<span class="badge">body</span>';
        html += '</div>';
        html += '<span class="meta hop-meta">' + esc(formatWhen(e.timestamp)) + ' · ' + esc(KIND_META[hopKind(e)].label) + '</span>';
        var us = usageList(e.usage);
        if (us.length) html += '<div class="used-by">' + us.map(formatUsage).map(esc).join(', ') + '</div>';
        html += '</div></div>';
        html += renderDupMemberRows(stepUnique, e, 0, 0);
      });
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function render() {
    prefetchByHopId = null;
    var uniqueMeta = buildViewList();
    var list = uniqueMeta.list;
    if (!selectedId && !selectedMap && list.length && view !== 'map') selectedId = list[list.length - 1].id;
    var mapEl = document.getElementById('view-map');
    var traceEl = document.getElementById('view-trace');
    var chainsEl = document.getElementById('view-chains');
    var wfEl = document.getElementById('view-waterfall');
    var ganttEl = document.getElementById('view-gantt');
    var journeyEl = document.getElementById('view-journey');
    var detailEl = document.getElementById('hop-detail');
    var layoutEl = document.querySelector('#atlas-app .layout');
    if (layoutEl) layoutEl.classList.toggle('layout-journey', view === 'journey');
    if (view === 'map') renderMap(mapEl);
    if (view === 'trace') renderTrace(traceEl, list, uniqueMeta);
    if (view === 'chains') renderChains(chainsEl, applyKindFilter(filterEvents()), uniqueMeta);
    if (view === 'waterfall') renderWaterfall(wfEl, list, uniqueMeta);
    if (view === 'gantt') renderGantt(ganttEl, uniqueMeta);
    if (view === 'journey') renderJourney(journeyEl, uniqueMeta);
    renderDetail(detailEl);
    document.querySelectorAll('.tabs button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'view-' + view);
    });
  }

  document.getElementById('atlas-app').addEventListener('click', function (ev) {
    var t = ev.target;
    // Let Edit / static page links navigate; keep in-app data-select anchors.
    var link = t && t.closest && t.closest('a[href]');
    if (link && !link.getAttribute('data-select') && !link.getAttribute('data-select-page')
        && !link.getAttribute('data-select-prefetch') && !link.getAttribute('data-select-node')) {
      return;
    }
    while (t && t !== ev.currentTarget && !(t.getAttribute && (
      t.getAttribute('data-view') ||
      t.getAttribute('data-collapse') ||
      t.getAttribute('data-select') ||
      t.getAttribute('data-select-page') ||
      t.getAttribute('data-select-prefetch') ||
      t.getAttribute('data-select-screen') ||
      t.getAttribute('data-select-node') ||
      t.getAttribute('data-domains') ||
      t.getAttribute('data-trees') ||
      t.getAttribute('data-kind-toggle') ||
      t.getAttribute('data-errors-only') ||
      t.getAttribute('data-slow-only') ||
      t.getAttribute('data-unique-mode') ||
      t.getAttribute('data-unique-scope') ||
      t.getAttribute('data-unique-keep') ||
      t.getAttribute('data-unique-expand') ||
      t.getAttribute('data-journey-step')
    ))) {
      t = t.parentNode;
    }
    if (!t || t === ev.currentTarget) return;
    if (t.getAttribute('data-view')) {
      view = t.getAttribute('data-view');
      render();
      return;
    }
    if (t.getAttribute('data-journey-step')) {
      selectedJourneyStep = t.getAttribute('data-journey-step');
      render();
      var target = document.getElementById('journey-step-' + selectedJourneyStep);
      if (target && target.scrollIntoView) {
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        catch (err) { target.scrollIntoView(true); }
      }
      return;
    }
    if (t.getAttribute('data-kind-toggle')) {
      var kind = t.getAttribute('data-kind-toggle');
      kindEnabled[kind] = !kindEnabled[kind];
      render();
      return;
    }
    if (t.getAttribute('data-errors-only')) {
      errorsOnly = !errorsOnly;
      render();
      return;
    }
    if (t.getAttribute('data-slow-only')) {
      slowOnly = !slowOnly;
      render();
      return;
    }
    if (t.getAttribute('data-unique-mode')) {
      uniqueMode = t.getAttribute('data-unique-mode') || 'off';
      expandedUniqueGroups = {};
      render();
      return;
    }
    if (t.getAttribute('data-unique-scope')) {
      uniqueScope = t.getAttribute('data-unique-scope') || 'global';
      expandedUniqueGroups = {};
      render();
      return;
    }
    if (t.getAttribute('data-unique-keep')) {
      uniqueKeep = t.getAttribute('data-unique-keep') || 'first';
      render();
      return;
    }
    if (t.getAttribute('data-unique-expand')) {
      ev.preventDefault();
      var gkey = decodeURIComponent(t.getAttribute('data-unique-expand') || '');
      if (gkey) expandedUniqueGroups[gkey] = !expandedUniqueGroups[gkey];
      render();
      return;
    }
    if (t.getAttribute('data-domains')) {
      var domainMode = t.getAttribute('data-domains');
      Object.keys(collapsed).forEach(function (k) {
        if (String(k).indexOf('domain:') === 0 || String(k).indexOf('wf-domain:') === 0) delete collapsed[k];
      });
      var list = applyKindFilter(filterEvents());
      var seen = {};
      list.forEach(function (e) {
        var kind = hopKind(e);
        var h = eventHost(e);
        seen['domain:' + kind + ':' + h] = true;
        seen['wf-domain:' + kind + ':' + h] = true;
      });
      Object.keys(seen).forEach(function (k) {
        collapsed[k] = domainMode === 'collapse';
      });
      render();
      return;
    }
    if (t.getAttribute('data-trees')) {
      var treeMode = t.getAttribute('data-trees');
      var list2 = applyKindFilter(filterEvents());
      var forest = buildForest(list2);
      function walkMark(nodes) {
        nodes.forEach(function (n) {
          if (n.children && n.children.length) {
            collapsed[n.event.id] = treeMode === 'collapse';
            walkMark(n.children);
          }
        });
      }
      walkMark(forest);
      render();
      return;
    }
    if (t.getAttribute('data-collapse')) {
      toggleCollapsed(t.getAttribute('data-collapse'));
      render();
      return;
    }
    if (t.getAttribute('data-select-page')) {
      ev.preventDefault();
      selectedMap = { type: 'page', id: t.getAttribute('data-select-page') };
      selectedId = null;
      render();
      return;
    }
    if (t.getAttribute('data-select-screen')) {
      ev.preventDefault();
      selectedMap = { type: 'screen', id: t.getAttribute('data-select-screen') };
      selectedId = null;
      render();
      return;
    }
    if (t.getAttribute('data-select-prefetch')) {
      ev.preventDefault();
      selectedMap = { type: 'prefetch', id: t.getAttribute('data-select-prefetch') };
      selectedId = null;
      render();
      return;
    }
    if (t.getAttribute('data-select-node')) {
      ev.preventDefault();
      selectedMap = {
        type: 'node',
        id: t.getAttribute('data-node-id'),
        pageId: t.getAttribute('data-select-node')
      };
      selectedId = null;
      render();
      return;
    }
    if (t.getAttribute('data-select')) {
      ev.preventDefault();
      selectedId = t.getAttribute('data-select');
      selectedMap = null;
      render();
    }
  });

  render();
})();
`.trim();
}

function buildInteractiveIndex(map: AtlasDocMap, events: NetworkEvent[]): string {
  const body = buildInteractiveAtlasBody(map, events);
  return shell(`Atlas — ${map.scenario}`, body);
}

export interface CrashIncidentHtmlInput {
  incident: NetworkEvent;
  hops: NetworkEvent[];
  suspectSummaries?: string[];
  errorMessage: string;
  incidentId: string;
}

/**
 * Self-contained interactive HTML for one crash incident (Trace / Waterfall / Journey).
 * Intended for local browsing via Metro serve or `file://`.
 */
export function buildCrashIncidentHtml(map: AtlasDocMap, input: CrashIncidentHtmlInput): string {
  const title = `Crash — ${input.incidentId.slice(0, 8)}`;
  const suspectLine =
    input.suspectSummaries && input.suspectSummaries.length > 0
      ? `<p class="meta"><strong>Suspects:</strong> ${escapeHtml(input.suspectSummaries.join(' · '))}</p>`
      : '';
  const banner = `<div class="card">
  <p class="meta"><strong>Error:</strong> ${escapeHtml(input.errorMessage)}</p>
  <p class="meta">Incident ${escapeHtml(input.incidentId)} · ${input.hops.length} hop${input.hops.length === 1 ? '' : 's'} in window</p>
  ${suspectLine}
  <p class="meta">Open Trace / Waterfall / Journey tabs below — click hops for request &amp; response bodies.</p>
</div>`;
  const body = `${banner}\n${buildInteractiveAtlasBody(map, input.hops, {
    mode: 'crash',
    crash: {
      errorMessage: input.errorMessage,
      incidentId: input.incidentId,
      suspectSummaries: input.suspectSummaries,
    },
  })}`;
  return shell(title, body, undefined, '');
}

/**
 * Write one incident HTML file under `{htmlRoot}/incidents/{incidentId}.html`.
 * @returns absolute path when written, otherwise undefined (RN / no fs).
 */
export function writeCrashIncidentHtmlFile(
  htmlRoot: string,
  incidentId: string,
  html: string
): string | undefined {
  if (!fs || !pathMod) return undefined;
  const root = htmlRoot.trim();
  const id = incidentId.trim();
  if (!root || !id) return undefined;
  try {
    const dir = pathMod.join(root, 'incidents');
    fs.mkdirSync(dir, { recursive: true });
    const abs = pathMod.join(dir, `${id}.html`);
    fs.writeFileSync(abs, html, 'utf8');
    return abs;
  } catch {
    return undefined;
  }
}

interface CrashHtmlPayload {
  errorMessage: string;
  incidentId: string;
  suspectSummaries?: string[];
}

interface InteractiveAtlasBodyOptions {
  /** Crash forensics: show every embedded hop (skip CMS doc filtering). */
  mode?: 'crash';
  crash?: CrashHtmlPayload;
}

function buildInteractiveAtlasBody(
  map: AtlasDocMap,
  events: NetworkEvent[],
  options?: InteractiveAtlasBodyOptions
): string {
  const annotations = getAtlasUsageAnnotations();
  const merged = mergeUsageOntoNetworkEvents(events, annotations);
  const payload: {
    doc: AtlasDocMap;
    events: ReturnType<typeof slimNetworkEvent>[];
    mode?: 'crash';
    crash?: CrashHtmlPayload;
  } = {
    doc: map,
    events: merged.map(slimNetworkEvent),
  };
  if (options?.mode === 'crash') {
    payload.mode = 'crash';
  }
  if (options?.crash) {
    payload.crash = options.crash;
  }
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const body = `
<div id="atlas-app">
<p class="meta">Interactive Atlas — Map / Trace / Chains / Waterfall / Gantt / Journey. Click a hop or chain box to inspect request &amp; response bodies (when captureBodies is on).</p>
  <div class="tabs">
    <button type="button" class="active" data-view="map">Map</button>
    <button type="button" data-view="trace">Trace</button>
    <button type="button" data-view="chains">Chains</button>
    <button type="button" data-view="waterfall">Waterfall</button>
    <button type="button" data-view="gantt">Gantt</button>
    <button type="button" data-view="journey">Journey</button>
  </div>
  <div class="layout">
    <div>
      <div id="view-map" class="panel active"></div>
      <div id="view-trace" class="panel"></div>
      <div id="view-chains" class="panel"></div>
      <div id="view-waterfall" class="panel"></div>
      <div id="view-gantt" class="panel"></div>
      <div id="view-journey" class="panel"></div>
    </div>
    <aside id="hop-detail" class="detail"></aside>
  </div>
</div>
<script type="application/json" id="atlas-data">${json}</script>
<script>
${interactiveClientScript()}
</script>`;
  return body;
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
