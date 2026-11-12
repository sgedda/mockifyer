import fs from 'fs';
import path from 'path';
import { PAGE_SEO, SITE_URL } from '../frontend/src/lib/seo-config';

// Route priority and change frequency configuration
const ROUTE_CONFIG: Record<string, { priority: string; changefreq: string }> = {
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
  '/guides/react-native-without-msw': { priority: '0.7', changefreq: 'monthly' },
  '/guides/reproduce-tester-bugs': { priority: '0.7', changefreq: 'monthly' },
  '/guides/stable-react-native-e2e': { priority: '0.7', changefreq: 'monthly' },
  '/guides/browser-record-replay': { priority: '0.7', changefreq: 'monthly' },
  '/contact': { priority: '0.5', changefreq: 'yearly' },
};

// Generate routes from PAGE_SEO (single source of truth)
const ROUTES = Object.keys(PAGE_SEO).map((loc) => ({
  loc,
  priority: ROUTE_CONFIG[loc]?.priority || '0.5',
  changefreq: ROUTE_CONFIG[loc]?.changefreq || 'monthly',
}));

function generateSitemap(): string {
  const lastmod = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const urls = ROUTES.map(
    (route) => `  <url>
    <loc>${SITE_URL}${route.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function writeSitemap() {
  const sitemap = generateSitemap();
  const outputPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, sitemap, 'utf-8');
  console.log(`✓ Sitemap generated: ${outputPath}`);
}

if (require.main === module) {
  writeSitemap();
}

export { generateSitemap, writeSitemap };
