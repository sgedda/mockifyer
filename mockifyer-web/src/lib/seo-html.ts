/**
 * Serve-time SEO HTML helpers.
 * Prefer prerendered files under public/; fall back to injecting into _shell.html
 * from seo-manifest.json so Railway still serves unique head/body if prerender
 * output is missing.
 */

import fs from 'fs';
import path from 'path';

export interface SeoRouteConfig {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}

interface SeoManifest {
  siteUrl: string;
  routes: Record<string, SeoRouteConfig>;
}

const PUBLIC_DIR = path.join(__dirname, '../../public');
const HOMEPAGE_CANONICAL_SUFFIX = '/';

let cachedShell: string | null = null;
let cachedManifest: SeoManifest | null = null;

/** Test helper — drop in-memory caches after writing public/ fixtures. */
export function clearSeoHtmlCache(): void {
  cachedShell = null;
  cachedManifest = null;
}

function readPublicFile(relativePath: string): string | null {
  const fullPath = path.join(PUBLIC_DIR, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

export function getPublicDir(): string {
  return PUBLIC_DIR;
}

export function getHtmlRoutes(): string[] {
  const manifest = loadSeoManifest();
  if (!manifest) {
    return [];
  }
  return Object.keys(manifest.routes).filter((route) => route !== '/404');
}

export function loadSeoManifest(): SeoManifest | null {
  if (cachedManifest) {
    return cachedManifest;
  }
  const raw = readPublicFile('seo-manifest.json');
  if (!raw) {
    return null;
  }
  try {
    cachedManifest = JSON.parse(raw) as SeoManifest;
    return cachedManifest;
  } catch {
    return null;
  }
}

export function loadShellHtml(): string | null {
  if (cachedShell) {
    return cachedShell;
  }
  const shell = readPublicFile('_shell.html');
  if (shell) {
    cachedShell = shell;
    return cachedShell;
  }
  const indexHtml = readPublicFile('index.html');
  if (!indexHtml) {
    return null;
  }
  cachedShell = indexHtml.replace(/<div id="root">[\s\S]*?<\/div>/, '<div id="root"></div>');
  return cachedShell;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

/**
 * Inject route SEO into an SPA shell (same transforms as scripts/prerender-static).
 */
export function injectSeoHtml(
  routePath: string,
  seoConfig: SeoRouteConfig,
  baseHtml: string,
  siteUrl: string
): string {
  const title = seoConfig.title;
  const canonical =
    routePath === '/' || routePath === '/404'
      ? `${siteUrl}${routePath === '/' ? HOMEPAGE_CANONICAL_SUFFIX : routePath}`
      : `${siteUrl}${routePath}`;

  let html = baseHtml.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`);

  html = html.replace(
    /<meta name="description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta name="description" content="${escapeAttr(seoConfig.description)}" />`
  );

  const robotsContent = seoConfig.noIndex ? 'noindex, nofollow' : 'index, follow';
  html = html.replace(
    /<meta name="robots" content=".*?"(\s*\/)?>/,
    `<meta name="robots" content="${robotsContent}" />`
  );

  html = html.replace(
    /<link rel="canonical" href=".*?"(\s*\/)?>/,
    `<link rel="canonical" href="${canonical}" />`
  );

  html = html.replace(
    /<meta property="og:title" content=".*?"(\s*\/)?>/,
    `<meta property="og:title" content="${escapeAttr(title)}" />`
  );
  html = html.replace(
    /<meta property="og:description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta property="og:description" content="${escapeAttr(seoConfig.description)}" />`
  );
  html = html.replace(
    /<meta property="og:url" content=".*?"(\s*\/)?>/,
    `<meta property="og:url" content="${canonical}" />`
  );

  html = html.replace(
    /<meta name="twitter:title" content=".*?"(\s*\/)?>/,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`
  );
  html = html.replace(
    /<meta name="twitter:description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${escapeAttr(seoConfig.description)}" />`
  );

  if (routePath !== '/') {
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
  }

  const h1Text = title
    .replace(/ \| Mockifyer$/, '')
    .replace(' - Testing Guide', '')
    .replace(' - ', ': ');

  const seoContent = `<div id="root"><div style="max-width:1200px;margin:0 auto;padding:2rem"><h1>${escapeHtml(h1Text)}</h1><p>${escapeHtml(seoConfig.description)}</p><noscript><p>This site requires JavaScript to be enabled.</p></noscript></div></div>`;
  html = html.replace(/<div id="root"><\/div>/, seoContent);

  return html;
}

export function resolvePrerenderedHtmlPath(routePath: string): string | null {
  if (routePath === '/') {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    return fs.existsSync(indexPath) ? indexPath : null;
  }
  const htmlPath = path.join(PUBLIC_DIR, `${routePath.replace(/^\//, '')}.html`);
  return fs.existsSync(htmlPath) ? htmlPath : null;
}

/**
 * Build HTML for a route: prerendered file if present, otherwise shell + manifest injection.
 */
export function buildHtmlForRoute(routePath: string): { html: string; status: number } | null {
  const prerenderedPath = resolvePrerenderedHtmlPath(routePath);
  if (prerenderedPath) {
    return { html: fs.readFileSync(prerenderedPath, 'utf-8'), status: 200 };
  }

  const manifest = loadSeoManifest();
  const shell = loadShellHtml();
  const seo = manifest?.routes[routePath];
  if (!manifest || !shell || !seo) {
    return null;
  }

  return {
    html: injectSeoHtml(routePath, seo, shell, manifest.siteUrl),
    status: 200,
  };
}

export function buildNotFoundHtml(): string {
  const notFoundPath = path.join(PUBLIC_DIR, '404.html');
  if (fs.existsSync(notFoundPath)) {
    return fs.readFileSync(notFoundPath, 'utf-8');
  }

  const manifest = loadSeoManifest();
  const shell = loadShellHtml();
  const seo = manifest?.routes['/404'] ?? {
    title: 'Page Not Found | Mockifyer',
    description: 'The page you are looking for does not exist.',
    path: '/404',
    noIndex: true,
  };

  if (shell) {
    return injectSeoHtml('/404', seo, shell, manifest?.siteUrl ?? 'https://mockifyer.dev');
  }

  // Last resort minimal document — still must not look like the homepage
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Page Not Found | Mockifyer</title>
  <meta name="description" content="The page you are looking for does not exist." />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="canonical" href="https://mockifyer.dev/404" />
</head>
<body>
  <h1>Page Not Found</h1>
  <p>The page you are looking for does not exist.</p>
</body>
</html>`;
}
