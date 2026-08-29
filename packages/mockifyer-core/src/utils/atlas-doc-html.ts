/**
 * Self-contained Atlas auto-doc HTML for local browsing (file:// / VS Code).
 * Written on Node capture upserts when {@link setAtlasDocHtmlOutputPath} is set.
 * Safe on React Native: `fs`/`path` require is try/caught; writes no-op.
 */

import type { AtlasDocMap, AtlasDocNode, AtlasDocPage, AtlasDocPrefetch, AtlasDocScreen } from './atlas-doc';

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

/** Directory for generated `index.html` + `pages/*.html` (Node only). */
let htmlOutputPath: string | undefined;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingMap: AtlasDocMap | null = null;

export function setAtlasDocHtmlOutputPath(dir: string | undefined): void {
  const trimmed = dir?.trim();
  htmlOutputPath = trimmed || undefined;
}

export function getAtlasDocHtmlOutputPath(): string | undefined {
  return htmlOutputPath;
}

/** Cancel pending debounced write (tests / reset). */
export function resetAtlasDocHtmlRuntime(): void {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingMap = null;
  htmlOutputPath = undefined;
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
:root { color-scheme: light; --bg: #f7f7f5; --fg: #1a1a1a; --muted: #5c5c5c; --border: #d8d8d4; --accent: #0b5fff; --card: #fff; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.45; }
header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); background: var(--card); }
header h1 { margin: 0 0 0.25rem; font-size: 1.35rem; }
header p { margin: 0; color: var(--muted); font-size: 0.9rem; }
main { padding: 1.25rem 1.5rem 2.5rem; max-width: 960px; }
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
`.trim();
}

function shell(title: string, body: string, crumb?: string): string {
  const crumbHtml = crumb
    ? `<nav class="crumb">${crumb}</nav>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${sharedCss()}
</style>
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
  const nodes = Object.values(page.nodes).sort((a, b) => a.path.localeCompare(b.path) || a.nodeId.localeCompare(b.nodeId));
  const slug = page.pageSlug ? ` · slug <code>${escapeHtml(page.pageSlug)}</code>` : '';
  const nodesHtml =
    nodes.length === 0
      ? `<p class="empty">No nodes yet</p>`
      : nodes.map(renderNode).join('\n');
  return `<p class="meta">pageId <code>${escapeHtml(page.pageId)}</code>${slug} · lastSeenAt ${escapeHtml(page.lastSeenAt)}</p>
${nodesHtml}`;
}

function renderScreens(screens: Record<string, AtlasDocScreen>): string {
  const list = Object.values(screens).sort((a, b) => a.screen.localeCompare(b.screen));
  if (list.length === 0) return `<p class="empty">No screens yet</p>`;
  return `<ul>${list
    .map((s) => {
      const comps = s.components.map(escapeHtml).join(', ') || '—';
      const ds = s.datasourceIds.map(escapeHtml).join(', ') || '—';
      return `<li><strong>${escapeHtml(s.screen)}</strong> <span class="meta">(${escapeHtml(s.lastSeenAt)})</span><br/>components: ${comps}<br/>datasources: ${ds}</li>`;
    })
    .join('')}</ul>`;
}

function renderPrefetches(prefetches: Record<string, AtlasDocPrefetch>): string {
  const list = Object.values(prefetches).sort((a, b) => a.datasourceId.localeCompare(b.datasourceId));
  if (list.length === 0) return `<p class="empty">No prefetches yet</p>`;
  return `<ul>${list
    .map((p) => {
      const kind = p.kind ? ` <span class="badge">${escapeHtml(p.kind)}</span>` : '';
      const ops = p.operations.map(escapeHtml).join(', ') || '—';
      const phases = p.phases.map(escapeHtml).join(', ') || '—';
      const req = p.lastRequestId
        ? ` · lastRequestId <code>${escapeHtml(p.lastRequestId)}</code>`
        : '';
      return `<li><code>${escapeHtml(p.datasourceId)}</code>${kind}<br/>ops: ${ops} · phases: ${phases}${req}</li>`;
    })
    .join('')}</ul>`;
}

/**
 * Build relative path → HTML content map (`index.html`, `pages/<id>.html`).
 */
export function buildAtlasDocHtmlFiles(map: AtlasDocMap): Record<string, string> {
  const pages = Object.values(map.pages).sort((a, b) => a.pageId.localeCompare(b.pageId));
  const pageLinks =
    pages.length === 0
      ? `<p class="empty">No pages yet — capture CMS presentations while the app runs.</p>`
      : `<ul>${pages
          .map((p) => {
            const file = `pages/${safeAtlasPageFileId(p.pageId)}.html`;
            const title = p.pageSlug || p.pageId;
            const nodeCount = Object.keys(p.nodes).length;
            return `<li><a href="${escapeHtml(file)}">${escapeHtml(title)}</a> <span class="meta">(${nodeCount} nodes · ${escapeHtml(p.lastSeenAt)})</span></li>`;
          })
          .join('')}</ul>`;

  const indexBody = `<p class="meta">scenario <code>${escapeHtml(map.scenario)}</code> · updatedAt ${escapeHtml(map.updatedAt)}</p>
<h2>Pages</h2>
${pageLinks}
<h2>Screens</h2>
${renderScreens(map.screens)}
<h2>Prefetches</h2>
${renderPrefetches(map.prefetches)}`;

  const files: Record<string, string> = {
    'index.html': shell(`Atlas — ${map.scenario}`, indexBody),
  };

  for (const page of pages) {
    const fileId = safeAtlasPageFileId(page.pageId);
    const title = page.pageSlug || page.pageId;
    files[`pages/${fileId}.html`] = shell(`Atlas page — ${title}`, renderPageBody(page), `<a href="../index.html">← Overview</a>`);
  }

  return files;
}

/**
 * Synchronously write HTML files under `dir`. No-op when Node `fs` is unavailable.
 * @returns number of files written, or 0 on no-op / failure
 */
export function writeAtlasDocHtml(dir: string, map: AtlasDocMap): number {
  if (!fs || !pathMod) return 0;
  const root = dir.trim();
  if (!root) return 0;

  try {
    const files = buildAtlasDocHtmlFiles(map);
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
    // Observability must not break the app
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
      writeAtlasDocHtml(htmlOutputPath.trim(), snapshot);
    }
  }, HTML_WRITE_DEBOUNCE_MS);

  // Allow process exit in Node without waiting for the timer when tests end quickly.
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
    writeAtlasDocHtml(dir, snapshot);
  }
}
