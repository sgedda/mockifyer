import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../index';
import {
  buildNotFoundHtml,
  clearSeoHtmlCache,
  injectSeoHtml,
  loadShellHtml,
} from '../lib/seo-html';

const PUBLIC_DIR = path.join(__dirname, '../../public');
const SITE_URL = 'https://mockifyer.dev';
const BACKUP_DIR = path.join(__dirname, '../../.test-public-backup');

const SAMPLE_ROUTES = [
  '/',
  '/getting-started',
  '/guides',
  '/guides/mock-drift',
  '/guides/stable-react-native-e2e',
  '/guides/streaming',
  '/faq',
  '/comparisons',
  '/features',
];

const CONTENT_ROUTES = [
  '/guides',
  '/guides/mock-drift',
  '/guides/streaming',
  '/faq',
  '/comparisons',
  '/getting-started',
  '/e2e-tutorial',
];

function pathExists(relativePath: string): boolean {
  return fs.existsSync(path.join(PUBLIC_DIR, relativePath));
}

function hasCompletePrerender(): boolean {
  return (
    pathExists('index.html') &&
    pathExists('guides.html') &&
    pathExists('guides/mock-drift.html') &&
    pathExists('404.html') &&
    pathExists('seo-manifest.json')
  );
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function ensureMinimalPublicAssets(): void {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(path.join(PUBLIC_DIR, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(PUBLIC_DIR, 'guides'), { recursive: true });

  const shell = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mockifyer — Record &amp; Replay HTTP API Mocks</title>
  <meta name="description" content="Homepage description" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://mockifyer.dev/" />
  <meta property="og:title" content="Mockifyer — Record &amp; Replay HTTP API Mocks" />
  <meta property="og:description" content="Homepage description" />
  <meta property="og:url" content="https://mockifyer.dev/" />
  <meta name="twitter:title" content="Mockifyer — Record &amp; Replay HTTP API Mocks" />
  <meta name="twitter:description" content="Homepage description" />
  <script type="application/ld+json">{"@type":"SoftwareApplication"}</script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

  fs.writeFileSync(path.join(PUBLIC_DIR, '_shell.html'), shell, 'utf-8');

  const guideBody = `<article><h1>Catch API Drift Before Production</h1><p>${'word '.repeat(90).trim()}</p><nav><ul><li><a href="/guides">All Guides</a></li><li><a href="/getting-started">Getting Started</a></li><li><a href="/faq">FAQ</a></li></ul></nav></article>`;
  const guidesHubBody = `<article><h1>Mockifyer Guides</h1><p>${'guide '.repeat(90).trim()}</p><nav><ul><li><a href="/guides/mock-drift">Mock Drift</a></li><li><a href="/getting-started">Getting Started</a></li><li><a href="/faq">FAQ</a></li></ul></nav></article>`;
  const faqBody = `<article><h1>Frequently Asked Questions</h1><p>${'faq '.repeat(90).trim()}</p><nav><ul><li><a href="/">Home</a></li><li><a href="/getting-started">Getting Started</a></li><li><a href="/guides">Guides</a></li></ul></nav></article>`;
  const comparisonsBody = `<article><h1>Mockifyer vs MSW</h1><p>${'compare '.repeat(90).trim()}</p><nav><ul><li><a href="/">Home</a></li><li><a href="/guides">Guides</a></li><li><a href="/faq">FAQ</a></li></ul></nav></article>`;
  const gettingStartedBody = `<article><h1>Getting Started</h1><p>${'start '.repeat(90).trim()}</p><nav><ul><li><a href="/">Home</a></li><li><a href="/guides">Guides</a></li><li><a href="/faq">FAQ</a></li></ul></nav></article>`;
  const e2eBody = `<article><h1>E2E Tutorial</h1><p>${'e2e '.repeat(90).trim()}</p><nav><ul><li><a href="/">Home</a></li><li><a href="/guides">Guides</a></li><li><a href="/dashboard">Dashboard</a></li></ul></nav></article>`;

  const routes: Record<
    string,
    {
      title: string;
      description: string;
      path: string;
      noIndex?: boolean;
      bodyHtml?: string;
      jsonLd?: Record<string, unknown>;
    }
  > = {
    '/': {
      title: 'Mockifyer — Record & Replay HTTP API Mocks',
      description: 'Homepage description for tests',
      path: '/',
    },
    '/getting-started': {
      title: 'Getting Started with Mockifyer',
      description: 'Getting started description for tests',
      path: '/getting-started',
      bodyHtml: gettingStartedBody,
    },
    '/guides': {
      title: 'Mockifyer Guides',
      description: 'Guides hub description for tests',
      path: '/guides',
      bodyHtml: guidesHubBody,
    },
    '/guides/mock-drift': {
      title: 'Stop Hand-Written API Mocks from Drifting | Mockifyer',
      description: 'Mock drift guide description for tests',
      path: '/guides/mock-drift',
      bodyHtml: guideBody,
      jsonLd: { '@type': 'TechArticle', headline: 'Mock Drift' },
    },
    '/guides/stable-react-native-e2e': {
      title: 'Stable React Native E2E: Detox & Maestro | Mockifyer',
      description: 'RN E2E guide description for tests',
      path: '/guides/stable-react-native-e2e',
      bodyHtml: guideBody,
      jsonLd: { '@type': 'TechArticle', headline: 'Stable RN E2E' },
    },
    '/guides/streaming': {
      title: 'Mocking SSE and Streaming APIs with Mockifyer',
      description: 'Streaming guide description for tests',
      path: '/guides/streaming',
      bodyHtml: guideBody,
      jsonLd: { '@type': 'TechArticle', headline: 'Streaming SSE' },
    },
    '/faq': {
      title: 'Mockifyer FAQ: Record-Replay API Mocks',
      description: 'FAQ description for tests',
      path: '/faq',
      bodyHtml: faqBody,
      jsonLd: { '@type': 'FAQPage', mainEntity: [] },
    },
    '/comparisons': {
      title: 'Mockifyer vs MSW, Polly.js, and Nock',
      description: 'Comparisons description for tests',
      path: '/comparisons',
      bodyHtml: comparisonsBody,
    },
    '/e2e-tutorial': {
      title: 'E2E Tutorial: Multi-Service Mocks | Mockifyer',
      description: 'E2E tutorial description for tests',
      path: '/e2e-tutorial',
      bodyHtml: e2eBody,
    },
    '/features': {
      title: 'Mockifyer Features: Record, Replay, Scenarios',
      description: 'Features description for tests',
      path: '/features',
    },
    '/404': {
      title: 'Page Not Found | Mockifyer',
      description: 'The page you are looking for does not exist.',
      path: '/404',
      noIndex: true,
    },
  };

  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'seo-manifest.json'),
    JSON.stringify({ siteUrl: SITE_URL, routes }, null, 2),
    'utf-8'
  );

  for (const [routePath, seo] of Object.entries(routes)) {
    const html = injectSeoHtml(routePath, seo, shell, SITE_URL);
    if (routePath === '/') {
      fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html, 'utf-8');
    } else if (routePath === '/404') {
      fs.writeFileSync(path.join(PUBLIC_DIR, '404.html'), html, 'utf-8');
    } else {
      const relative = `${routePath.replace(/^\//, '')}.html`;
      fs.mkdirSync(path.dirname(path.join(PUBLIC_DIR, relative)), { recursive: true });
      fs.writeFileSync(path.join(PUBLIC_DIR, relative), html, 'utf-8');
    }
  }

  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc></url>
  <url><loc>${SITE_URL}/guides</loc></url>
  <url><loc>${SITE_URL}/llms.txt</loc></url>
</urlset>
`,
    'utf-8'
  );

  fs.writeFileSync(path.join(PUBLIC_DIR, 'assets/.keep'), '', 'utf-8');
}

function countWords(html: string): number {
  const rootMatch = html.match(/<div id="root">([\s\S]*?)<\/div>/i);
  const text = (rootMatch?.[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').filter(Boolean).length : 0;
}

function countInternalLinks(html: string): number {
  const rootMatch = html.match(/<div id="root">([\s\S]*?)<\/div>/i);
  return ((rootMatch?.[1] ?? '').match(/<a\s+[^>]*href="\//gi) ?? []).length;
}

describe('Prerendered SEO HTML', () => {
  let restoredFromBackup = false;

  beforeAll(() => {
    if (hasCompletePrerender()) {
      clearSeoHtmlCache();
      return;
    }

    if (fs.existsSync(PUBLIC_DIR)) {
      fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
      copyDir(PUBLIC_DIR, BACKUP_DIR);
      restoredFromBackup = true;
    }
    ensureMinimalPublicAssets();
    clearSeoHtmlCache();
  });

  afterAll(() => {
    if (!restoredFromBackup || !fs.existsSync(BACKUP_DIR)) {
      return;
    }
    fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
    copyDir(BACKUP_DIR, PUBLIC_DIR);
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
    clearSeoHtmlCache();
  });

  for (const routePath of SAMPLE_ROUTES) {
    it(`${routePath} serves unique title, self-canonical, and H1`, async () => {
      const response = await request(app).get(routePath).set('User-Agent', 'Googlebot');
      expect(response.status).toBe(200);
      expect(response.text).toMatch(/<title>.*?<\/title>/);
      expect(response.text).toMatch(/<h1[^>]*>[\s\S]*?<\/h1>/);

      const canonical = response.text.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
      const expected =
        routePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${routePath}`;
      expect(canonical).toBe(expected);

      if (routePath !== '/') {
        expect(canonical).not.toBe(`${SITE_URL}/`);
      }
    });
  }

  it('/guides returns 200 hub HTML and /guides/ redirects once without looping', async () => {
    const indexResponse = await request(app).get('/guides').redirects(0);
    expect(indexResponse.status).toBe(200);
    expect(indexResponse.text).toMatch(/<h1[^>]*>[\s\S]*Guides/i);
    expect(indexResponse.text).toMatch(/<a href="\/guides\//);

    const trailing = await request(app).get('/guides/').redirects(0);
    expect(trailing.status).toBe(301);
    expect(trailing.headers.location).toBe('/guides');

    // Follow the single hop explicitly — proves no /guides <-> /guides/ loop
    const afterRedirect = await request(app).get(trailing.headers.location!).redirects(0);
    expect(afterRedirect.status).toBe(200);
    expect(afterRedirect.headers.location).toBeUndefined();
  });

  for (const routePath of CONTENT_ROUTES) {
    it(`${routePath} prerender includes full body text and internal links`, async () => {
      const response = await request(app).get(routePath);
      expect(response.status).toBe(200);
      expect(countWords(response.text)).toBeGreaterThanOrEqual(80);
      expect(countInternalLinks(response.text)).toBeGreaterThanOrEqual(3);
    });
  }

  it('unknown URLs return 404 with noindex, X-Robots-Tag, and no canonical/og:url', async () => {
    const response = await request(app)
      .get('/this-page-should-not-exist-seo')
      .set('User-Agent', 'Googlebot');

    expect(response.status).toBe(404);
    expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.text).toMatch(/name="robots"\s+content="[^"]*noindex/i);
    expect(response.text).toMatch(/<h1[^>]*>[\s\S]*Page Not Found/i);
    expect(response.text).not.toMatch(/<link rel="canonical"/i);
    expect(response.text).not.toMatch(/property="og:url"/i);
    expect(response.text).not.toMatch(/<link rel="canonical" href="https:\/\/mockifyer\.dev\/"/);
    expect(response.text).not.toContain('SoftwareApplication');
  });

  it('FAQ and guide pages include route-specific JSON-LD in raw HTML', async () => {
    const faq = await request(app).get('/faq');
    expect(faq.status).toBe(200);
    expect(faq.text).toMatch(/"@type"\s*:\s*"FAQPage"/);

    const guide = await request(app).get('/guides/mock-drift');
    expect(guide.status).toBe(200);
    expect(guide.text).toMatch(/"@type"\s*:\s*"TechArticle"/);
  });

  it('sitemap includes /guides and omits raw .md competitors', async () => {
    const response = await request(app).get('/sitemap.xml');
    expect(response.status).toBe(200);
    expect(response.text).toContain(`${SITE_URL}/guides`);
    expect(response.text).not.toContain('/getting-started.md');
    expect(response.text).not.toContain('/overview.md');
    expect(response.text).not.toContain('/config-reference.md');
  });

  it('titles that already include Mockifyer do not get a redundant suffix', async () => {
    const response = await request(app).get('/getting-started');
    const title = response.text.match(/<title>(.*?)<\/title>/i)?.[1] ?? '';
    expect(title).toBe('Getting Started with Mockifyer');
    expect(title).not.toMatch(/\| Mockifyer$/);
  });

  it('buildNotFoundHtml includes noindex and omits canonical', () => {
    const html = buildNotFoundHtml();
    expect(html).toMatch(/noindex/i);
    expect(html).toMatch(/<h1/i);
    expect(html).not.toMatch(/<link rel="canonical"/i);
    expect(html).not.toMatch(/property="og:url"/i);
  });

  it('loadShellHtml returns empty #root', () => {
    const shell = loadShellHtml();
    expect(shell).toContain('<div id="root"></div>');
  });
});
