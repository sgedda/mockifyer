import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://mockifyer.dev';

// All HTML routes that should be in the sitemap
const ROUTES = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/getting-started', priority: '0.9', changefreq: 'monthly' },
  { loc: '/features', priority: '0.8', changefreq: 'monthly' },
  { loc: '/faq', priority: '0.8', changefreq: 'monthly' },
  { loc: '/packages', priority: '0.8', changefreq: 'monthly' },
  { loc: '/dashboard', priority: '0.8', changefreq: 'monthly' },
  { loc: '/e2e-tutorial', priority: '0.8', changefreq: 'monthly' },
  { loc: '/comparisons', priority: '0.7', changefreq: 'monthly' },
  { loc: '/config-reference', priority: '0.7', changefreq: 'monthly' },
  { loc: '/date-config', priority: '0.7', changefreq: 'monthly' },
  { loc: '/guides/mock-at-the-network-edge', priority: '0.7', changefreq: 'monthly' },
  { loc: '/guides/mock-drift', priority: '0.7', changefreq: 'monthly' },
  { loc: '/guides/react-native-without-msw', priority: '0.7', changefreq: 'monthly' },
  { loc: '/guides/reproduce-tester-bugs', priority: '0.7', changefreq: 'monthly' },
  { loc: '/guides/stable-react-native-e2e', priority: '0.7', changefreq: 'monthly' },
  { loc: '/contact', priority: '0.5', changefreq: 'yearly' },
];

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
