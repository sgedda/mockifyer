#!/usr/bin/env ts-node
/**
 * Generate public/sitemap.xml from PAGE_SEO + static content URLs.
 * lastmod uses the build date (when this script runs).
 */

import fs from 'fs';
import path from 'path';
import { PAGE_SEO, SITE_URL } from '../frontend/src/lib/seo-config';

interface RouteMeta {
  priority: string;
  changefreq: string;
}

const ROUTE_CONFIG: Record<string, RouteMeta> = {
  '/': { priority: '1.0', changefreq: 'weekly' },
  '/getting-started': { priority: '0.9', changefreq: 'monthly' },
  '/features': { priority: '0.8', changefreq: 'monthly' },
  '/faq': { priority: '0.8', changefreq: 'monthly' },
  '/packages': { priority: '0.8', changefreq: 'monthly' },
  '/dashboard': { priority: '0.8', changefreq: 'monthly' },
  '/e2e-tutorial': { priority: '0.8', changefreq: 'monthly' },
  '/comparisons': { priority: '0.7', changefreq: 'monthly' },
  '/config-reference': { priority: '0.7', changefreq: 'monthly' },
  '/date-config': { priority: '0.7', changefreq: 'monthly' },
  '/guides/mock-at-the-network-edge': { priority: '0.7', changefreq: 'monthly' },
  '/guides/mock-drift': { priority: '0.7', changefreq: 'monthly' },
  '/guides/mockifyer-atlas': { priority: '0.7', changefreq: 'monthly' },
  '/guides/react-native-without-msw': { priority: '0.7', changefreq: 'monthly' },
  '/guides/reproduce-tester-bugs': { priority: '0.7', changefreq: 'monthly' },
  '/guides/stable-react-native-e2e': { priority: '0.7', changefreq: 'monthly' },
  '/guides/browser-record-replay': { priority: '0.7', changefreq: 'monthly' },
  '/contact': { priority: '0.5', changefreq: 'yearly' },
};

/** Non-HTML content URLs that should stay in the sitemap. */
const STATIC_CONTENT_ROUTES: Array<{ loc: string } & RouteMeta> = [
  { loc: '/getting-started.md', priority: '0.6', changefreq: 'monthly' },
  { loc: '/overview.md', priority: '0.6', changefreq: 'monthly' },
  { loc: '/config-reference.md', priority: '0.6', changefreq: 'monthly' },
  { loc: '/llms.txt', priority: '0.6', changefreq: 'monthly' },
  { loc: '/llms-full.txt', priority: '0.6', changefreq: 'monthly' },
];

function fileLastmod(publicDir: string, loc: string): string | null {
  const candidates =
    loc === '/'
      ? [path.join(publicDir, 'index.html')]
      : [
          path.join(publicDir, `${loc.replace(/^\//, '')}.html`),
          path.join(publicDir, loc.replace(/^\//, '')),
        ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.statSync(candidate).mtime.toISOString().split('T')[0];
    }
  }
  return null;
}

function generateSitemap(publicDir: string = path.join(__dirname, '../public')): string {
  const buildDate = new Date().toISOString().split('T')[0];

  const htmlRoutes = Object.keys(PAGE_SEO).map((loc) => ({
    loc,
    priority: ROUTE_CONFIG[loc]?.priority || '0.5',
    changefreq: ROUTE_CONFIG[loc]?.changefreq || 'monthly',
    lastmod: fileLastmod(publicDir, loc) || buildDate,
  }));

  const staticRoutes = STATIC_CONTENT_ROUTES.map((route) => ({
    ...route,
    lastmod: fileLastmod(publicDir, route.loc) || buildDate,
  }));

  const routes = [...htmlRoutes, ...staticRoutes];

  const urls = routes
    .map(
      (route) => `  <url>
    <loc>${SITE_URL}${route.loc === '/' ? '/' : route.loc}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function writeSitemap(): void {
  const publicDir = path.join(__dirname, '../public');
  fs.mkdirSync(publicDir, { recursive: true });
  const sitemap = generateSitemap(publicDir);
  const outputPath = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(outputPath, sitemap, 'utf-8');

  // Keep frontend/public in sync for local vite builds that copy it before generate runs
  const frontendPublic = path.join(__dirname, '../frontend/public/sitemap.xml');
  if (fs.existsSync(path.dirname(frontendPublic))) {
    fs.writeFileSync(frontendPublic, sitemap, 'utf-8');
  }

  console.log(`✓ Sitemap generated: ${outputPath}`);
}

if (require.main === module) {
  writeSitemap();
}

export { generateSitemap, writeSitemap };
