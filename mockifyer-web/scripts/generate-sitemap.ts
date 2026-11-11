import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = 'https://mockifyer.dev';

// Core routes (non-content pages)
const CORE_ROUTES = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/getting-started', priority: '0.9', changefreq: 'monthly' },
  { loc: '/features', priority: '0.8', changefreq: 'monthly' },
  { loc: '/faq', priority: '0.8', changefreq: 'monthly' },
  { loc: '/packages', priority: '0.8', changefreq: 'monthly' },
  { loc: '/dashboard', priority: '0.8', changefreq: 'monthly' },
  { loc: '/e2e-tutorial', priority: '0.8', changefreq: 'monthly' },
  { loc: '/comparisons', priority: '0.7', changefreq: 'monthly' },
  { loc: '/guides', priority: '0.7', changefreq: 'monthly' },
  { loc: '/config-reference', priority: '0.7', changefreq: 'monthly' },
  { loc: '/date-config', priority: '0.7', changefreq: 'monthly' },
  { loc: '/contact', priority: '0.5', changefreq: 'yearly' },
];

async function getContentRoutes() {
  try {
    const { getAllExistingContent } = await import('../frontend/src/lib/content-registry.js');
    const contentPages = getAllExistingContent();
    return contentPages.map((item) => ({
      loc: item.path,
      priority: String(item.priority || 0.7),
      changefreq: item.changefreq || 'monthly',
    }));
  } catch (e) {
    console.warn('Could not load content registry, using core routes only');
    return [];
  }
}

function generateSitemap(routes: typeof CORE_ROUTES): string {
  const lastmod = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const urls = routes.map(
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

async function writeSitemap() {
  const contentRoutes = await getContentRoutes();
  const allRoutes = [...CORE_ROUTES, ...contentRoutes];
  const sitemap = generateSitemap(allRoutes);
  const outputPath = path.join(__dirname, '../frontend/public/sitemap.xml');
  fs.writeFileSync(outputPath, sitemap, 'utf-8');
  console.log(`✓ Sitemap generated: ${outputPath}`);
}

writeSitemap().catch((error) => {
  console.error('Failed to generate sitemap:', error);
  process.exit(1);
});

export { generateSitemap, writeSitemap };
