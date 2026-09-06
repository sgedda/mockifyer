/**
 * Self-contained Atlas auto-doc HTML for local browsing (file:// / VS Code).
 * Written on Node capture upserts when {@link setAtlasDocHtmlOutputPath} is set.
 * Interactive: Architecture (default living doc), Map, Trace, Chains, Waterfall, Gantt, Journey,
 * Scrub, Requests — unique-endpoint focus, connection diagrams, screenshots, kind filters, dedup,
 * search/date filters (exact substring on hop + body text), sortable request table, colored chain boxes,
 * JSON syntax highlighting, hop error/slow panels, Errors/Slow filters, GUI-linked vs screen-only badges.
 * Scrub: drag a playhead or Play/Pause through session time; detail pane follows the active hop.
 * Safe on React Native: `fs`/`path` require is try/caught; writes no-op.
 */

import type { AtlasDocMap, AtlasDocNode, AtlasDocPage } from './atlas-doc';
import { buildAtlasHarJson } from './atlas-har';
import {
  buildGuiLinkedRequestIdSet,
  resolveHopGuiAttribution,
} from './hop-gui-attribution';
import type { NetworkEvent } from './network-event-types';
import { computeUsedResponsePaths } from './response-field-usage';
import { getAtlasUsageAnnotations, mergeUsageOntoNetworkEvents } from './atlas-usage';
import { prettyPrintJsonText } from './json-pretty';

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
/** Cap per-hop text in bodies-search.json (chars). */
export const BODY_SEARCH_MAX_CHARS_PER_HOP = 32_000;
/** Soft cap on total corpus chars so render stays responsive. */
const BODY_SEARCH_MAX_TOTAL_CHARS = 2_000_000;

/**
 * Hop id → searchable body text (previews + spilled full bodies under atlas-html/bodies/).
 * Written as `bodies-search.json` so Requests search can cover full payloads without bloating hop JSON.
 */
export function buildAtlasBodiesSearchCorpus(
  events: readonly NetworkEvent[],
  options?: {
    readSpillText?: (relativePath: string) => string | undefined;
  }
): Record<string, string> {
  const read = options?.readSpillText;
  const corpus: Record<string, string> = {};
  let totalChars = 0;

  for (const ev of events) {
    if (!ev?.id) continue;
    if (totalChars >= BODY_SEARCH_MAX_TOTAL_CHARS) break;
    const parts: string[] = [];

    if (ev.requestBodyRef && read) {
      const spilled = read(ev.requestBodyRef);
      if (spilled) parts.push(spilled);
      else if (ev.requestBodyPreview) parts.push(ev.requestBodyPreview);
    } else if (ev.requestBodyPreview) {
      parts.push(ev.requestBodyPreview);
    }

    if (ev.responseBodyRef && read) {
      const spilled = read(ev.responseBodyRef);
      if (spilled) parts.push(spilled);
      else if (ev.responseBodyPreview) parts.push(ev.responseBodyPreview);
    } else if (ev.responseBodyPreview) {
      parts.push(ev.responseBodyPreview);
    }

    if (!parts.length) continue;
    let text = parts.join('\n');
    if (text.length > BODY_SEARCH_MAX_CHARS_PER_HOP) {
      text = text.slice(0, BODY_SEARCH_MAX_CHARS_PER_HOP);
    }
    const remaining = BODY_SEARCH_MAX_TOTAL_CHARS - totalChars;
    if (text.length > remaining) {
      text = text.slice(0, Math.max(0, remaining));
    }
    if (!text) break;
    corpus[ev.id] = text;
    totalChars += text.length;
  }

  return corpus;
}

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
pre.json { white-space: pre-wrap; word-break: break-word; max-height: 32rem; overflow: auto; }
.json-k { color: #9cdcfe; }
.json-s { color: #ce9178; }
.json-n { color: #b5cea8; }
.json-b { color: #569cd6; }
.json-null { color: #569cd6; }
.json-used-direct { background: rgba(34, 197, 94, 0.22); border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.45); }
.json-used-descendant { background: rgba(34, 197, 94, 0.08); border-radius: 2px; }
.json-unused-dim { opacity: 0.38; }
.field-usage-toolbar { display: flex; flex-wrap: wrap; gap: 0.65rem 1rem; align-items: center; margin: 0.35rem 0 0.5rem; font-size: 0.8rem; }
.field-usage-toolbar label { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; color: var(--muted); }
.field-usage-meta { margin: 0 0 0.5rem; font-size: 0.78rem; color: #166534; }
.field-usage-legend { font-size: 0.75rem; color: var(--muted); margin: 0 0 0.35rem; }
.field-usage-legend .swatch { display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 2px; margin-right: 0.2rem; vertical-align: middle; }
.field-usage-legend .swatch.direct { background: rgba(34, 197, 94, 0.45); }
.field-usage-legend .swatch.desc { background: rgba(34, 197, 94, 0.15); }
.screenshot-panel { margin: 0.65rem 0 0.85rem; }
.screenshot-panel img.screenshot-preview { display: block; max-width: min(280px, 100%); height: auto; border: 1px solid var(--border); border-radius: 6px; background: #fff; }
.screenshot-panel .meta { margin-top: 0.35rem; }
.arch-hero { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.1rem; margin: 0 0 1rem; }
.arch-hero h2 { margin: 0 0 0.4rem; font-size: 1.15rem; }
.arch-hero .arch-intent { margin: 0.35rem 0 0.65rem; font-size: 0.95rem; max-width: 48rem; }
.arch-stats { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0.5rem 0 0; }
.arch-stat { border: 1px solid var(--border); border-radius: 6px; padding: 0.25rem 0.55rem; font-size: 0.78rem; background: #f3f3ef; }
.arch-stat strong { font-weight: 700; }
.arch-shot-strip { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 0.5rem 0 1rem; }
.arch-shot { max-width: 11rem; border: 1px solid transparent; border-radius: 8px; padding: 0.25rem; cursor: pointer; background: transparent; font: inherit; text-align: left; color: inherit; }
.arch-shot:hover { border-color: var(--border); background: #f3f3ef; }
.arch-shot.selected { border-color: var(--accent); background: #e8eefc; box-shadow: 0 0 0 1px var(--accent); }
.arch-shot img { display: block; width: 100%; height: auto; border: 1px solid var(--border); border-radius: 6px; background: #fff; pointer-events: none; }
.arch-shot .meta { font-size: 0.72rem; margin-top: 0.25rem; }
.arch-section { margin: 1.25rem 0 0.75rem; }
.arch-section h2 { font-size: 1.05rem; margin: 0 0 0.45rem; }
.arch-section > .meta { margin: 0 0 0.65rem; }
.arch-mermaid { white-space: pre; overflow: auto; background: #1e1e1e; color: #d4d4d4; border: 1px solid #333; border-radius: 6px; padding: 0.75rem; font-size: 0.75rem; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.4; max-height: 22rem; }
.arch-conn-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.arch-conn-table th { text-align: left; padding: 0.45rem 0.55rem; background: #efefe9; border-bottom: 1px solid var(--border); }
.arch-conn-table td { padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.arch-conn-table tr.arch-conn-row { cursor: pointer; }
.arch-conn-table tr.arch-conn-row:hover { background: #eee; }
.arch-conn-table tr.arch-conn-row.selected { background: #e8eefc; }
.arch-gui-list { margin: 0.35rem 0 0; padding-left: 0; list-style: none; font-size: 0.85rem; }
.arch-gui-list li { margin: 0.3rem 0; }
.arch-gui-item { display: block; width: 100%; text-align: left; border: 1px solid var(--border); border-radius: 6px; padding: 0.45rem 0.55rem; background: var(--card); cursor: pointer; font: inherit; color: inherit; }
.arch-gui-item:hover { border-color: var(--accent); background: #f3f6ff; }
.arch-gui-item.selected { border-color: var(--accent); background: #e8eefc; }
.arch-nav-hint { font-size: 0.8rem; color: var(--muted); margin: 1rem 0 0; }
.arch-drill { margin: 0 0 0.75rem; padding: 0.55rem 0.65rem; background: #f3f3ef; border: 1px solid var(--border); border-radius: 6px; }
.arch-drill-btns { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem; }
.arch-drill-btns button { border: 1px solid var(--border); background: var(--card); border-radius: 6px; padding: 0.25rem 0.55rem; cursor: pointer; font-size: 0.75rem; font-family: inherit; }
.arch-drill-btns button:hover { border-color: var(--accent); color: var(--accent); }
.arch-neighbor { display: flex; gap: 0.35rem; align-items: flex-start; padding: 0.35rem 0.25rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; cursor: pointer; width: 100%; text-align: left; background: transparent; border-left: 0; border-right: 0; border-top: 0; font-family: inherit; color: inherit; }
.arch-neighbor:hover { background: #eee; }
.arch-neighbor .role { flex: 0 0 3.5rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--muted); }
.arch-empty-hint { font-size: 0.85rem; line-height: 1.45; }
.arch-empty-hint li { margin: 0.25rem 0; }
@media (min-width: 900px) {
  .layout.layout-architecture { grid-template-columns: minmax(0, 1.85fr) minmax(15rem, 0.9fr); }
}
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
.page-tree { border: 1px solid var(--border); border-radius: 8px; background: var(--card); margin: 0.5rem 0 1.25rem; padding: 0.25rem 0; overflow: auto; }
.page-tree-item { display: flex; align-items: baseline; gap: 0.45rem; padding: 0.3rem 0.75rem; font-size: 0.85rem; cursor: pointer; border-bottom: 1px solid transparent; }
.page-tree-item:hover { background: #eee; }
.page-tree-item.selected { background: #e8eefc; }
.page-tree-item.stub { opacity: 0.72; }
.page-tree-guide { flex: 0 0 auto; color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.78rem; white-space: pre; user-select: none; }
.page-tree-label { flex: 1 1 auto; min-width: 0; }
.page-tree-label code.path { font-size: 0.72rem; color: var(--muted); }
.badge.dup { color: #9a3412; border-color: #fdba74; background: #fff7ed; }
.badge.level { color: #4338ca; border-color: #c7d2fe; background: #eef2ff; font-variant-numeric: tabular-nums; }
.fields-toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem 0.85rem; align-items: center; margin: 0.5rem 0 0.75rem; }
.fields-toolbar input[type="search"] { min-width: 12rem; flex: 1 1 14rem; padding: 0.3rem 0.55rem; border: 1px solid var(--border); border-radius: 6px; font: inherit; }
.fields-toolbar .seg { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
.fields-toolbar .seg button { border: 1px solid var(--border); background: var(--card); border-radius: 999px; padding: 0.2rem 0.65rem; cursor: pointer; font-size: 0.75rem; }
.fields-toolbar .seg button.on { background: var(--fg); color: var(--card); border-color: var(--fg); }
.fields-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.fields-table th, .fields-table td { text-align: left; vertical-align: top; padding: 0.45rem 0.65rem; border-bottom: 1px solid var(--border); }
.fields-table th { background: #efefe9; font-size: 0.75rem; color: var(--muted); font-weight: 600; }
.fields-table tr.fields-row { cursor: pointer; }
.fields-table tr.fields-row:hover { background: #eee; }
.fields-table tr.fields-row.selected { background: #e8eefc; }
.fields-table code.path { font-size: 0.78rem; word-break: break-all; }
.fields-hop-list, .fields-node-list { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.fields-hop-list button, .fields-node-list button { border: 1px solid var(--border); background: #f7f7f3; border-radius: 4px; padding: 0.15rem 0.4rem; cursor: pointer; font-size: 0.72rem; max-width: 16rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fields-hop-list button:hover, .fields-node-list button:hover { border-color: var(--accent); }
.cms-tree { margin: 0.15rem 0 0.5rem; }
.cms-tree-node { border-left: 1px solid transparent; }
.cms-tree-row { display: flex; align-items: flex-start; gap: 0.35rem; padding: 0.28rem 0.45rem; border-radius: 4px; font-size: 0.82rem; }
.cms-tree-row:hover { background: #eee; }
.cms-tree-row.selected { background: #e8eefc; }
.cms-tree-row.container-node { background: #f4f4ef; }
.cms-tree-children { margin-left: 1.05rem; border-left: 1px dashed var(--border); padding-left: 0.15rem; }
.cms-tree-links { margin: 0.15rem 0 0.35rem 1.6rem; padding: 0.25rem 0.45rem; border-left: 2px solid #c7d2fe; background: #f8f9ff; border-radius: 0 4px 4px 0; font-size: 0.75rem; }
.cms-tree-links .link-row { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; padding: 0.12rem 0; }
.cms-tree-links button.link-page { border: 1px solid #c7d2fe; background: #eef2ff; border-radius: 4px; padding: 0.1rem 0.4rem; cursor: pointer; font-size: 0.72rem; }
.cms-tree-links button.link-page:hover { border-color: #6366f1; }
.badge.link { color: #3730a3; border-color: #c7d2fe; background: #eef2ff; }
.badge.wrap { color: #854d0e; border-color: #fde68a; background: #fffbeb; }
.chev { width: 1.1rem; border: 0; background: transparent; cursor: pointer; font-family: inherit; padding: 0; }
.indent { display: inline-block; }
.timing-row { display: grid; grid-template-columns: minmax(10rem, 14rem) 1fr 3.5rem; gap: 0.5rem; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
.track { position: relative; height: 1.1rem; background: #ebebe6; border-radius: 3px; overflow: hidden; }
.bar { position: absolute; top: 2px; bottom: 2px; border-radius: 2px; background: var(--bar); min-width: 2px; }
.bar.mock { background: var(--bar2); }
.bar.err { background: #dc2626; }
.scrub-toolbar { display: flex; flex-wrap: wrap; gap: 0.65rem 1rem; align-items: center; margin: 0.5rem 0 0.75rem; padding: 0.65rem 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--card); }
.scrub-toolbar .scrub-slider-wrap { flex: 1 1 14rem; min-width: 10rem; display: flex; flex-direction: column; gap: 0.25rem; }
.scrub-toolbar input[type="range"] { width: 100%; accent-color: var(--accent); }
.scrub-toolbar .scrub-time { font-variant-numeric: tabular-nums; font-size: 0.85rem; font-weight: 600; min-width: 7rem; }
.scrub-play-controls { display: flex; gap: 0.35rem; align-items: center; }
.scrub-play-controls button { border: 1px solid var(--border); background: var(--fg); color: var(--card); border-radius: 6px; padding: 0.35rem 0.75rem; cursor: pointer; font-size: 0.8rem; font-weight: 600; }
.scrub-play-controls button[data-scrub-pause] { background: var(--card); color: var(--fg); }
.scrub-play-controls button:hover { opacity: 0.9; }
.scrub-counts { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.scrub-counts .badge.in-flight { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; font-weight: 600; }
.scrub-counts .badge.done { color: #166534; border-color: #86efac; background: #f0fdf4; }
.scrub-counts .badge.future { color: var(--muted); border-style: dashed; }
.scrub-global-track { position: relative; height: 1.35rem; background: #ebebe6; border-radius: 4px; margin: 0 0 0.85rem; overflow: hidden; }
.scrub-global-track .bar { top: 3px; bottom: 3px; opacity: 0.85; }
.scrub-playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: #111; z-index: 2; pointer-events: none; }
.scrub-playhead::after { content: ''; position: absolute; top: -2px; left: -3px; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 5px solid #111; }
.timing-row.scrub-future, .hop-row.scrub-future { opacity: 0.35; }
.timing-row.scrub-inflight, .hop-row.scrub-inflight { background: #eff6ff; }
.badge.scrub-state-future { color: var(--muted); border-style: dashed; }
.badge.scrub-state-inflight { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; font-weight: 600; }
.badge.scrub-state-done { color: #166534; border-color: #86efac; background: #f0fdf4; }
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
.badge.gui-linked { color: #166534; border-color: #86efac; background: #f0fdf4; font-weight: 600; }
.badge.screen-only { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; }
.badge.unattributed { color: var(--muted); border-style: dashed; }
.kind-filters button.gui-filter.on { background: #166534; color: #fff; border-color: #166534; }
.kind-filters button.gui-filter.screen-only.on { background: #1d4ed8; border-color: #1d4ed8; }
.req-filters { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; margin: 0.35rem 0 0.75rem; align-items: center; }
.req-filter-label { font-size: 0.75rem; color: var(--muted); display: flex; align-items: center; gap: 0.35rem; }
.req-filter-label input[type="search"], .req-filter-label input[type="date"] { border: 1px solid var(--border); border-radius: 6px; padding: 0.25rem 0.45rem; font-size: 0.8rem; font-family: inherit; background: var(--card); color: var(--fg); }
.req-filter-label input[type="search"] { min-width: 12rem; }
.req-clear { border: 1px solid var(--border); background: var(--card); border-radius: 6px; padding: 0.2rem 0.55rem; cursor: pointer; font-size: 0.75rem; }
.req-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--card); margin: 0.5rem 0; }
.req-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.req-table th { text-align: left; padding: 0.45rem 0.5rem; background: #efefe9; border-bottom: 1px solid var(--border); white-space: nowrap; }
.req-table td { padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
.req-table tr.req-row { cursor: pointer; }
.req-table tr.req-row:hover { background: #eee; }
.req-table tr.req-row.selected { background: #e8eefc; }
.req-table tr.req-row.has-error { background: #fff1f1; }
.req-table tr.req-row.has-slow { background: #fffbeb; }
.req-sort { border: 0; background: transparent; cursor: pointer; font: inherit; font-weight: 600; padding: 0; color: inherit; }
.req-sort.active { color: var(--accent); }
.req-col-date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.req-col-time { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--muted); font-size: 0.75rem; }
.req-col-path { max-width: 22rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.req-col-num { text-align: right; font-variant-numeric: tabular-nums; }
.req-count { font-size: 0.8rem; color: var(--muted); margin: 0.25rem 0 0.5rem; }
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
.body-block { position: relative; }
.body-block pre.json { padding-top: 1.85rem; }
.body-copy-btn { position: absolute; top: 0.35rem; right: 0.35rem; z-index: 1; font-size: 0.7rem; padding: 0.15rem 0.45rem; border: 1px solid #555; border-radius: 4px; background: #2d2d2d; color: #ddd; cursor: pointer; }
.body-copy-btn:hover { background: #3a3a3a; color: #fff; }
.body-copy-btn.copied { border-color: #86efac; color: #86efac; }
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
  <p>Mockifyer Atlas — living architecture doc (generated on capture)</p>
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
  const parent =
    node.parentId != null && node.parentId !== ''
      ? `<p class="meta">parentId <code>${escapeHtml(node.parentId)}</code> (surrounded by container/section)</p>`
      : '';
  const links =
    node.links && node.links.length
      ? `<h4>Page links</h4><ul>${node.links
          .map(
            (l) =>
              `<li><span class="badge">${escapeHtml(l.type)}</span> <code>${escapeHtml(l.value)}</code></li>`
          )
          .join('')}</ul>`
      : '';

  return `<article class="card">
  <h3>${escapeHtml(node.label || node.type)} <span class="badge">${escapeHtml(node.source)}</span></h3>
  <p class="meta">nodeId <code>${escapeHtml(node.nodeId)}</code> · type <code>${escapeHtml(node.type)}</code> · path <code>${escapeHtml(node.path)}</code></p>
  <p class="meta">lastSeenAt ${escapeHtml(node.lastSeenAt)}</p>
  ${parent}
  ${links}
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
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const childrenOf = new Map<string, AtlasDocNode[]>();
  const roots: AtlasDocNode[] = [];
  for (const n of nodes) {
    const parentId = n.parentId;
    if (parentId && byId.has(parentId) && parentId !== n.nodeId) {
      const list = childrenOf.get(parentId) ?? [];
      list.push(n);
      childrenOf.set(parentId, list);
    } else {
      roots.push(n);
    }
  }
  const renderTree = (n: AtlasDocNode, depth: number): string => {
    const kids = childrenOf.get(n.nodeId) ?? [];
    const indent = depth > 0 ? `<div style="margin-left:${depth * 1.1}rem;border-left:1px dashed #ccc;padding-left:0.5rem">` : '';
    const indentEnd = depth > 0 ? '</div>' : '';
    return `${indent}${renderNode(n)}${kids.map((c) => renderTree(c, depth + 1)).join('')}${indentEnd}`;
  };
  const slug = page.pageSlug ? ` · slug <code>${escapeHtml(page.pageSlug)}</code>` : '';
  const placements = page.placements ?? [];
  const treeHtml =
    placements.length === 0
      ? ''
      : `<h3>Site tree placements</h3><ul>${placements
          .map((p) => {
            const crumb = escapeHtml(p.treePath);
            const under =
              p.parentTreePath != null
                ? ` · under <code>${escapeHtml(p.parentTreePath)}</code>`
                : ' · root';
            return `<li><span class="badge level">L${p.depth}</span> <code>${crumb}</code>${under}${
              placements.length > 1 ? ' <span class="badge dup">duplicate path</span>' : ''
            }</li>`;
          })
          .join('')}</ul>`;
  const nodesHtml =
    nodes.length === 0
      ? `<p class="empty">No nodes yet</p>`
      : `<h3>Component tree</h3>${(roots.length ? roots : nodes).map((n) => renderTree(n, 0)).join('\n')}`;
  return `<p class="meta">pageId <code>${escapeHtml(page.pageId)}</code>${slug} · lastSeenAt ${escapeHtml(page.lastSeenAt)}</p>
${treeHtml}
${nodesHtml}`;
}

/**
 * Pretty-print JSON for Atlas HTML previews, then cap length.
 * Pretty-first so truncated bodies still show indented structure (not one giant line).
 */
function truncateBodyPreview(text: string | undefined): string | undefined {
  if (text == null || text === '') return undefined;
  const formatted = prettyPrintJsonText(text);
  if (formatted.length <= MAX_BODY_CHARS_IN_HTML) return formatted;
  return `${formatted.slice(0, MAX_BODY_CHARS_IN_HTML)}\n… [truncated ${formatted.length - MAX_BODY_CHARS_IN_HTML} chars]`;
}

function slimNetworkEvent(
  ev: NetworkEvent,
  guiLinkedRequestIds: ReadonlySet<string>,
  doc: AtlasDocMap
): Record<string, unknown> {
  const fieldUsage = computeUsedResponsePaths(doc, ev);
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
    sessionId: ev.sessionId,
    usage: ev.usage,
    guiAttribution: resolveHopGuiAttribution(ev, guiLinkedRequestIds),
    usedResponsePaths: fieldUsage.paths,
    linkedGuiNodes: fieldUsage.nodes.map((n) => ({
      pageId: n.pageId,
      nodeId: n.nodeId,
      type: n.type,
      label: n.label,
    })),
    requestBodyPreview: truncateBodyPreview(ev.requestBodyPreview),
    responseBodyPreview: truncateBodyPreview(ev.responseBodyPreview),
    requestBodyRef: ev.requestBodyRef,
    responseBodyRef: ev.responseBodyRef,
    requestBodyTruncated: ev.requestBodyTruncated === true,
    responseBodyTruncated: ev.responseBodyTruncated === true,
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
    var errPathLabel = '';
    if (Array.isArray(node.path)) errPathLabel = node.path.join('.');
    else if (node.path != null) errPathLabel = String(node.path);
    var code = null;
    if (node.extensions && typeof node.extensions === 'object' && node.extensions.code != null) code = node.extensions.code;
    else if (node.code != null) code = node.code;
    else if (node.StatusCode != null) code = node.StatusCode;
    pushErrorItem(out, {
      message: messageFromErrorish(node),
      code: code != null ? String(code) : null,
      path: errPathLabel || null,
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
  var raw = String(text);
  var trimmed = raw.replace(/^\\s+|\\s+$/g, '');
  if (/^(#\\s*operationName:|(query|mutation|subscription)\\b)/.test(trimmed)) return raw;
  var parsed = parseBodyJson(raw);
  if (parsed.ok) {
    try { return JSON.stringify(parsed.value, null, 2); } catch (err) { return parsed.raw; }
  }
  // Truncated body footer — format the head when it is still valid JSON
  var footer = String.fromCharCode(10) + String.fromCharCode(8230) + ' [truncated';
  var cut = raw.indexOf(footer);
  var head = cut > 0 ? raw.slice(0, cut) : raw;
  var headParsed = parseBodyJson(head);
  if (headParsed.ok) {
    try {
      var prettyHead = JSON.stringify(headParsed.value, null, 2);
      return cut > 0 ? prettyHead + raw.slice(cut) : prettyHead;
    } catch (err2) { /* fall through */ }
  }
  // Incomplete compact JSON — soft-pretty for readable Atlas previews
  var soft = softPrettyJsonClient(head);
  return cut > 0 ? soft + raw.slice(cut) : soft;
}
function softPrettyJsonClient(text) {
  var out = '';
  var depth = 0;
  var inStr = false;
  var esc = false;
  function indent() {
    var pad = '';
    for (var i = 0; i < depth; i++) pad += '  ';
    return pad;
  }
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === String.fromCharCode(92)) esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    if (ch === '{' || ch === '[') {
      depth += 1;
      out += ch + String.fromCharCode(10) + indent();
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      out += String.fromCharCode(10) + indent() + ch;
      continue;
    }
    if (ch === ',') {
      out += ch + String.fromCharCode(10) + indent();
      continue;
    }
    if (ch === ':') { out += ': '; continue; }
    var code = ch.charCodeAt(0);
    if (code === 32 || code === 9 || code === 10 || code === 13) continue;
    out += ch;
  }
  return out;
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
function renderJsonPre(text, usedPathMap, dimUnused) {
  var parsed = parseBodyJson(text);
  if (parsed.ok && usedPathMap && Object.keys(usedPathMap).length) {
    return wrapCopyableBodyPre(renderJsonValueHtml(parsed.value, '', usedPathMap, 0, !!dimUnused));
  }
  var pretty = prettyJsonText(text);
  if (pretty == null) return '<p class="empty">No body captured.</p>';
  var trimmed = String(pretty).replace(/^\\s+|\\s+$/g, '');
  if (/^(#\\s*operationName:|(query|mutation|subscription)\\b)/.test(trimmed)) {
    return wrapCopyableBodyPre(escJsonStr(pretty));
  }
  return wrapCopyableBodyPre(highlightJsonHtml(pretty));
}
function wrapCopyableBodyPre(innerHtml) {
  return '<div class="body-block">'
    + '<button type="button" class="body-copy-btn" data-copy-body>Copy</button>'
    + '<pre class="json">' + innerHtml + '</pre></div>';
}
function buildUsedPathMap(paths) {
  var m = {};
  (paths || []).forEach(function (p) { if (p) m[p] = true; });
  return m;
}
function pathUsageKind(path, map) {
  if (!map || !Object.keys(map).length) return 'none';
  if (map[path]) return 'direct';
  var prefix = path ? path + '.' : '';
  for (var k in map) {
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    if (path === '' || k.indexOf(prefix) === 0) return 'descendant';
  }
  return 'unused';
}
function usageClassForKind(kind, role, dimUnused) {
  if (kind === 'direct') return role + ' json-used-direct';
  if (kind === 'descendant') return role + ' json-used-descendant';
  if (kind === 'unused' && dimUnused) return role + ' json-unused-dim';
  return role;
}
function escJsonStr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function renderJsonValueHtml(value, path, map, indent, dimUnused) {
  var kind = pathUsageKind(path, map);
  if (dimUnused && kind === 'unused' && path !== '') return '';
  var pad = '';
  for (var i = 0; i < indent; i++) pad += '  ';
  var childPad = pad + '  ';
  if (value === null) {
    return pad + '<span class="' + usageClassForKind(kind, 'json-null', dimUnused) + '">null</span>';
  }
  if (typeof value === 'boolean') {
    return pad + '<span class="' + usageClassForKind(kind, 'json-b', dimUnused) + '">' + (value ? 'true' : 'false') + '</span>';
  }
  if (typeof value === 'number') {
    return pad + '<span class="' + usageClassForKind(kind, 'json-n', dimUnused) + '">' + String(value) + '</span>';
  }
  if (typeof value === 'string') {
    return pad + '<span class="' + usageClassForKind(kind, 'json-s', dimUnused) + '">"' + escJsonStr(value) + '"</span>';
  }
  if (Array.isArray(value)) {
    if (dimUnused && kind === 'unused') return '';
    var itemLines = [];
    value.forEach(function (item, idx) {
      var childPath = path ? path + '.' + idx : String(idx);
      var line = renderJsonValueHtml(item, childPath, map, indent + 1, dimUnused);
      if (line !== '') itemLines.push(line);
    });
    if (dimUnused && !itemLines.length) return '';
    var nl = String.fromCharCode(10);
    return pad + '[' + nl + itemLines.join(',' + nl) + (itemLines.length ? nl : '') + pad + ']';
  }
  if (typeof value === 'object') {
    if (dimUnused && kind === 'unused' && path !== '') return '';
    var entries = [];
    Object.keys(value).forEach(function (k) {
      var childPath = path ? path + '.' + k : k;
      var childKind = pathUsageKind(childPath, map);
      if (dimUnused && childKind === 'unused') return;
      var childVal = renderJsonValueHtml(value[k], childPath, map, indent + 1, dimUnused);
      if (childVal === '') return;
      var keyCls = usageClassForKind(childKind, 'json-k', dimUnused);
      var valPart = childVal;
      if (childVal.indexOf(childPad) === 0) valPart = childVal.slice(childPad.length);
      else if (childVal.indexOf(pad) === 0) valPart = childVal.slice(pad.length);
      entries.push(childPad + '<span class="' + keyCls + '">"' + escJsonStr(k) + '"</span>: ' + valPart);
    });
    if (dimUnused && !entries.length && path !== '') return '';
    var nl2 = String.fromCharCode(10);
    return pad + '{' + nl2 + entries.join(',' + nl2) + (entries.length ? nl2 : '') + pad + '}';
  }
  return pad + escJsonStr(String(value));
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
  var view = 'architecture';
  var selectedId = null;
  /** Map selection: { type: 'page'|'prefetch'|'node', id, pageId? } */
  var selectedMap = null;
  /** Traffic lanes — Noise off by default to cut probe/analytics clutter. */
  var kindEnabled = { cms: true, bff: true, backend: true, other: true, noise: false };
  var errorsOnly = false;
  var slowOnly = false;
  /** null = all; otherwise filter to one GUI attribution bucket. */
  var guiAttributionFilter = null;
  var requestSearch = '';
  var requestDateFrom = '';
  var requestDateTo = '';
  var requestSortKey = 'timestamp';
  var requestSortDir = 'desc';
  var reqSearchFocus = false;
  var highlightUsedFields = true;
  var dimUnusedFields = false;
  var fieldsSearch = '';
  var fieldsGroupBy = 'path';
  var fieldsFocus = false;
  var fieldsCmsOnly = false;
  var slowThresholdMs = (DATA.slowThresholdMs > 0) ? DATA.slowThresholdMs : ATLAS_DEFAULT_SLOW_MS;
  var uniqueMode = 'endpoint';
  var uniqueScope = 'global';
  var uniqueKeep = 'first';
  var expandedUniqueGroups = {};
  /** Selected journey strip step key (scrolls / highlights matching group). */
  var selectedJourneyStep = null;
  /** Scrub playhead offset from session t0 (ms). null = use end of span on first render. */
  var scrubPlayheadMs = null;
  /** When true, Scrub list hides hops that have not started yet. */
  var scrubHideFuture = true;
  var scrubFocus = false;
  var scrubPlaying = false;
  var scrubTimerId = null;
  var scrubSpanMs = 1;
  var SCRUB_TICK_MS = 80;
  var KIND_ORDER = ['cms', 'bff', 'backend', 'other', 'noise'];
  var KIND_META = {
    cms: { label: 'CMS', hint: 'deliveryapi / Umbraco content' },
    bff: { label: 'BFF', hint: 'capp GraphQL gateway' },
    backend: { label: 'Backend', hint: 'booking / CRM / tokens / hotspot' },
    other: { label: 'Other', hint: 'uncategorized' },
    noise: { label: 'Noise', hint: 'probes / diagnostics' }
  };
  var GUI_ATTRIBUTION_META = {
    'gui-linked': {
      label: 'GUI-linked',
      detail: 'Hop read by a CMS node / presentation (datasource or CMS usage)',
      badgeClass: 'gui-linked'
    },
    'screen-only': {
      label: 'Screen-only',
      detail: 'Tagged while a screen was active — received on screen, not tied to a CMS node',
      badgeClass: 'screen-only'
    },
    unattributed: {
      label: 'Unattributed',
      detail: 'No screen or CMS node usage annotation',
      badgeClass: 'unattributed'
    }
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
  function resolveScreenshotForHop(e) {
    var sessionId = e.sessionId || '';
    var usages = usageList(e.usage);
    var fallback = null;
    for (var ui = 0; ui < usages.length; ui++) {
      var u = usages[ui];
      if (!u || !u.screen) continue;
      var sc = (doc.screens || {})[u.screen];
      if (sc && sc.screenshotPath) {
        var shot = { path: sc.screenshotPath, capturedAt: sc.screenshotCapturedAt };
        if (!sc.screenshotSessionId || !sessionId || sc.screenshotSessionId === sessionId) {
          return shot;
        }
        if (!fallback) fallback = shot;
      }
      var pages = doc.pages || {};
      for (var pid in pages) {
        if (!Object.prototype.hasOwnProperty.call(pages, pid)) continue;
        var pg = pages[pid];
        if (pid === u.screen || pg.pageSlug === u.screen) {
          if (pg.screenshotPath) {
            var pageShot = { path: pg.screenshotPath, capturedAt: pg.screenshotCapturedAt };
            if (!pg.screenshotSessionId || !sessionId || pg.screenshotSessionId === sessionId) {
              return pageShot;
            }
            if (!fallback) fallback = pageShot;
          }
        }
      }
    }
    return fallback;
  }
  function atlasAssetUrl(rel) {
    if (!rel) return '';
    var s = String(rel).replace(/^\\.\\//, '');
    if (/^(https?:|data:|file:|\\/)/i.test(s)) return s;
    try {
      var pathName = (typeof location !== 'undefined' && location.pathname) ? String(location.pathname) : '';
      // Metro serves under /mockifyer-atlas-html/… — keep assets under that prefix
      var metroMarker = '/mockifyer-atlas-html/';
      var metroIdx = pathName.indexOf(metroMarker);
      if (metroIdx >= 0) {
        return pathName.slice(0, metroIdx + metroMarker.length) + s.replace(/^\\.\\.\\//, '');
      }
      // Also match /mockifyer-atlas-html without trailing slash (index served at exact path)
      if (pathName.endsWith('/mockifyer-atlas-html')) {
        return pathName + '/' + s.replace(/^\\.\\.\\//, '');
      }
      // Static / Live Preview under …/mock-data/atlas-html/index.html
      var atlasHtmlMarker = '/atlas-html/';
      var atlasIdx = pathName.indexOf(atlasHtmlMarker);
      if (atlasIdx >= 0) {
        return pathName.slice(0, atlasIdx + atlasHtmlMarker.length) + s.replace(/^\\.\\.\\//, '');
      }
      // file:// …/atlas-html/incidents|pages/*.html → sibling screenshots/
      if (/\\/(incidents|pages)\\/[^/]+\\.html$/i.test(pathName)) {
        return '../' + s;
      }
    } catch (err) {}
    return s;
  }
  function renderScreenshotPanelHtml(shot) {
    if (!shot || !shot.path) return '';
    var src = atlasAssetUrl(shot.path);
    var html = '<div class="screenshot-panel"><div class="body-label">Screen capture</div>';
    html += '<img class="screenshot-preview" src="' + esc(src) + '" alt="Screen at capture" loading="lazy" data-atlas-img />';
    html += '<p class="meta atlas-img-missing" hidden style="color:var(--err)">Missing image <code>' + esc(src) + '</code></p>';
    if (shot.capturedAt) html += '<p class="meta">captured ' + esc(shot.capturedAt) + '</p>';
    html += '<p class="meta">file <code>' + esc(shot.path) + '</code></p>';
    html += '</div>';
    return html;
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
  /** Date-only field (YYYY-MM-DD) for filters and table column. */
  function formatDateOnly(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      function pad(n) { return n < 10 ? '0' + n : String(n); }
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    } catch (err) {
      return '';
    }
  }
  function formatTimeOnly(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      function pad(n) { return n < 10 ? '0' + n : String(n); }
      return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    } catch (err) {
      return '';
    }
  }
  function hopSearchHaystack(e) {
    var parts = [
      e.method, e.path, e.url, e.requestId, e.parentRequestId, e.host,
      eventHost(e), hopKind(e), e.guiAttribution, e.source, formatWhen(e.timestamp),
      e.requestBodyPreview, e.responseBodyPreview, e.errorMessage
    ];
    usageList(e.usage).forEach(function (u) {
      parts.push(u.screen, u.component, u.label, u.datasourceId);
      if (u.cms) parts.push(u.cms.pageId, u.cms.nodeId, u.cms.type, u.cms.path);
    });
    var blob = bodySearchById[e.id];
    if (blob) parts.push(blob);
    return parts.filter(Boolean).join(' ').toLowerCase();
  }
  /** Full body text by hop id (from bodies-search.json). */
  var bodySearchById = {};
  /**
   * Exact contiguous match: the full query (lowercased, trimmed) must appear as-is
   * in the hop haystack. No fuzzy / prefix-suggest — adding characters only narrows.
   */
  function hopMatchesSearchQuery(e, q) {
    var needle = String(q || '').trim().toLowerCase();
    if (!needle) return true;
    return hopSearchHaystack(e).indexOf(needle) >= 0;
  }
  function loadBodySearchCorpus() {
    if (typeof fetch !== 'function') return;
    fetch('bodies-search.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || typeof data !== 'object') return;
        bodySearchById = data;
        if (requestSearch && String(requestSearch).trim()) render();
      })
      .catch(function () { /* optional sidecar */ });
  }
  loadBodySearchCorpus();
  function applyRequestQueryFilters(list) {
    var filtered = list;
    if (requestDateFrom || requestDateTo) {
      filtered = filtered.filter(function (e) {
        var dk = formatDateOnly(e.timestamp);
        if (!dk) return false;
        if (requestDateFrom && dk < requestDateFrom) return false;
        if (requestDateTo && dk > requestDateTo) return false;
        return true;
      });
    }
    var q = requestSearch.trim();
    if (!q) return filtered;
    return filtered.filter(function (e) { return hopMatchesSearchQuery(e, q); });
  }
  function sortRequests(list, key, dir) {
    var mul = dir === 'desc' ? -1 : 1;
    return list.slice().sort(function (a, b) {
      var av;
      var bv;
      switch (key) {
        case 'method':
          av = String(a.method || '').toUpperCase();
          bv = String(b.method || '').toUpperCase();
          break;
        case 'path':
          av = String(a.path || a.url || '').toLowerCase();
          bv = String(b.path || b.url || '').toLowerCase();
          break;
        case 'status':
          av = typeof a.status === 'number' ? a.status : -1;
          bv = typeof b.status === 'number' ? b.status : -1;
          break;
        case 'duration':
          av = typeof a.durationMs === 'number' ? a.durationMs : (a._estimatedDurationMs != null ? a._estimatedDurationMs : -1);
          bv = typeof b.durationMs === 'number' ? b.durationMs : (b._estimatedDurationMs != null ? b._estimatedDurationMs : -1);
          break;
        case 'kind':
          av = hopKind(a);
          bv = hopKind(b);
          break;
        case 'gui':
          av = a.guiAttribution || 'unattributed';
          bv = b.guiAttribution || 'unattributed';
          break;
        default:
          av = new Date(a.timestamp).getTime();
          bv = new Date(b.timestamp).getTime();
          if (!isFinite(av)) av = 0;
          if (!isFinite(bv)) bv = 0;
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return String(a.id).localeCompare(String(b.id));
    });
  }
  function sortHeaderHtml(key, label) {
    var active = requestSortKey === key;
    var arrow = active ? (requestSortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return '<button type="button" class="req-sort' + (active ? ' active' : '') + '" data-req-sort="' + key + '">' + esc(label) + arrow + '</button>';
  }
  function renderRequestQueryFilters() {
    var html = '<div class="req-filters">';
    html += '<label class="req-filter-label">Search<input type="search" data-req-search placeholder="exact text in path, body, requestId…" value="' + esc(requestSearch) + '" title="Exact contiguous match (case-insensitive). Longer query = fewer hits."></label>';
    html += '<label class="req-filter-label">From<input type="date" data-req-date-from value="' + esc(requestDateFrom) + '"></label>';
    html += '<label class="req-filter-label">To<input type="date" data-req-date-to value="' + esc(requestDateTo) + '"></label>';
    if (requestSearch || requestDateFrom || requestDateTo) {
      html += '<button type="button" class="req-clear" data-req-clear>Clear filters</button>';
    }
    html += '</div>';
    return html;
  }
  function renderRequestTable(list) {
    if (!list.length) {
      return '<p class="empty">No requests match the current filters.</p>';
    }
    var html = '<p class="req-count">' + list.length + ' request' + (list.length === 1 ? '' : 's') + '</p>';
    html += '<div class="req-table-wrap"><table class="req-table"><thead><tr>';
    html += '<th>' + sortHeaderHtml('timestamp', 'Date') + '</th>';
    html += '<th>Time</th>';
    html += '<th>' + sortHeaderHtml('method', 'Method') + '</th>';
    html += '<th>' + sortHeaderHtml('path', 'Path') + '</th>';
    html += '<th class="req-col-num">' + sortHeaderHtml('status', 'Status') + '</th>';
    html += '<th class="req-col-num">' + sortHeaderHtml('duration', 'Duration') + '</th>';
    html += '<th>' + sortHeaderHtml('kind', 'Kind') + '</th>';
    html += '<th>' + sortHeaderHtml('gui', 'GUI') + '</th>';
    html += '</tr></thead><tbody>';
    list.forEach(function (e) {
      var path = e.path || e.url || '';
      var dur = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
      var guiMeta = GUI_ATTRIBUTION_META[e.guiAttribution || 'unattributed'] || GUI_ATTRIBUTION_META.unattributed;
      html += '<tr class="req-row' + (selectedId === e.id ? ' selected' : '') + hopRowIssueClass(e) + '" data-select="' + esc(e.id) + '">';
      html += '<td class="req-col-date">' + esc(formatDateOnly(e.timestamp) || '—') + '</td>';
      html += '<td class="req-col-time">' + esc(formatTimeOnly(e.timestamp) || '—') + '</td>';
      html += '<td><strong>' + esc(e.method || '') + '</strong></td>';
      html += '<td class="req-col-path" title="' + esc(path) + '">' + esc(path) + '</td>';
      html += '<td class="req-col-num">' + (e.status != null ? esc(String(e.status)) : '—') + '</td>';
      html += '<td class="req-col-num">' + (dur != null ? esc(String(dur) + 'ms' + (e.durationMs == null ? '~' : '')) : '—') + '</td>';
      html += '<td>' + esc(KIND_META[hopKind(e)].label) + '</td>';
      html += '<td><span class="badge ' + guiMeta.badgeClass + '">' + esc(guiMeta.label) + '</span></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
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
  function hopGuiAttributionBadgeHtml(e) {
    var kind = e.guiAttribution || 'unattributed';
    var meta = GUI_ATTRIBUTION_META[kind] || GUI_ATTRIBUTION_META.unattributed;
    return ' <span class="badge ' + meta.badgeClass + '" title="' + esc(meta.detail) + '">' + esc(meta.label) + '</span>';
  }
  function applyGuiAttributionFilter(list) {
    if (!guiAttributionFilter) return list;
    return list.filter(function (e) { return (e.guiAttribution || 'unattributed') === guiAttributionFilter; });
  }
  function countByGuiAttribution(list) {
    var counts = { 'gui-linked': 0, 'screen-only': 0, unattributed: 0 };
    list.forEach(function (e) {
      var k = e.guiAttribution || 'unattributed';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }
  function applyKindFilter(list) {
    return applyRequestQueryFilters(applyGuiAttributionFilter(applyIssueFilters(list.filter(function (e) { return kindEnabled[hopKind(e)] !== false; }))));
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
    var guiCounts = countByGuiAttribution(kindBase);
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
    html += '<div class="kind-filters"><span class="label">GUI:</span>';
    html += '<button type="button" class="gui-filter' + (!guiAttributionFilter ? ' on' : '') + '" data-gui-filter="" title="Show all hops regardless of GUI linkage">All<span class="n">' + kindBase.length + '</span></button>';
    ['gui-linked', 'screen-only', 'unattributed'].forEach(function (gk) {
      var gmeta = GUI_ATTRIBUTION_META[gk];
      var on = guiAttributionFilter === gk;
      html += '<button type="button" class="gui-filter ' + gmeta.badgeClass + (on ? ' on' : '') + '" data-gui-filter="' + gk + '" title="' + esc(gmeta.detail) + '">';
      html += esc(gmeta.label) + '<span class="n">' + (guiCounts[gk] || 0) + '</span></button>';
    });
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
    return renderKindFilters(baseList) + renderRequestQueryFilters() + renderUniqueFilters(baseList, uniqueMeta);
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
      html += hopGuiAttributionBadgeHtml(m);
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

  function renderBodyFullLink(ref, label) {
    if (!ref) return '';
    var href = String(ref);
    // Avoid regex with "/" — this script is embedded in a TS template literal.
    while (href.charAt(0) === '/') href = href.slice(1);
    return '<p class="meta"><a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a></p>';
  }

  function renderHopBodies(e) {
    var html = '';
    html += '<div class="body-label">Request body</div>';
    if (e.requestBodyPreview) {
      html += renderJsonPre(e.requestBodyPreview);
      if (e.requestBodyTruncated || e.requestBodyRef) {
        html += '<p class="meta">Preview truncated' + (e.requestBodyRef ? '' : '') + '.</p>';
        html += renderBodyFullLink(e.requestBodyRef, 'Open full request body');
      }
    } else if (e.requestBodyRef) {
      html += '<p class="empty">Request body omitted from hop preview (too large).</p>';
      html += renderBodyFullLink(e.requestBodyRef, 'Open full request body');
    } else {
      html += '<p class="empty">No request body captured.</p>';
    }
    html += '<div class="body-label">Response body</div>';
    var hasFieldUsage = e.usedResponsePaths && e.usedResponsePaths.length;
    if (hasFieldUsage) {
      html += '<div class="field-usage-toolbar">';
      html += '<label><input type="checkbox" data-toggle-used-fields' + (highlightUsedFields ? ' checked' : '') + '> Highlight GUI-used fields</label>';
      if (highlightUsedFields) {
        html += '<label><input type="checkbox" data-toggle-dim-unused' + (dimUnusedFields ? ' checked' : '') + '> Hide unused branches</label>';
      }
      html += '</div>';
      if (highlightUsedFields) {
        html += '<p class="field-usage-legend"><span class="swatch direct"></span> direct match';
        html += ' · <span class="swatch desc"></span> parent of used field</p>';
      }
      if (e.linkedGuiNodes && e.linkedGuiNodes.length) {
        html += '<p class="meta field-usage-meta">Compared to GUI props from: ' + e.linkedGuiNodes.map(function (n) {
          return esc(n.label || n.type) + ' (' + esc(n.pageId) + '/' + esc(n.nodeId) + ')';
        }).join(', ') + '</p>';
      }
    } else if (e.guiAttribution === 'gui-linked') {
      html += '<p class="meta">No props sample linked yet — capture presentation with shown props to highlight used response fields.</p>';
    }
    var usedMap = highlightUsedFields && hasFieldUsage ? buildUsedPathMap(e.usedResponsePaths) : null;
    if (e.responseBodyPreview) {
      html += renderJsonPre(e.responseBodyPreview, usedMap, dimUnusedFields);
      if (e.responseBodyTruncated || e.responseBodyRef) {
        html += '<p class="meta">Preview truncated.</p>';
        html += renderBodyFullLink(e.responseBodyRef, 'Open full response body');
      }
    } else if (e.responseBodyRef) {
      html += '<p class="empty">Response body omitted from hop preview (too large).</p>';
      html += renderBodyFullLink(e.responseBodyRef, 'Open full response body');
    } else {
      html += '<p class="empty">No response body captured.</p>';
    }
    return html;
  }

  function renderHopSummary(e) {
    var analysis = analyzeHopErrors(e);
    var html = '<h3>' + esc(e.method) + ' ' + esc(e.path || e.url) + '</h3>';
    html += '<p class="meta">' + esc(eventHost(e)) + '<br/>';
    html += 'date <code>' + esc(formatDateOnly(e.timestamp) || '—') + '</code>';
    html += ' · time <code>' + esc(formatTimeOnly(e.timestamp) || '—') + '</code>';
    html += ' · ' + esc(e.timestamp);
    html += hopStatusBadgesHtml(e);
    html += hopDurationBadgeHtml(e, slowThresholdMs);
    html += hopTriggerBadgeHtml(e);
    html += hopGuiAttributionBadgeHtml(e);
    html += ' · ' + esc(e.source) + '</p>';
    if (e.requestId) html += '<p class="meta">requestId <code>' + esc(e.requestId) + '</code></p>';
    if (e.parentRequestId) html += '<p class="meta">parentRequestId <code>' + esc(e.parentRequestId) + '</code></p>';
    var us = usageList(e.usage);
    if (us.length) html += '<p class="used-by">used by: ' + us.map(formatUsage).map(esc).join(', ') + '</p>';
    var shotHop = resolveScreenshotForHop(e);
    if (shotHop) html += renderScreenshotPanelHtml(shotHop);
    html += renderTriggerPanelHtml(e);
    html += renderErrorPanelHtml(analysis, esc);
    html += renderSlowPanelHtml(e, slowThresholdMs, esc);
    html += renderHopBodies(e);
    return html;
  }

  function renderDrillDownBar(hopId) {
    var html = '<div class="arch-drill"><div class="body-label" style="margin:0">Drill down</div>';
    html += '<div class="arch-drill-btns">';
    if (hopId) {
      html += '<button type="button" data-view="trace" data-keep-select="' + esc(hopId) + '">Open in Trace</button>';
      html += '<button type="button" data-view="chains" data-keep-select="' + esc(hopId) + '">Open in Chains</button>';
      html += '<button type="button" data-view="waterfall" data-keep-select="' + esc(hopId) + '">Open in Waterfall</button>';
    }
    html += '<button type="button" data-view="map"' + (hopId ? ' data-keep-select="' + esc(hopId) + '"' : '') + '>Open in Map</button>';
    html += '<button type="button" data-view="architecture">Back to Architecture</button>';
    html += '</div></div>';
    return html;
  }

  function findHopParent(e) {
    if (!e || !e.parentRequestId) return null;
    return findByRequestId(e.parentRequestId);
  }

  function findHopChildren(e) {
    if (!e || !e.requestId) return [];
    return events.filter(function (c) {
      return c.parentRequestId === e.requestId && c.id !== e.id;
    }).sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    }).slice(0, 12);
  }

  function renderHopNeighborhood(e) {
    var parent = findHopParent(e);
    var children = findHopChildren(e);
    if (!parent && !children.length) return '';
    var html = '<div class="body-label">Call neighborhood</div>';
    if (parent) {
      html += '<button type="button" class="arch-neighbor" data-select="' + esc(parent.id) + '">';
      html += '<span class="role">Parent</span><span><strong>' + esc(parent.method) + '</strong> ' + esc(shortPathLabel(parent.path || parent.url));
      html += ' <span class="badge">' + esc(KIND_META[hopKind(parent)].label) + '</span></span></button>';
    }
    children.forEach(function (c) {
      html += '<button type="button" class="arch-neighbor" data-select="' + esc(c.id) + '">';
      html += '<span class="role">Child</span><span><strong>' + esc(c.method) + '</strong> ' + esc(shortPathLabel(c.path || c.url));
      html += ' <span class="badge">' + esc(KIND_META[hopKind(c)].label) + '</span></span></button>';
    });
    return html;
  }

  function renderLinkedGuiPanel(e) {
    var nodes = e.linkedGuiNodes || [];
    var us = usageList(e.usage);
    var html = '';
    if (nodes.length) {
      html += '<div class="body-label">Linked GUI</div><ul class="arch-gui-list">';
      nodes.forEach(function (n) {
        html += '<li><button type="button" class="arch-gui-item" data-select-node="' + esc(n.pageId) + '" data-node-id="' + esc(n.nodeId) + '">';
        html += '<strong>' + esc(n.label || n.type) + '</strong>';
        html += '<div class="meta">' + esc(n.pageId) + ' / ' + esc(n.nodeId) + (n.type ? ' · ' + esc(n.type) : '') + '</div>';
        html += '</button></li>';
      });
      html += '</ul>';
    }
    var screens = {};
    us.forEach(function (u) {
      if (u && u.screen) screens[u.screen] = true;
    });
    var screenKeys = Object.keys(screens);
    if (screenKeys.length) {
      html += '<div class="body-label">Screens</div><ul class="arch-gui-list">';
      screenKeys.forEach(function (s) {
        html += '<li><button type="button" class="arch-gui-item" data-select-screen="' + esc(s) + '">';
        html += '<strong>' + esc(s) + '</strong><div class="meta">Open screen context</div></button></li>';
      });
      html += '</ul>';
    }
    return html;
  }

  function renderArchitectureHopDetail(e) {
    var html = renderDrillDownBar(e.id);
    html += renderHopNeighborhood(e);
    html += renderLinkedGuiPanel(e);
    html += renderHopSummary(e);
    return html;
  }

  function renderArchitectureEmptyDetail() {
    var html = '<h3>Architecture detail</h3>';
    html += '<p class="arch-empty-hint empty">Click anything on the left to inspect without leaving Architecture:</p>';
    html += '<ul class="arch-empty-hint meta">';
    html += '<li><strong>Connection row</strong> — hop bodies, parent/child neighbors, GUI links</li>';
    html += '<li><strong>Chain box</strong> — that hop plus neighborhood</li>';
    html += '<li><strong>Screenshot</strong> — screen / page context and linked hops</li>';
    html += '<li><strong>GUI binding</strong> — node props + datasource hop</li>';
    html += '</ul>';
    html += '<p class="meta">Use <em>Open in Trace / Chains</em> in the detail pane when you need the full session timeline.</p>';
    return html;
  }

  function renderDetail(el) {
    if (!el) return;
    if (selectedMap && selectedMap.type === 'page') {
      var page = (doc.pages || {})[selectedMap.id];
      if (!page) { el.innerHTML = '<p class="empty">Page not found</p>'; return; }
      var pageHops = hopsForPage(page);
      var html = view === 'architecture' ? renderDrillDownBar(pageHops[0] && pageHops[0].id) : '';
      html += '<h3>' + esc(page.pageSlug || page.pageId) + '</h3>';
      html += '<p class="meta">pageId <code>' + esc(page.pageId) + '</code>';
      if (page.documentId) html += '<br/>documentId <code>' + esc(page.documentId) + '</code>';
      html += '<br/>lastSeenAt ' + esc(page.lastSeenAt || '') + '</p>';
      if (page.screenshotPath) {
        html += renderScreenshotPanelHtml({ path: page.screenshotPath, capturedAt: page.screenshotCapturedAt });
      }
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
      var firstHop = null;
      (node.datasources || []).some(function (d) { firstHop = findByRequestId(d.lastRequestId); return !!firstHop; });
      var htmlN = view === 'architecture' ? renderDrillDownBar(firstHop && firstHop.id) : '';
      htmlN += '<h3>' + esc(node.label || node.type) + '</h3>';
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
      if (firstHop) {
        htmlN += '<div class="body-label">Linked hop</div>';
        if (view === 'architecture') {
          htmlN += renderHopNeighborhood(firstHop);
          htmlN += renderHopSummary(firstHop);
        } else {
          htmlN += renderHopSummary(firstHop);
        }
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
      var htmlS = view === 'architecture' ? renderDrillDownBar(scHops[0] && scHops[0].id) : '';
      htmlS += '<h3>' + esc(selectedMap.id) + '</h3>';
      htmlS += '<p class="meta">Route / flow screen (not a CMS page — see Pages for presentation tree).</p>';
      htmlS += '<div class="meta">components: ' + esc((scDoc.components || []).join(', ') || '—') + '</div>';
      htmlS += '<div class="meta">datasources: ' + esc((scDoc.datasourceIds || []).join(', ') || '—') + '</div>';
      if (scDoc.screenshotPath) {
        htmlS += renderScreenshotPanelHtml({ path: scDoc.screenshotPath, capturedAt: scDoc.screenshotCapturedAt });
      }
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
      var htmlP = view === 'architecture' ? renderDrillDownBar(hop && hop.id) : '';
      htmlP += '<h3>' + esc(pref.datasourceId || selectedMap.id) + '</h3>';
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
      if (view === 'architecture') {
        el.innerHTML = renderArchitectureEmptyDetail();
      } else {
        el.innerHTML = '<h3>Detail</h3><p class="empty">Select a page, prefetch, or hop to inspect.</p>';
      }
      return;
    }
    if (view === 'architecture') {
      el.innerHTML = renderArchitectureHopDetail(e);
    } else {
      el.innerHTML = renderHopSummary(e);
    }
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
      html += hopGuiAttributionBadgeHtml(e);
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

  function mermaidSafeId(prefix, raw) {
    return String(prefix) + '_' + String(raw || '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 48);
  }

  function hopArchLabel(hop) {
    var svc = serviceForHop(hop);
    var path = shortPathLabel(hop.path || hop.url);
    var op = '';
    var us = usageList(hop.usage);
    if (us.length && us[0] && us[0].label) op = us[0].label;
    var line = svc.kindLabel + ' · ' + hop.method + ' ' + path;
    if (op) line += ' · ' + op;
    return line;
  }

  function collectArchitectureScreenshots() {
    var shots = [];
    var seen = {};
    function add(path, label, capturedAt, meta) {
      if (!path || seen[path]) return;
      seen[path] = true;
      shots.push({
        path: path,
        label: label || path,
        capturedAt: capturedAt,
        screen: meta && meta.screen,
        pageId: meta && meta.pageId
      });
    }
    Object.keys(doc.screens || {}).sort().forEach(function (s) {
      var sc = doc.screens[s];
      if (isOdenCollectionScreenArtifact(s, sc)) return;
      if (sc && sc.screenshotPath) add(sc.screenshotPath, s, sc.screenshotCapturedAt, { screen: s });
      (sc && sc.screenshots || []).forEach(function (ref) {
        if (ref && ref.path) add(ref.path, s + (ref.phase ? ' · ' + ref.phase : ''), ref.capturedAt, { screen: s });
      });
    });
    Object.keys(doc.pages || {}).sort().forEach(function (pid) {
      var p = doc.pages[pid];
      if (p && p.screenshotPath) add(p.screenshotPath, p.pageSlug || pid, p.screenshotCapturedAt, { pageId: pid });
      (p && p.screenshots || []).forEach(function (ref) {
        if (ref && ref.path) add(ref.path, (p.pageSlug || pid) + (ref.phase ? ' · ' + ref.phase : ''), ref.capturedAt, { pageId: pid });
      });
    });
    return shots.slice(0, 8);
  }

  function buildArchitectureIntent(baseList, uniqueMeta, chains) {
    var screens = Object.keys(doc.screens || {}).sort().filter(function (s) {
      return !isOdenCollectionScreenArtifact(s, doc.screens[s]);
    });
    var pages = Object.keys(doc.pages || {}).sort();
    var prefs = Object.keys(doc.prefetches || {}).sort();
    var parts = [];
    parts.push('Living architecture snapshot for scenario <code>' + esc(doc.scenario) + '</code>.');
    if (screens.length) {
      parts.push('Covers screen' + (screens.length === 1 ? '' : 's') + ' <strong>' + screens.slice(0, 5).map(esc).join('</strong>, <strong>') + '</strong>' + (screens.length > 5 ? ' …' : '') + '.');
    } else if (pages.length) {
      parts.push('CMS page' + (pages.length === 1 ? '' : 's') + ' <strong>' + pages.slice(0, 5).map(function (pid) {
        var p = doc.pages[pid];
        return esc(p.pageSlug || pid);
      }).join('</strong>, <strong>') + '</strong>' + (pages.length > 5 ? ' …' : '') + '.');
    } else {
      parts.push('Network-only capture so far (no screen / CMS presentation annotations yet).');
    }
    parts.push(
      'Shows <strong>' + uniqueMeta.uniqueCount + '</strong> unique endpoint' +
      (uniqueMeta.uniqueCount === 1 ? '' : 's') +
      ' from <strong>' + uniqueMeta.totalCount + '</strong> hop' +
      (uniqueMeta.totalCount === 1 ? '' : 's') +
      (chains.length ? ' across <strong>' + chains.length + '</strong> orchestration pattern' + (chains.length === 1 ? '' : 's') : '') +
      '.'
    );
    if (prefs.length) {
      parts.push('Prefetch datasource' + (prefs.length === 1 ? '' : 's') + ': ' + prefs.slice(0, 4).map(esc).join(', ') + (prefs.length > 4 ? ' …' : '') + '.');
    }
    parts.push('Repeat traffic is collapsed — open Trace / Waterfall for full timing.');
    return parts.join(' ');
  }

  function buildMermaidFromChains(chains) {
    var lines = ['flowchart TD'];
    var nodeIds = {};
    var edgeSeen = {};
    var nodeCount = 0;
    function ensureNode(hop) {
      var key = buildHopDedupKey(hop, chainRequestKeyMode(), 'global', usageList);
      if (nodeIds[key]) return nodeIds[key];
      nodeCount += 1;
      var id = mermaidSafeId('n', String(nodeCount));
      nodeIds[key] = id;
      var label = hopArchLabel(hop).replace(/"/g, "'");
      lines.push('  ' + id + '["' + label + '"]');
      return id;
    }
    function walkGroups(parentId, groups) {
      (groups || []).forEach(function (g) {
        var hop = pickRepresentativeHop(g.hops, uniqueKeep) || g.hops[0];
        var childId = ensureNode(hop);
        var ek = parentId + '->' + childId;
        if (!edgeSeen[ek]) {
          edgeSeen[ek] = true;
          var edgeLabel = g.hops.length > 1 ? '|×' + g.hops.length + '|' : '';
          lines.push('  ' + parentId + ' -->' + edgeLabel + ' ' + childId);
        }
        if (g.node && g.node.children.length) {
          walkGroups(childId, groupDownstreamCalls(g.node.children));
        }
      });
    }
    chains.slice(0, 6).forEach(function (ch) {
      var rootHop = pickRepresentativeHop([ch.tree.root.hop], uniqueKeep) || ch.tree.root.hop;
      var rootId = ensureNode(rootHop);
      walkGroups(rootId, ch.tree.level1 || []);
    });
    if (nodeCount === 0) {
      lines.push('  empty["No nested call chains yet"]');
    }
    return lines.join('\\n');
  }

  function collectConnectionRows(baseList, chains) {
    var rows = [];
    var seen = {};
    function pushRow(row) {
      var key = [row.from, row.to, row.kind, row.hopId].join('|');
      if (seen[key]) return;
      seen[key] = true;
      rows.push(row);
    }
    chains.forEach(function (ch) {
      function walk(parentHop, groups, depth) {
        (groups || []).forEach(function (g) {
          var child = pickRepresentativeHop(g.hops, uniqueKeep) || g.hops[0];
          pushRow({
            kind: 'parent→child',
            from: hopArchLabel(parentHop),
            to: hopArchLabel(child),
            note: (g.hops.length > 1 ? g.hops.length + ' identical calls · ' : '') +
              'level ' + depth + ' via parentRequestId' +
              (ch.context ? ' · screen ' + ch.context : ''),
            hopId: child.id
          });
          if (g.node && g.node.children.length) {
            walk(child, groupDownstreamCalls(g.node.children), depth + 1);
          }
        });
      }
      walk(ch.tree.root.hop, ch.tree.level1 || [], 1);
    });
    baseList.forEach(function (e) {
      usageList(e.usage).forEach(function (u) {
        if (!u) return;
        if (u.screen) {
          pushRow({
            kind: 'screen→hop',
            from: u.screen,
            to: hopArchLabel(e),
            note: (u.component ? 'component ' + u.component : formatUsage(u)) +
              (e.guiAttribution === 'gui-linked' ? ' · GUI-linked' : e.guiAttribution === 'screen-only' ? ' · screen-only' : ''),
            hopId: e.id
          });
        }
        if (u.cms && (u.cms.pageId || u.cms.nodeId)) {
          pushRow({
            kind: 'cms→hop',
            from: (u.cms.pageId || '') + (u.cms.nodeId ? '/' + u.cms.nodeId : ''),
            to: hopArchLabel(e),
            note: (u.cms.type ? 'type ' + u.cms.type : 'CMS node') +
              (u.datasourceId ? ' · ds ' + u.datasourceId : ''),
            hopId: e.id
          });
        }
      });
    });
    Object.keys(doc.pages || {}).forEach(function (pid) {
      var page = doc.pages[pid];
      Object.keys(page.nodes || {}).forEach(function (nid) {
        var node = page.nodes[nid];
        (node.datasources || []).forEach(function (d) {
          var hop = findByRequestId(d.lastRequestId);
          if (!hop) return;
          pushRow({
            kind: 'gui→datasource',
            from: (node.label || node.type) + ' (' + pid + ')',
            to: hopArchLabel(hop),
            note: 'datasource ' + d.datasourceId +
              (d.dataRoot ? ' · root ' + d.dataRoot : '') +
              ((d.operations || []).length ? ' · ops ' + d.operations.join(', ') : ''),
            hopId: hop.id
          });
        });
      });
    });
    return rows.slice(0, 80);
  }

  function collectGuiBindingNotes() {
    var notes = [];
    Object.keys(doc.pages || {}).sort().forEach(function (pid) {
      var page = doc.pages[pid];
      Object.keys(page.nodes || {}).sort().forEach(function (nid) {
        var node = page.nodes[nid];
        var ds = (node.datasources || []).map(function (d) {
          return d.datasourceId + (d.dataRoot ? ' @ ' + d.dataRoot : '');
        });
        if (!ds.length && !node.propsSample) return;
        notes.push({
          title: (node.label || node.type) + ' · ' + (page.pageSlug || pid),
          detail: (ds.length ? 'reads ' + ds.join('; ') : 'no datasource yet') +
            (node.propsSample != null ? ' · has props sample' : ''),
          pageId: pid,
          nodeId: nid
        });
      });
    });
    return notes.slice(0, 24);
  }

  function renderArchitecture(el) {
    var base = applyKindFilter(filterEvents());
    var uniqueMeta = applyUniqueFilter(base, { mode: uniqueMode === 'off' ? 'endpoint' : uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
    var archList = uniqueMeta.list;
    var chains = buildUniqueChains(base);
    var shots = collectArchitectureScreenshots();
    var connections = collectConnectionRows(archList, chains);
    var guiNotes = collectGuiBindingNotes();
    var html = '';
    html += '<div class="arch-hero">';
    html += '<h2>Architecture</h2>';
    html += '<p class="arch-intent">' + buildArchitectureIntent(base, uniqueMeta, chains) + '</p>';
    html += '<p class="meta">updatedAt ' + esc(doc.updatedAt || '') + ' · Unique filter defaults to endpoints (repeats collapsed)</p>';
    html += '<div class="arch-stats">';
    html += '<span class="arch-stat"><strong>' + uniqueMeta.uniqueCount + '</strong> unique</span>';
    html += '<span class="arch-stat"><strong>' + uniqueMeta.totalCount + '</strong> hops</span>';
    html += '<span class="arch-stat"><strong>' + chains.length + '</strong> chain pattern' + (chains.length === 1 ? '' : 's') + '</span>';
    html += '<span class="arch-stat"><strong>' + Object.keys(doc.screens || {}).length + '</strong> screens</span>';
    html += '<span class="arch-stat"><strong>' + Object.keys(doc.pages || {}).length + '</strong> pages</span>';
    html += '<span class="arch-stat"><strong>' + Object.keys(doc.prefetches || {}).length + '</strong> prefetches</span>';
    html += '</div></div>';

    html += renderUniqueFilters(base, uniqueMeta);

    if (shots.length) {
      html += '<div class="arch-section"><h2>Screenshots</h2>';
      html += '<p class="meta">Click a capture to open screen / page context in the detail pane.</p>';
      html += '<div class="arch-shot-strip">';
      shots.forEach(function (s) {
        var src = atlasAssetUrl(s.path);
        var shotSelected = (s.screen && selectedMap && selectedMap.type === 'screen' && selectedMap.id === s.screen)
          || (s.pageId && selectedMap && selectedMap.type === 'page' && selectedMap.id === s.pageId);
        html += '<button type="button" class="arch-shot' + (shotSelected ? ' selected' : '') + '"';
        if (s.screen) html += ' data-select-screen="' + esc(s.screen) + '"';
        else if (s.pageId) html += ' data-select-page="' + esc(s.pageId) + '"';
        html += '>';
        html += '<img src="' + esc(src) + '" alt="' + esc(s.label) + '" loading="lazy" data-atlas-img />';
        html += '<span class="meta">' + esc(s.label);
        if (s.capturedAt) html += '<br/>' + esc(formatWhen(s.capturedAt));
        html += '</span></button>';
      });
      html += '</div></div>';
    }

    html += '<div class="arch-section"><h2>Unique call graph</h2>';
    html += '<p class="meta">Illustrative flowchart of unique parent→child connections (Mermaid source — paste into docs). Click any chain box for hop detail.</p>';
    html += '<pre class="arch-mermaid">' + esc(buildMermaidFromChains(chains)) + '</pre>';
    if (!chains.length) {
      html += '<p class="empty">No nested chains yet — enable includeTraceHeader / parentRequestId to link hops. Unique endpoints still appear under Connections.</p>';
    } else {
      chains.slice(0, 4).forEach(function (ch) {
        html += '<div class="chain-card">';
        html += '<div class="chain-h"><span><strong>' + esc(ch.title) + '</strong></span>';
        if (ch.context) html += ' <span class="meta">· ' + esc(ch.context) + '</span>';
        if (ch.count > 1) html += ' <span class="badge repeat">×' + ch.count + '</span>';
        html += '</div>';
        html += renderChainTree(ch.tree);
        html += '</div>';
      });
      if (chains.length > 4) {
        html += '<p class="meta">+' + (chains.length - 4) + ' more pattern(s) — open the <button type="button" data-view="chains">Chains</button> tab.</p>';
      }
    }
    html += '</div>';

    html += '<div class="arch-section"><h2>Connections</h2>';
    html += '<p class="meta">Unique links between screens, CMS nodes, and network hops — click a row to inspect (not every timed call).</p>';
    if (!connections.length) {
      html += '<p class="empty">No connections yet. Browse with screen session + CMS presentation capture, or traffic with parentRequestId nesting.</p>';
    } else {
      html += '<table class="arch-conn-table"><thead><tr><th>Kind</th><th>From</th><th>To</th><th>Explanation</th></tr></thead><tbody>';
      connections.forEach(function (row) {
        var sel = selectedId && row.hopId === selectedId ? ' selected' : '';
        html += '<tr class="arch-conn-row' + sel + '"';
        if (row.hopId) html += ' data-select="' + esc(row.hopId) + '"';
        else if (row.kind === 'screen→hop' && row.from) html += ' data-select-screen="' + esc(row.from) + '"';
        html += '>';
        html += '<td><span class="badge">' + esc(row.kind) + '</span></td>';
        html += '<td>' + esc(row.from) + '</td>';
        html += '<td>' + esc(row.to) + '</td>';
        html += '<td class="meta">' + esc(row.note) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';

    if (guiNotes.length) {
      html += '<div class="arch-section"><h2>GUI bindings</h2>';
      html += '<p class="meta">Click a component to open props + datasource hop in the detail pane.</p>';
      html += '<ul class="arch-gui-list">';
      guiNotes.forEach(function (n) {
        var guiSelected = selectedMap && selectedMap.type === 'node' && selectedMap.pageId === n.pageId && selectedMap.id === n.nodeId;
        html += '<li><button type="button" class="arch-gui-item' + (guiSelected ? ' selected' : '') + '" data-select-node="' + esc(n.pageId) + '" data-node-id="' + esc(n.nodeId) + '">';
        html += '<strong>' + esc(n.title) + '</strong><div class="meta">' + esc(n.detail) + '</div>';
        html += '</button></li>';
      });
      html += '</ul></div>';
    }

    html += '<p class="arch-nav-hint">Session forensics: <button type="button" data-view="trace">Trace</button> · <button type="button" data-view="waterfall">Waterfall</button> · <button type="button" data-view="map">Map</button> · <button type="button" data-view="requests">Requests</button> · <button type="button" data-view="fields">Fields</button></p>';
    el.innerHTML = html;
  }

  function buildPageTreeRows() {
    var pages = doc.pages || {};
    var byTreePath = {};
    var placementCountByPage = {};
    Object.keys(pages).forEach(function (pid) {
      var p = pages[pid];
      var placements = p.placements || [];
      placementCountByPage[pid] = placements.length;
      placements.forEach(function (pl) {
        if (!pl || !pl.treePath) return;
        byTreePath[pl.treePath] = {
          treePath: pl.treePath,
          parentTreePath: pl.parentTreePath == null ? null : pl.parentTreePath,
          parentPageId: pl.parentPageId == null ? null : pl.parentPageId,
          depth: typeof pl.depth === 'number' ? pl.depth : 0,
          pageId: pid,
          page: p,
          lastSeenAt: pl.lastSeenAt
        };
      });
    });
    // Fallback: pages with no placements still appear as roots (flat capture).
    Object.keys(pages).forEach(function (pid) {
      var p = pages[pid];
      if ((p.placements || []).length) return;
      if (byTreePath[pid]) return;
      byTreePath[pid] = {
        treePath: pid,
        parentTreePath: null,
        parentPageId: null,
        depth: 0,
        pageId: pid,
        page: p,
        lastSeenAt: p.lastSeenAt
      };
    });

    var childrenOf = {};
    var roots = [];
    Object.keys(byTreePath).forEach(function (tp) {
      var node = byTreePath[tp];
      var parent = node.parentTreePath;
      if (parent && byTreePath[parent]) {
        if (!childrenOf[parent]) childrenOf[parent] = [];
        childrenOf[parent].push(node);
      } else {
        roots.push(node);
      }
    });
    Object.keys(childrenOf).forEach(function (k) {
      childrenOf[k].sort(function (a, b) {
        return (a.treePath || '').localeCompare(b.treePath || '');
      });
    });
    roots.sort(function (a, b) {
      return (a.treePath || '').localeCompare(b.treePath || '');
    });

    var rows = [];
    function walkWithFlags(node, ancestorsLast, isLast) {
      var kids = childrenOf[node.treePath] || [];
      rows.push({ node: node, ancestorsLast: ancestorsLast.slice(), isLast: isLast, childCount: kids.length });
      kids.forEach(function (child, idx) {
        walkWithFlags(child, ancestorsLast.concat([isLast]), idx === kids.length - 1);
      });
    }
    roots.forEach(function (r, idx) {
      walkWithFlags(r, [], idx === roots.length - 1);
    });
    return { rows: rows, placementCountByPage: placementCountByPage, totalPlacements: Object.keys(byTreePath).length };
  }

  function treeGuide(ancestorsLast, isLast) {
    var s = '';
    for (var i = 0; i < ancestorsLast.length; i++) {
      s += ancestorsLast[i] ? '   ' : '│  ';
    }
    s += isLast ? '└─ ' : '├─ ';
    return s;
  }

  function renderPageTreeHtml() {
    var built = buildPageTreeRows();
    if (!built.rows.length) return '<p class="empty">No page tree yet — visit CMS pages to capture hierarchy</p>';
    var html = '<div class="page-tree">';
    built.rows.forEach(function (row) {
      var node = row.node;
      var p = node.page;
      var pid = node.pageId;
      var selected = selectedMap && selectedMap.type === 'page' && selectedMap.id === pid;
      var nodeCount = Object.keys((p && p.nodes) || {}).length;
      var isStub = nodeCount === 0;
      var dups = built.placementCountByPage[pid] || 0;
      html += '<div class="page-tree-item' + (selected ? ' selected' : '') + (isStub ? ' stub' : '') + '" data-select-page="' + esc(pid) + '">';
      html += '<span class="page-tree-guide">' + esc(treeGuide(row.ancestorsLast, row.isLast)) + '</span>';
      html += '<div class="page-tree-label">';
      html += '<strong>' + esc((p && p.pageSlug) || pid) + '</strong>';
      html += ' <span class="badge level">L' + node.depth + '</span>';
      if (dups > 1) html += ' <span class="badge dup">×' + dups + ' in tree</span>';
      if (isStub) html += ' <span class="badge">ancestor</span>';
      else if (nodeCount) html += ' <span class="badge">' + nodeCount + ' nodes</span>';
      if (node.treePath && node.treePath !== pid) {
        html += '<div><code class="path">' + esc(node.treePath) + '</code></div>';
      }
      html += '</div></div>';
    });
    html += '</div>';
    html += '<p class="meta">' + built.totalPlacements + ' placement(s) · same page under multiple parents shows as duplicate rows</p>';
    return html;
  }

  function isLayoutCmsType(type) {
    var t = String(type || '').toLowerCase();
    return t === 'container' || t === 'section' || t === 'flexbox' || t === 'gridcard' || t === 'carousel' || t.indexOf('container') >= 0;
  }

  function buildCmsNodeForest(nodes) {
    var byId = {};
    nodes.forEach(function (n) { byId[n.nodeId] = n; });
    var childrenOf = {};
    var roots = [];
    nodes.forEach(function (n) {
      var parentId = n.parentId;
      if (parentId && byId[parentId] && parentId !== n.nodeId) {
        if (!childrenOf[parentId]) childrenOf[parentId] = [];
        childrenOf[parentId].push(n);
      } else {
        roots.push(n);
      }
    });
    Object.keys(childrenOf).forEach(function (k) {
      childrenOf[k].sort(function (a, b) {
        return (a.path || '').localeCompare(b.path || '') || (a.nodeId || '').localeCompare(b.nodeId || '');
      });
    });
    roots.sort(function (a, b) {
      return (a.path || '').localeCompare(b.path || '') || (a.nodeId || '').localeCompare(b.nodeId || '');
    });
    return { roots: roots, childrenOf: childrenOf };
  }

  function stripOuterSlashes(s) {
    s = String(s || '');
    while (s.charAt(0) === '/') s = s.slice(1);
    while (s.length && s.charAt(s.length - 1) === '/') s = s.slice(0, -1);
    return s;
  }

  function resolveLinkedPageId(link) {
    if (!link || !link.value) return null;
    var pages = doc.pages || {};
    if (link.type === 'id') {
      for (var pid in pages) {
        if (!Object.prototype.hasOwnProperty.call(pages, pid)) continue;
        // document ids are not stored on pages today — match pageId / placement path loosely
        if (pid === link.value) return pid;
      }
      return null;
    }
    var raw = stripOuterSlashes(link.value);
    var candidates = [raw, link.value, '/' + raw];
    for (var i = 0; i < candidates.length; i++) {
      if (pages[candidates[i]]) return candidates[i];
    }
    for (var pageId in pages) {
      if (!Object.prototype.hasOwnProperty.call(pages, pageId)) continue;
      var p = pages[pageId];
      if (pageId === raw || (p.pageSlug && stripOuterSlashes(p.pageSlug) === raw)) return pageId;
      var placements = p.placements || [];
      for (var j = 0; j < placements.length; j++) {
        var tp = stripOuterSlashes(placements[j].treePath || '');
        if (tp === raw || tp.endsWith('/' + raw) || raw.endsWith('/' + tp)) return pageId;
      }
    }
    return null;
  }

  function renderCmsNodeLinksHtml(n, pageHops) {
    var links = n.links || [];
    if (!links.length) return '';
    var open = !isCollapsed('links:' + n.nodeId);
    var html = '<div class="cms-tree-links">';
    html += '<div class="meta"><button type="button" class="chev" data-collapse="links:' + esc(n.nodeId) + '">' + (open ? '▼' : '▶') + '</button> ';
    html += '<span class="badge link">' + links.length + ' page link' + (links.length === 1 ? '' : 's') + '</span></div>';
    if (open) {
      links.forEach(function (link) {
        var targetPid = resolveLinkedPageId(link);
        html += '<div class="link-row">';
        html += '<span class="badge">' + esc(link.type) + '</span> ';
        if (targetPid) {
          html += '<button type="button" class="link-page" data-select-page="' + esc(targetPid) + '" title="Open linked page in Map">' + esc(link.value) + '</button>';
          var tp = doc.pages[targetPid];
          if (tp && tp.pageSlug && tp.pageSlug !== targetPid) {
            html += ' <span class="meta">' + esc(tp.pageSlug) + '</span>';
          }
        } else {
          html += '<code>' + esc(link.value) + '</code> <span class="meta">not captured yet</span>';
        }
        html += '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function renderCmsNodeTreeHtml(pid, pageHops, nodes) {
    var forest = buildCmsNodeForest(nodes);
    function renderNode(n, depth) {
      var kids = forest.childrenOf[n.nodeId] || [];
      var collapseKey = 'cmsnode:' + pid + ':' + n.nodeId;
      var open = !isCollapsed(collapseKey);
      var nodeHop = null;
      (n.datasources || []).some(function (d) {
        nodeHop = findByRequestId(d.lastRequestId);
        return !!nodeHop;
      });
      if (!nodeHop && pageHops.length === 1) nodeHop = pageHops[0];
      var nodeSelected = (selectedMap && selectedMap.type === 'node' && selectedMap.pageId === pid && selectedMap.id === n.nodeId)
        || (nodeHop && !selectedMap && selectedId === nodeHop.id);
      var isWrap = kids.length > 0 || isLayoutCmsType(n.type);
      var html = '<div class="cms-tree-node">';
      html += '<div class="cms-tree-row map-selectable' + (nodeSelected ? ' selected' : '') + (isWrap ? ' container-node' : '') + '" data-select-node="' + esc(pid) + '" data-node-id="' + esc(n.nodeId) + '">';
      if (kids.length || (n.links && n.links.length)) {
        html += '<button type="button" class="chev" data-collapse="' + esc(collapseKey) + '">' + (open ? '▼' : '▶') + '</button>';
      } else {
        html += '<span class="chev">·</span>';
      }
      html += '<div style="flex:1;min-width:0">';
      html += '<strong>' + esc(n.label || n.type) + '</strong> <span class="badge">' + esc(n.type) + '</span>';
      if (isWrap) html += ' <span class="badge wrap">wraps ' + kids.length + '</span>';
      if (n.links && n.links.length) html += ' <span class="badge link">' + n.links.length + ' link' + (n.links.length === 1 ? '' : 's') + '</span>';
      if (n.parentId) html += ' <span class="meta">under ' + esc(n.parentId) + '</span>';
      html += '<div class="meta">' + esc(n.path) + '</div>';
      if (n.datasources && n.datasources.length) {
        html += '<div class="used-by">' + n.datasources.map(function (d) {
          return esc(d.datasourceId) + (d.dataRoot ? ' · ' + esc(d.dataRoot) : '');
        }).join('; ') + '</div>';
      }
      html += '</div>';
      html += '<div class="col-side">' + (nodeHop ? esc(formatWhen(nodeHop.timestamp)) : '') + '</div>';
      html += '</div>';
      if (open) {
        html += renderCmsNodeLinksHtml(n, pageHops);
        if (kids.length) {
          html += '<div class="cms-tree-children">';
          kids.forEach(function (child) {
            html += renderNode(child, depth + 1);
          });
          html += '</div>';
        }
      }
      html += '</div>';
      return html;
    }
    var html = '<div class="cms-tree">';
    forest.roots.forEach(function (r) { html += renderNode(r, 0); });
    html += '</div>';
    return html;
  }

  function renderMap(el) {
    var base = applyKindFilter(filterEvents());
    var uniqueMeta = applyUniqueFilter(base, { mode: uniqueMode, scope: uniqueScope, keep: uniqueKeep }, usageList);
    var pages = Object.keys(doc.pages || {}).sort();
    var html = renderUniqueFilters(base, uniqueMeta);
    html += '<p class="meta">scenario <code>' + esc(doc.scenario) + '</code> · updatedAt ' + esc(doc.updatedAt) + '</p>';
    html += '<p class="meta">' + events.length + ' hop(s) · click a row to inspect request / response in the detail pane</p>';
    html += '<h2>Page tree</h2>';
    html += renderPageTreeHtml();
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
      if ((p.placements || []).length) {
        html += ' <span class="badge level">' + p.placements.length + ' tree path' + (p.placements.length === 1 ? '' : 's') + '</span>';
        if (p.placements.length > 1) html += ' <span class="badge dup">duplicated</span>';
      }
      if (pageHops.length) html += ' <span class="badge">' + esc(hopCountLabel(pageHops)) + '</span>';
      if (p.editUrl) html += ' <a href="' + esc(p.editUrl) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">Edit in CMS ↗</a>';
      html += ' <a href="pages/' + esc(pid.replace(/[^a-zA-Z0-9._-]+/g, '_')) + '.html" onclick="event.stopPropagation()">static page →</a></div></div>';
      if (open) {
        if ((p.placements || []).length) {
          html += '<div class="meta" style="padding:0.25rem 0.65rem">Tree placements</div>';
          p.placements.forEach(function (pl) {
            html += '<div class="map-row"><div class="col">';
            html += '<span class="badge level">L' + pl.depth + '</span> <code>' + esc(pl.treePath) + '</code>';
            if (pl.parentTreePath) html += '<div class="meta">under ' + esc(pl.parentTreePath) + '</div>';
            else html += '<div class="meta">root</div>';
            html += '</div></div>';
          });
        }
        if (nodes.length) {
          html += '<div class="meta" style="padding:0.25rem 0.65rem">Component tree <span class="meta">(containers wrap children · page links nest under nodes)</span></div>';
          html += renderCmsNodeTreeHtml(pid, pageHops, nodes);
        }
        if (pageHops.length) {
          html += '<div class="meta" style="padding:0.35rem 0.65rem 0.15rem">Linked hops · click for request / response</div>';
          pageHops.forEach(function (hop) {
            html += '<div class="map-row' + (selectedId === hop.id ? ' selected' : '') + '" data-select="' + esc(hop.id) + '">';
            html += '<div class="col"><strong>' + esc(hop.method) + '</strong> ' + esc(hop.path || hop.url);
            html += ' <span class="badge">' + esc(hopKind(hop)) + '</span>';

            html += hopStatusBadgesHtml(hop);
            html += hopDurationBadgeHtml(hop, slowThresholdMs);
            html += hopGuiAttributionBadgeHtml(hop);
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
            html += hopGuiAttributionBadgeHtml(hop);
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
            html += hopGuiAttributionBadgeHtml(e);
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
        html += hopGuiAttributionBadgeHtml(e);
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
        html += hopGuiAttributionBadgeHtml(e);
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

  /** Mirror of atlas-request-scrubber resolveHopDurationMs / hopStateAt (keep in sync). */
  function scrubDurationMs(e) {
    var raw = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
    if (raw > 0) return Math.max(raw, 1);
    return 8;
  }
  function scrubHopState(e, playheadMs, t0Ms) {
    var startAbs = new Date(e.timestamp).getTime();
    if (!isFinite(startAbs)) return 'future';
    var start = startAbs - t0Ms;
    var end = start + scrubDurationMs(e);
    if (start > playheadMs) return 'future';
    if (end <= playheadMs) return 'done';
    return 'in-flight';
  }
  function formatScrubOffset(ms) {
    if (!(ms >= 0)) return '+0ms';
    if (ms < 1000) return '+' + Math.round(ms) + 'ms';
    return '+' + (ms / 1000).toFixed(ms < 10000 ? 2 : 1) + 's';
  }
  function collectDocScreenshots() {
    var shots = [];
    var seen = {};
    function addShot(shot) {
      if (!shot || !shot.path || seen[shot.path]) return;
      seen[shot.path] = true;
      shots.push(shot);
    }
    function addFromEntry(entry, labelPrefix, key) {
      if (!entry) return;
      var labelBase = labelPrefix + ' ' + ((entry.screen || entry.pageSlug || key) || '');
      if (entry.screenshots && entry.screenshots.length) {
        entry.screenshots.forEach(function (s) {
          addShot({
            path: s.path,
            capturedAt: s.capturedAt,
            label: labelBase + (s.phase ? ' · ' + s.phase : '')
          });
        });
        return;
      }
      if (entry.screenshotPath) {
        addShot({ path: entry.screenshotPath, capturedAt: entry.screenshotCapturedAt, label: labelBase });
      }
    }
    var screens = doc.screens || {};
    Object.keys(screens).forEach(function (k) { addFromEntry(screens[k], 'screen', k); });
    var pages = doc.pages || {};
    Object.keys(pages).forEach(function (pid) { addFromEntry(pages[pid], 'page', pid); });
    return shots;
  }
  function nearestDocScreenshot(absoluteMs) {
    var shots = collectDocScreenshots();
    var best = null;
    var bestAt = -Infinity;
    var upcoming = null;
    var upcomingAt = Infinity;
    shots.forEach(function (shot) {
      if (!shot || !shot.path) return;
      var at = shot.capturedAt ? new Date(shot.capturedAt).getTime() : NaN;
      if (!isFinite(at)) return;
      if (at <= absoluteMs) {
        if (at >= bestAt) {
          bestAt = at;
          best = shot;
        }
      } else if (at < upcomingAt) {
        upcomingAt = at;
        upcoming = shot;
      }
    });
    return { atOrBefore: best, upcoming: upcoming, upcomingAt: isFinite(upcomingAt) ? upcomingAt : null };
  }
  function scrubStateBadgeHtml(state) {
    if (state === 'in-flight') return ' <span class="badge scrub-state-inflight">in-flight</span>';
    if (state === 'done') return ' <span class="badge scrub-state-done">done</span>';
    return ' <span class="badge scrub-state-future">future</span>';
  }
  function scrubRowClass(state) {
    if (state === 'in-flight') return ' scrub-inflight';
    if (state === 'future') return ' scrub-future';
    return '';
  }
  function stopScrubPlayback() {
    scrubPlaying = false;
    if (scrubTimerId != null) {
      clearInterval(scrubTimerId);
      scrubTimerId = null;
    }
  }
  function startScrubPlayback() {
    if (scrubPlaying) return;
    if (!(scrubSpanMs > 0)) return;
    if (scrubPlayheadMs == null || scrubPlayheadMs >= scrubSpanMs) scrubPlayheadMs = 0;
    scrubPlaying = true;
    scrubTimerId = setInterval(function () {
      var step = Math.max(scrubSpanMs / 100, 20);
      var next = (scrubPlayheadMs == null ? 0 : scrubPlayheadMs) + step;
      if (next >= scrubSpanMs) {
        scrubPlayheadMs = scrubSpanMs;
        stopScrubPlayback();
      } else {
        scrubPlayheadMs = next;
      }
      render();
    }, SCRUB_TICK_MS);
  }
  /** Prefer in-flight hop at playhead, else latest completed — drives right-hand detail. */
  function pickHopAtPlayhead(rows) {
    var inflight = null;
    var latestDone = null;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.state === 'in-flight') inflight = r.event;
      else if (r.state === 'done') latestDone = r.event;
    }
    return inflight || latestDone;
  }

  function renderScrub(el, uniqueMeta) {
    var base = applyKindFilter(filterEvents());
    var html = renderListFilters(base, uniqueMeta);
    var list = uniqueMeta.list;
    if (!list.length) {
      stopScrubPlayback();
      html += '<p class="empty">No hops to scrub for the selected kinds.</p>';
      el.innerHTML = html;
      return;
    }
    var tw = timing(list);
    var t0 = Infinity;
    list.forEach(function (e) {
      var s = new Date(e.timestamp).getTime();
      if (isFinite(s)) t0 = Math.min(t0, s);
    });
    if (!isFinite(t0)) t0 = Date.now();
    var span = tw.span;
    scrubSpanMs = span;
    if (scrubPlayheadMs == null || !isFinite(scrubPlayheadMs)) scrubPlayheadMs = scrubPlaying ? 0 : span;
    if (scrubPlayheadMs < 0) scrubPlayheadMs = 0;
    if (scrubPlayheadMs > span) scrubPlayheadMs = span;
    var playhead = scrubPlayheadMs;
    var counts = { future: 0, inFlight: 0, done: 0, appeared: 0 };
    var rows = tw.bars.map(function (b) {
      var state = scrubHopState(b.event, playhead, t0);
      if (state === 'future') counts.future += 1;
      else if (state === 'in-flight') { counts.inFlight += 1; counts.appeared += 1; }
      else { counts.done += 1; counts.appeared += 1; }
      return { event: b.event, start: b.start, dur: b.dur, state: state };
    });
    var pick = pickHopAtPlayhead(rows);
    if (pick) {
      selectedId = pick.id;
      selectedMap = null;
    }
    var absNow = t0 + playhead;
    var near = nearestDocScreenshot(absNow);
    var shot = near.atOrBefore;
    html += '<p class="meta">Drag the playhead or press Play — the detail pane on the right follows the request active at that moment.</p>';
    html += '<div class="scrub-toolbar">';
    html += '<div class="scrub-play-controls">';
    if (scrubPlaying) {
      html += '<button type="button" data-scrub-pause title="Pause playback">Pause</button>';
    } else {
      html += '<button type="button" data-scrub-play title="Play from playhead (restarts at 0 if at end)">Play</button>';
    }
    html += '</div>';
    html += '<div class="scrub-slider-wrap">';
    html += '<label class="meta" for="scrub-playhead">Playhead</label>';
    html += '<input id="scrub-playhead" type="range" min="0" max="' + Math.max(Math.round(span), 1) + '" step="1" value="' + Math.round(playhead) + '" data-scrub-ms />';
    html += '</div>';
    html += '<div class="scrub-time" title="' + esc(new Date(absNow).toISOString()) + '">' + esc(formatScrubOffset(playhead));
    html += '<div class="meta">' + esc(formatWhen(new Date(absNow).toISOString())) + '</div></div>';
    html += '<div class="scrub-counts">';
    html += '<span class="badge done">done ' + counts.done + '</span>';
    html += '<span class="badge in-flight">in-flight ' + counts.inFlight + '</span>';
    html += '<span class="badge future">future ' + counts.future + '</span>';
    html += '<span class="badge">appeared ' + counts.appeared + '/' + list.length + '</span>';
    html += '</div>';
    html += '<label class="meta"><input type="checkbox" data-scrub-hide-future' + (scrubHideFuture ? ' checked' : '') + '> Hide future</label>';
    html += '</div>';
    var playPct = span > 0 ? (playhead / span) * 100 : 0;
    html += '<div class="scrub-global-track" title="Session timeline">';
    rows.forEach(function (r) {
      var left = (r.start / span) * 100;
      var width = Math.max((r.dur / span) * 100, 0.35);
      html += '<div class="' + barClass(r.event) + (r.state === 'future' ? ' scrub-future-bar' : '') + '" style="left:' + left + '%;width:' + width + '%;opacity:' + (r.state === 'future' ? '0.25' : '0.9') + '"></div>';
    });
    html += '<div class="scrub-playhead" style="left:' + playPct + '%"></div>';
    html += '</div>';
    if (shot) {
      html += renderScreenshotPanelHtml(shot);
      if (shot.label) html += '<p class="meta">Nearest capture: ' + esc(shot.label) + '</p>';
    } else if (near.upcoming) {
      html += '<p class="meta">No screenshot at or before this playhead — next capture at ' + esc(formatScrubOffset(near.upcomingAt - t0));
      if (near.upcoming.label) html += ' (' + esc(near.upcoming.label) + ')';
      html += '.</p>';
      html += renderScreenshotPanelHtml(near.upcoming);
      html += '<p class="meta">Showing upcoming capture (after playhead).</p>';
    } else {
      html += '<p class="meta">No screenshot at or before this playhead.</p>';
    }
    html += '<div class="group"><div class="group-h">Requests at playhead<span class="spacer">' + (scrubHideFuture ? counts.appeared : list.length) + '</span></div>';
    rows.forEach(function (r) {
      if (scrubHideFuture && r.state === 'future') return;
      var e = r.event;
      html += '<div class="timing-row' + (selectedId === e.id ? ' selected' : '') + scrubRowClass(r.state) + hopRowIssueClass(e) + '" data-select="' + esc(e.id) + '">';
      html += '<div>' + esc(e.method) + ' ' + esc(e.path || e.url);
      html += scrubStateBadgeHtml(r.state);
      html += repeatBadgeHtml(uniqueMeta, e);
      html += hopStatusBadgesHtml(e);
      html += hopDurationBadgeHtml(e, slowThresholdMs);
      html += hopTriggerBadgeHtml(e);
      html += hopGuiAttributionBadgeHtml(e);
      html += hopContextBadgeHtml(e);
      html += '<div class="meta">' + esc(formatWhen(e.timestamp)) + ' · ' + esc(formatScrubOffset(r.start)) + ' · ' + esc(KIND_META[hopKind(e)].label) + '</div>';
      var us = usageList(e.usage);
      if (us.length) html += '<div class="used-by">' + us.map(formatUsage).map(esc).join(', ') + '</div>';
      html += '</div>';
      html += '<div class="track"><div class="' + barClass(e) + '" style="left:' + ((r.start / span) * 100) + '%;width:' + Math.max((r.dur / span) * 100, 0.4) + '%"></div>';
      html += '<div class="scrub-playhead" style="left:' + playPct + '%"></div></div>';
      var durRight = typeof e.durationMs === 'number' ? e.durationMs : e._estimatedDurationMs;
      html += '<div class="meta">' + (durRight != null ? durRight + 'ms' + (e.durationMs == null ? '~' : '') : '—') + '</div></div>';
    });
    html += '</div>';
    el.innerHTML = html;
    if (scrubFocus) {
      var inp = el.querySelector('[data-scrub-ms]');
      if (inp) {
        inp.focus();
      }
      scrubFocus = false;
    }
  }

  function fieldHopKind(e) {
    var k = hopKind(e);
    if (k === 'cms') return 'cms';
    var usages = usageList(e.usage);
    for (var i = 0; i < usages.length; i++) {
      var ds = String((usages[i] && usages[i].datasourceId) || '');
      if (ds.indexOf('oden:') === 0 || ds.indexOf('deliveryapi') >= 0) return 'cms';
    }
    var path = String((e && e.path) || (e && e.url) || '').toLowerCase();
    if (path.indexOf('oden') >= 0) return 'cms';
    return k;
  }

  function buildGuiUsedFieldRows(list) {
    var byPath = {};
    list.forEach(function (e) {
      var paths = e.usedResponsePaths || [];
      if (!paths.length) return;
      var kind = fieldHopKind(e);
      if (fieldsCmsOnly && kind !== 'cms') return;
      var summary = (e.method || '?') + ' ' + (e.path || e.url || e.id);
      paths.forEach(function (p) {
        if (!byPath[p]) {
          byPath[p] = { path: p, hops: {}, nodes: {}, kinds: {} };
        }
        byPath[p].hops[e.id] = { id: e.id, summary: summary, kind: kind };
        byPath[p].kinds[kind] = true;
        (e.linkedGuiNodes || []).forEach(function (n) {
          var nk = (n.pageId || '') + '::' + (n.nodeId || '');
          byPath[p].nodes[nk] = n;
        });
      });
    });
    var rows = Object.keys(byPath).map(function (p) { return byPath[p]; });
    rows.sort(function (a, b) { return a.path.localeCompare(b.path); });
    return rows;
  }

  function filterFieldRows(rows) {
    var q = (fieldsSearch || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(function (row) {
      if (String(row.path).toLowerCase().indexOf(q) >= 0) return true;
      var hops = Object.keys(row.hops).map(function (id) { return row.hops[id]; });
      for (var i = 0; i < hops.length; i++) {
        if (String(hops[i].summary).toLowerCase().indexOf(q) >= 0) return true;
        if (String(hops[i].kind).toLowerCase().indexOf(q) >= 0) return true;
      }
      var nodes = Object.keys(row.nodes).map(function (k) { return row.nodes[k]; });
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        var blob = [n.pageId, n.nodeId, n.type, n.label].join(' ').toLowerCase();
        if (blob.indexOf(q) >= 0) return true;
      }
      return false;
    });
  }

  function renderFields(el, uniqueMeta) {
    var base = applyKindFilter(filterEvents());
    var list = uniqueMeta.list;
    var hopsWithPaths = list.filter(function (e) {
      return e.usedResponsePaths && e.usedResponsePaths.length;
    });
    var cmsHopsWithPaths = hopsWithPaths.filter(function (e) { return fieldHopKind(e) === 'cms'; });
    var guiLinkedNoPaths = list.filter(function (e) {
      return e.guiAttribution === 'gui-linked' && !(e.usedResponsePaths && e.usedResponsePaths.length);
    });
    var rows = filterFieldRows(buildGuiUsedFieldRows(list));
    var html = renderListFilters(base, uniqueMeta);
    html += '<h2>GUI-used response fields</h2>';
    html += '<p class="meta">Paths in hop response bodies that match captured CMS/GUI props (value or key). Includes CMS (Oden/deliveryapi) and GraphQL/BFF when linked.</p>';
    html += '<div class="fields-toolbar">';
    html += '<input type="search" data-fields-search placeholder="Filter path, hop, or GUI node…" value="' + esc(fieldsSearch) + '">';
    html += '<div class="seg"><span class="meta">Group</span>';
    html += '<button type="button" class="' + (fieldsGroupBy === 'path' ? 'on' : '') + '" data-fields-group="path">By field</button>';
    html += '<button type="button" class="' + (fieldsGroupBy === 'hop' ? 'on' : '') + '" data-fields-group="hop">By hop</button>';
    html += '<button type="button" class="' + (fieldsGroupBy === 'node' ? 'on' : '') + '" data-fields-group="node">By GUI node</button>';
    html += '</div>';
    html += '<div class="seg">';
    html += '<button type="button" class="' + (fieldsCmsOnly ? 'on' : '') + '" data-fields-cms-only title="Only CMS / deliveryapi hops">CMS only</button>';
    html += '</div></div>';
    html += '<p class="meta">' + hopsWithPaths.length + ' hop(s) with used fields';
    html += ' · ' + cmsHopsWithPaths.length + ' CMS';
    html += ' · ' + rows.length + ' path' + (rows.length === 1 ? '' : 's') + ' shown';
    if (guiLinkedNoPaths.length) {
      html += ' · <span class="badge">' + guiLinkedNoPaths.length + ' GUI-linked without props match</span>';
    }
    html += '</p>';

    if (!rows.length) {
      html += '<p class="empty">No GUI-used fields yet. Capture presentation with shown props, and ensure hops are linked (requestId / oden datasource).</p>';
      el.innerHTML = html;
      focusFieldsSearch(el);
      return;
    }

    if (fieldsGroupBy === 'hop') {
      html += renderFieldsByHop(rows);
    } else if (fieldsGroupBy === 'node') {
      html += renderFieldsByNode(rows);
    } else {
      html += renderFieldsByPath(rows);
    }
    el.innerHTML = html;
    focusFieldsSearch(el);
  }

  function focusFieldsSearch(el) {
    if (!fieldsFocus) return;
    var inp = el.querySelector('[data-fields-search]');
    if (inp) {
      inp.focus();
      try { inp.selectionStart = inp.selectionEnd = inp.value.length; } catch (err) { /* ignore */ }
    }
    fieldsFocus = false;
  }

  function renderFieldsByPath(rows) {
    var html = '<table class="fields-table"><thead><tr>';
    html += '<th>Response path</th><th>Kind</th><th>Hop(s)</th><th>GUI node(s)</th>';
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      var hops = Object.keys(row.hops).map(function (id) { return row.hops[id]; });
      var nodes = Object.keys(row.nodes).map(function (k) { return row.nodes[k]; });
      var kinds = Object.keys(row.kinds).sort();
      var selected = hops.some(function (h) { return h.id === selectedId; });
      html += '<tr class="fields-row' + (selected ? ' selected' : '') + '"' + (hops[0] ? ' data-select="' + esc(hops[0].id) + '"' : '') + '>';
      html += '<td><code class="path">' + esc(row.path) + '</code></td>';
      html += '<td>' + kinds.map(function (k) {
        return '<span class="badge">' + esc((KIND_META[k] && KIND_META[k].label) || k) + '</span>';
      }).join(' ') + '</td>';
      html += '<td><div class="fields-hop-list">' + hops.map(function (h) {
        return '<button type="button" data-select="' + esc(h.id) + '" title="' + esc(h.summary) + '">' + esc(h.summary) + '</button>';
      }).join('') + '</div></td>';
      html += '<td><div class="fields-node-list">' + (nodes.length ? nodes.map(function (n) {
        return '<button type="button" data-select-node="' + esc(n.pageId) + '" data-node-id="' + esc(n.nodeId) + '">' +
          esc(n.label || n.type || n.nodeId) + ' · ' + esc(n.pageId) + '</button>';
      }).join('') : '<span class="meta empty">—</span>') + '</div></td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function renderFieldsByHop(rows) {
    var byHop = {};
    rows.forEach(function (row) {
      Object.keys(row.hops).forEach(function (hid) {
        var h = row.hops[hid];
        if (!byHop[hid]) byHop[hid] = { hop: h, paths: [], nodes: {} };
        byHop[hid].paths.push(row.path);
        Object.keys(row.nodes).forEach(function (nk) {
          byHop[hid].nodes[nk] = row.nodes[nk];
        });
      });
    });
    var groups = Object.keys(byHop).map(function (id) { return byHop[id]; });
    groups.sort(function (a, b) { return a.hop.summary.localeCompare(b.hop.summary); });
    var html = '';
    groups.forEach(function (g) {
      var selected = selectedId === g.hop.id;
      html += '<div class="card">';
      html += '<div class="tree-row map-selectable' + (selected ? ' selected' : '') + '" data-select="' + esc(g.hop.id) + '">';
      html += '<div><strong>' + esc(g.hop.summary) + '</strong> ';
      html += '<span class="badge">' + esc((KIND_META[g.hop.kind] && KIND_META[g.hop.kind].label) || g.hop.kind) + '</span> ';
      html += '<span class="badge">' + g.paths.length + ' field' + (g.paths.length === 1 ? '' : 's') + '</span></div></div>';
      html += '<ul style="margin:0.35rem 0.75rem 0.65rem;padding-left:1.1rem;font-size:0.8rem">';
      g.paths.sort().forEach(function (p) {
        html += '<li><code class="path">' + esc(p) + '</code></li>';
      });
      html += '</ul></div>';
    });
    return html;
  }

  function renderFieldsByNode(rows) {
    var byNode = {};
    rows.forEach(function (row) {
      var nodeKeys = Object.keys(row.nodes);
      if (!nodeKeys.length) {
        var orphan = '__none__';
        if (!byNode[orphan]) byNode[orphan] = { node: null, paths: {}, hops: {} };
        byNode[orphan].paths[row.path] = true;
        Object.keys(row.hops).forEach(function (hid) { byNode[orphan].hops[hid] = row.hops[hid]; });
        return;
      }
      nodeKeys.forEach(function (nk) {
        var n = row.nodes[nk];
        if (!byNode[nk]) byNode[nk] = { node: n, paths: {}, hops: {} };
        byNode[nk].paths[row.path] = true;
        Object.keys(row.hops).forEach(function (hid) { byNode[nk].hops[hid] = row.hops[hid]; });
      });
    });
    var groups = Object.keys(byNode).map(function (k) { return byNode[k]; });
    groups.sort(function (a, b) {
      var al = a.node ? ((a.node.label || a.node.type || '') + a.node.pageId) : '~~~';
      var bl = b.node ? ((b.node.label || b.node.type || '') + b.node.pageId) : '~~~';
      return al.localeCompare(bl);
    });
    var html = '';
    groups.forEach(function (g) {
      var paths = Object.keys(g.paths).sort();
      var hops = Object.keys(g.hops).map(function (id) { return g.hops[id]; });
      html += '<div class="card">';
      if (g.node) {
        html += '<div class="tree-row map-selectable" data-select-node="' + esc(g.node.pageId) + '" data-node-id="' + esc(g.node.nodeId) + '">';
        html += '<div><strong>' + esc(g.node.label || g.node.type || g.node.nodeId) + '</strong> ';
        html += '<span class="badge">' + esc(g.node.pageId) + '</span> ';
        html += '<span class="badge">' + paths.length + ' field' + (paths.length === 1 ? '' : 's') + '</span></div></div>';
      } else {
        html += '<div class="tree-row"><div><strong>Unlinked props match</strong> <span class="badge">' + paths.length + ' fields</span></div></div>';
      }
      html += '<ul style="margin:0.35rem 0.75rem 0.35rem;padding-left:1.1rem;font-size:0.8rem">';
      paths.forEach(function (p) {
        html += '<li><code class="path">' + esc(p) + '</code></li>';
      });
      html += '</ul>';
      if (hops.length) {
        html += '<div class="fields-hop-list" style="padding:0 0.75rem 0.65rem">' + hops.map(function (h) {
          return '<button type="button" data-select="' + esc(h.id) + '">' + esc(h.summary) + '</button>';
        }).join('') + '</div>';
      }
      html += '</div>';
    });
    return html;
  }

  function renderRequests(el, uniqueMeta) {
    var base = applyKindFilter(filterEvents());
    var list = sortRequests(uniqueMeta.list, requestSortKey, requestSortDir);
    var html = renderListFilters(base, uniqueMeta);
    html += renderRequestTable(list);
    el.innerHTML = html;
    if (reqSearchFocus) {
      var inp = el.querySelector('[data-req-search]');
      if (inp) {
        inp.focus();
        try { inp.selectionStart = inp.selectionEnd = inp.value.length; } catch (err) { /* ignore */ }
      }
      reqSearchFocus = false;
    }
  }

  function render() {
    prefetchByHopId = null;
    var uniqueMeta = buildViewList();
    var list = uniqueMeta.list;
    if (!selectedId && !selectedMap && list.length && view !== 'map' && view !== 'architecture' && view !== 'fields') {
      selectedId = list[list.length - 1].id;
    }
    var mapEl = document.getElementById('view-map');
    var traceEl = document.getElementById('view-trace');
    var chainsEl = document.getElementById('view-chains');
    var wfEl = document.getElementById('view-waterfall');
    var ganttEl = document.getElementById('view-gantt');
    var journeyEl = document.getElementById('view-journey');
    var scrubEl = document.getElementById('view-scrub');
    var requestsEl = document.getElementById('view-requests');
    var fieldsEl = document.getElementById('view-fields');
    var detailEl = document.getElementById('hop-detail');
    var layoutEl = document.querySelector('#atlas-app .layout');
    if (layoutEl) {
      layoutEl.classList.toggle('layout-journey', view === 'journey');
      layoutEl.classList.toggle('layout-architecture', view === 'architecture');
    }
    var archEl = document.getElementById('view-architecture');
    if (view === 'architecture') renderArchitecture(archEl);
    if (view === 'map') renderMap(mapEl);
    if (view === 'trace') renderTrace(traceEl, list, uniqueMeta);
    if (view === 'chains') renderChains(chainsEl, applyKindFilter(filterEvents()), uniqueMeta);
    if (view === 'waterfall') renderWaterfall(wfEl, list, uniqueMeta);
    if (view === 'gantt') renderGantt(ganttEl, uniqueMeta);
    if (view === 'journey') renderJourney(journeyEl, uniqueMeta);
    if (view === 'scrub') renderScrub(scrubEl, uniqueMeta);
    if (view === 'requests') renderRequests(requestsEl, uniqueMeta);
    if (view === 'fields') renderFields(fieldsEl, uniqueMeta);
    renderDetail(detailEl);
    document.querySelectorAll('.tabs button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'view-' + view);
    });
  }

  // img onerror does not bubble — capture phase; avoid inline onerror handlers.
  document.getElementById('atlas-app').addEventListener('error', function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute || !t.getAttribute('data-atlas-img')) return;
    t.style.display = 'none';
    var m = t.nextSibling;
    while (m && m.nodeType !== 1) m = m.nextSibling;
    if (m && m.classList && m.classList.contains('atlas-img-missing')) {
      m.hidden = false;
      m.style.display = 'block';
    }
  }, true);

  document.getElementById('atlas-app').addEventListener('click', function (ev) {
    var t = ev.target;
    var copyBtn = t && t.closest && t.closest('[data-copy-body]');
    if (copyBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      var block = copyBtn.closest('.body-block');
      var pre = block && block.querySelector('pre');
      var copyText = pre ? (pre.textContent || '') : '';
      function markCopied() {
        copyBtn.classList.add('copied');
        copyBtn.textContent = 'Copied';
        setTimeout(function () {
          copyBtn.classList.remove('copied');
          copyBtn.textContent = 'Copy';
        }, 1200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyText).then(markCopied).catch(function () {
          /* ignore */
        });
      }
      return;
    }
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
      t.hasAttribute('data-gui-filter') ||
      t.getAttribute('data-req-sort') ||
      t.getAttribute('data-req-clear') ||
      t.getAttribute('data-fields-group') ||
      t.hasAttribute('data-fields-cms-only') ||
      t.getAttribute('data-unique-mode') ||
      t.getAttribute('data-unique-scope') ||
      t.getAttribute('data-unique-keep') ||
      t.getAttribute('data-unique-expand') ||
      t.getAttribute('data-journey-step') ||
      t.getAttribute('data-scrub-play') != null ||
      t.getAttribute('data-scrub-pause') != null
    ))) {
      t = t.parentNode;
    }
    if (!t || t === ev.currentTarget) return;
    if (t.getAttribute('data-scrub-play') != null) {
      startScrubPlayback();
      render();
      return;
    }
    if (t.getAttribute('data-scrub-pause') != null) {
      stopScrubPlayback();
      render();
      return;
    }
    if (t.getAttribute('data-view')) {
      view = t.getAttribute('data-view');
      if (t.getAttribute('data-keep-select')) {
        selectedId = t.getAttribute('data-keep-select');
        selectedMap = null;
      }
      if (view !== 'scrub') stopScrubPlayback();
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
    if (t.hasAttribute('data-gui-filter')) {
      var gf = t.getAttribute('data-gui-filter');
      guiAttributionFilter = gf ? gf : null;
      render();
      return;
    }
    if (t.getAttribute('data-req-sort')) {
      var sk = t.getAttribute('data-req-sort') || 'timestamp';
      if (requestSortKey === sk) {
        requestSortDir = requestSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        requestSortKey = sk;
        requestSortDir = sk === 'timestamp' ? 'desc' : 'asc';
      }
      render();
      return;
    }
    if (t.getAttribute('data-req-clear')) {
      requestSearch = '';
      requestDateFrom = '';
      requestDateTo = '';
      render();
      return;
    }
    if (t.getAttribute('data-fields-group')) {
      fieldsGroupBy = t.getAttribute('data-fields-group') || 'path';
      render();
      return;
    }
    if (t.hasAttribute('data-fields-cms-only')) {
      fieldsCmsOnly = !fieldsCmsOnly;
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

  document.getElementById('atlas-app').addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-req-search') != null) {
      requestSearch = t.value || '';
      reqSearchFocus = true;
      render();
      return;
    }
    if (t.getAttribute('data-fields-search') != null) {
      fieldsSearch = t.value || '';
      fieldsFocus = true;
      render();
      return;
    }
    if (t.getAttribute('data-scrub-ms') != null) {
      var v = Number(t.value);
      scrubPlayheadMs = isFinite(v) ? v : 0;
      scrubFocus = true;
      if (scrubPlaying) stopScrubPlayback();
      render();
    }
  });
  document.getElementById('atlas-app').addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-req-date-from') != null) {
      requestDateFrom = t.value || '';
      render();
      return;
    }
    if (t.getAttribute('data-req-date-to') != null) {
      requestDateTo = t.value || '';
      render();
      return;
    }
    if (t.getAttribute('data-scrub-hide-future') != null) {
      scrubHideFuture = !!t.checked;
      render();
      return;
    }
    if (t.getAttribute('data-toggle-used-fields') != null) {
      highlightUsedFields = !!t.checked;
      render();
      return;
    }
    if (t.getAttribute('data-toggle-dim-unused') != null) {
      dimUnusedFields = !!t.checked;
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
  <p class="meta">Open Architecture / Trace / Waterfall / Journey / Fields tabs below — click hops for request &amp; response bodies.</p>
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
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return undefined;
  }
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
  const guiLinkedRequestIds = buildGuiLinkedRequestIdSet(map);
  const payload: {
    doc: AtlasDocMap;
    events: ReturnType<typeof slimNetworkEvent>[];
    mode?: 'crash';
    crash?: CrashHtmlPayload;
  } = {
    doc: map,
    events: merged.map((ev) => slimNetworkEvent(ev, guiLinkedRequestIds, map)),
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
  <p class="meta">Living architecture doc (unique connections, screenshots, explanations). Session forensics: Map / Trace / Chains / Waterfall / Gantt / Journey / Scrub / Requests / Fields. Click a hop or chain box for bodies (when captureBodies is on).</p>
  <div class="tabs">
    <button type="button" class="active" data-view="architecture">Architecture</button>
    <button type="button" data-view="map">Map</button>
    <button type="button" data-view="trace">Trace</button>
    <button type="button" data-view="chains">Chains</button>
    <button type="button" data-view="waterfall">Waterfall</button>
    <button type="button" data-view="gantt">Gantt</button>
    <button type="button" data-view="journey">Journey</button>
    <button type="button" data-view="scrub">Scrub</button>
    <button type="button" data-view="requests">Requests</button>
    <button type="button" data-view="fields">Fields</button>
  </div>
  <div class="layout layout-architecture">
    <div>
      <div id="view-architecture" class="panel active"></div>
      <div id="view-map" class="panel"></div>
      <div id="view-trace" class="panel"></div>
      <div id="view-chains" class="panel"></div>
      <div id="view-waterfall" class="panel"></div>
      <div id="view-gantt" class="panel"></div>
      <div id="view-journey" class="panel"></div>
      <div id="view-scrub" class="panel"></div>
      <div id="view-requests" class="panel"></div>
      <div id="view-fields" class="panel"></div>
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
 * Build relative path → content map (`index.html`, `pages/<id>.html`, `atlas.har`,
 * `atlas-events.json`, `bodies-search.json`).
 */
export function buildAtlasDocHtmlFiles(
  map: AtlasDocMap,
  networkEvents: readonly NetworkEvent[] = [],
  options?: {
    /** atlas-html root — when set, spilled body files are read into bodies-search.json. */
    bodiesRoot?: string;
  }
): Record<string, string> {
  const pages = Object.values(map.pages).sort((a, b) => a.pageId.localeCompare(b.pageId));
  const events = [...networkEvents];
  const creatorVersion =
    typeof process !== 'undefined' ? process.env.npm_package_version?.trim() : undefined;

  const bodiesRoot = options?.bodiesRoot?.trim();
  const corpus = buildAtlasBodiesSearchCorpus(events, {
    readSpillText:
      bodiesRoot && fs && pathMod
        ? (rel) => {
            try {
              const abs = pathMod!.join(bodiesRoot, rel);
              if (!fs!.existsSync(abs)) return undefined;
              return fs!.readFileSync(abs, 'utf8');
            } catch {
              return undefined;
            }
          }
        : undefined,
  });

  const files: Record<string, string> = {
    'index.html': buildInteractiveIndex(map, events),
    'atlas.har': buildAtlasHarJson(events, {
      scenario: map.scenario,
      creatorVersion: creatorVersion || undefined,
    }),
    'atlas-events.json': `${JSON.stringify(events, null, 2)}\n`,
    'bodies-search.json': `${JSON.stringify(corpus)}\n`,
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
    const files = buildAtlasDocHtmlFiles(map, events, { bodiesRoot: root });
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
