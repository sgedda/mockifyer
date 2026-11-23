#!/usr/bin/env ts-node
/**
 * Static HTML generator for SEO — no browser/Chromium required.
 * Runs during CI and Railway builds to create per-route HTML files.
 */

import fs from 'fs';
import path from 'path';
import {
  PAGE_SEO,
  SITE_URL,
  SITE_NAME,
  formatPageTitle,
  type PageSeoConfig,
} from '../frontend/src/lib/seo-config';
import {
  getPrerenderBodyContent,
  getRouteJsonLd,
  renderPrerenderBodyHtml,
} from '../frontend/src/lib/prerender-content';

export interface SeoManifestEntry {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  bodyHtml?: string;
  jsonLd?: Record<string, unknown>;
}

export const NOT_FOUND_SEO: PageSeoConfig = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
  path: '/404',
  noIndex: true,
};

const HOMEPAGE_CANONICAL = `${SITE_URL}/`;

/**
 * Normalize SPA shell so prerender is idempotent even if index.html was
 * already rewritten by a previous prerender (e.g. spa-railway-upload tarball).
 */
export function normalizeShellHtml(html: string): string {
  return html.replace(/<div id="root">[\s\S]*?<\/div>/, '<div id="root"></div>');
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

function buildRootInnerHtml(routePath: string, seoConfig: PageSeoConfig): string {
  const fullBody = getPrerenderBodyContent(routePath);
  if (fullBody) {
    return renderPrerenderBodyHtml(fullBody);
  }

  const h1Text = seoConfig.title
    .replace(` | ${SITE_NAME}`, '')
    .replace(' - Testing Guide', '')
    .replace(' - ', ': ');

  return `<div style="max-width:1200px;margin:0 auto;padding:2rem"><h1>${escapeHtml(h1Text)}</h1><p>${escapeHtml(seoConfig.description)}</p><noscript><p>This site requires JavaScript to be enabled.</p></noscript></div>`;
}

/**
 * Inject per-route SEO head tags and visible body into the SPA shell.
 */
export function generateHtml(
  routePath: string,
  seoConfig: PageSeoConfig,
  baseHtml: string
): string {
  const title = formatPageTitle(seoConfig.title);
  const isNotFound = Boolean(seoConfig.noIndex) || routePath === '/404';
  const canonical =
    routePath === '/' ? HOMEPAGE_CANONICAL : `${SITE_URL}${routePath}`;

  let html = baseHtml.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`);

  html = html.replace(
    /<meta name="description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta name="description" content="${escapeAttr(seoConfig.description)}" />`
  );

  const robotsContent = isNotFound ? 'noindex, nofollow' : 'index, follow';
  html = html.replace(
    /<meta name="robots" content=".*?"(\s*\/)?>/,
    `<meta name="robots" content="${robotsContent}" />`
  );

  if (isNotFound) {
    html = html.replace(/<link rel="canonical" href=".*?"(\s*\/)?>\s*/i, '');
    html = html.replace(/<meta property="og:url" content=".*?"(\s*\/)?>\s*/i, '');
  } else {
    html = html.replace(
      /<link rel="canonical" href=".*?"(\s*\/)?>/,
      `<link rel="canonical" href="${canonical}" />`
    );
    html = html.replace(
      /<meta property="og:url" content=".*?"(\s*\/)?>/,
      `<meta property="og:url" content="${canonical}" />`
    );
  }

  html = html.replace(
    /<meta property="og:title" content=".*?"(\s*\/)?>/,
    `<meta property="og:title" content="${escapeAttr(title)}" />`
  );
  html = html.replace(
    /<meta property="og:description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta property="og:description" content="${escapeAttr(seoConfig.description)}" />`
  );

  html = html.replace(
    /<meta name="twitter:title" content=".*?"(\s*\/)?>/,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`
  );
  html = html.replace(
    /<meta name="twitter:description"[\s\S]*?content=".*?"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${escapeAttr(seoConfig.description)}" />`
  );

  // Homepage keeps SoftwareApplication JSON-LD; other routes replace or strip it
  const routeJsonLd = getRouteJsonLd(routePath);
  if (routePath === '/') {
    // keep shell SoftwareApplication
  } else if (routeJsonLd) {
    html = html.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${JSON.stringify(routeJsonLd)}</script>`
    );
  } else {
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
  }

  const seoContent = `<div id="root">${buildRootInnerHtml(routePath, seoConfig)}</div>`;
  html = html.replace(/<div id="root"><\/div>/, seoContent);

  return html;
}

function writeRouteHtml(publicDir: string, routePath: string, html: string): string {
  if (routePath === '/') {
    const indexPath = path.join(publicDir, 'index.html');
    fs.writeFileSync(indexPath, html, 'utf-8');
    return 'index.html';
  }

  const routePathClean = routePath.replace(/^\//, '');
  const routeDir = path.dirname(routePathClean);
  if (routeDir && routeDir !== '.') {
    fs.mkdirSync(path.join(publicDir, routeDir), { recursive: true });
  }
  const relativePath = `${routePathClean}.html`;
  fs.writeFileSync(path.join(publicDir, relativePath), html, 'utf-8');
  return relativePath;
}

async function prerender(): Promise<void> {
  const publicDir = path.join(__dirname, '../public');
  const indexPath = path.join(publicDir, 'index.html');

  if (!fs.existsSync(indexPath)) {
    console.error('❌ public/index.html not found. Run frontend build first.');
    process.exit(1);
  }

  console.log('📄 Starting static HTML generation for SEO...');
  const shellHtml = normalizeShellHtml(fs.readFileSync(indexPath, 'utf-8'));
  fs.writeFileSync(path.join(publicDir, '_shell.html'), shellHtml, 'utf-8');

  const manifest: Record<string, SeoManifestEntry> = {};
  let count = 0;

  for (const [routePath, seoConfig] of Object.entries(PAGE_SEO)) {
    // Static Atlas HTML ships under frontend/public/atlas/ — do not overwrite with SPA shell.
    if (routePath.startsWith('/atlas/')) {
      const staticIndex = path.join(publicDir, routePath.replace(/^\//, ''), 'index.html');
      if (!fs.existsSync(staticIndex)) {
        console.warn(`  ⚠ ${routePath} listed in PAGE_SEO but ${staticIndex} is missing`);
      } else {
        console.log(`  ✓ ${routePath} → atlas static asset (skipped SPA prerender)`);
      }
      manifest[routePath] = {
        title: formatPageTitle(seoConfig.title),
        description: seoConfig.description,
        path: routePath,
        noIndex: seoConfig.noIndex,
      };
      count++;
      continue;
    }

    const generatedHtml = generateHtml(routePath, seoConfig, shellHtml);
    const relativePath = writeRouteHtml(publicDir, routePath, generatedHtml);
    const bodyContent = getPrerenderBodyContent(routePath);
    const jsonLd = getRouteJsonLd(routePath);
    manifest[routePath] = {
      title: formatPageTitle(seoConfig.title),
      description: seoConfig.description,
      path: routePath,
      noIndex: seoConfig.noIndex,
      bodyHtml: bodyContent ? renderPrerenderBodyHtml(bodyContent) : undefined,
      jsonLd: jsonLd ?? undefined,
    };
    console.log(`  ✓ ${routePath} → ${relativePath}`);
    count++;
  }

  const notFoundHtml = generateHtml('/404', NOT_FOUND_SEO, shellHtml);
  fs.writeFileSync(path.join(publicDir, '404.html'), notFoundHtml, 'utf-8');
  manifest['/404'] = {
    title: formatPageTitle(NOT_FOUND_SEO.title),
    description: NOT_FOUND_SEO.description,
    path: '/404',
    noIndex: true,
  };
  console.log('  ✓ /404 → 404.html');
  count++;

  fs.writeFileSync(
    path.join(publicDir, 'seo-manifest.json'),
    JSON.stringify({ siteUrl: SITE_URL, routes: manifest }, null, 2),
    'utf-8'
  );

  console.log(`\n✅ Generated ${count} static HTML files for SEO`);
}

if (require.main === module) {
  prerender().catch((error) => {
    console.error('❌ Static HTML generation failed:', error);
    process.exit(1);
  });
}

export { prerender, PAGE_SEO, SITE_URL, SITE_NAME, formatPageTitle, HOMEPAGE_CANONICAL };
