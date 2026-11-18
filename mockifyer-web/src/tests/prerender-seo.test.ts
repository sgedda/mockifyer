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
  '/guides/mock-drift',
  '/guides/stable-react-native-e2e',
  '/features',
];

function pathExists(relativePath: string): boolean {
  return fs.existsSync(path.join(PUBLIC_DIR, relativePath));
}

function hasCompletePrerender(): boolean {
  return (
    pathExists('index.html') &&
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

  const routes: Record<string, { title: string; description: string; path: string; noIndex?: boolean }> = {
    '/': {
      title: 'Mockifyer — Record & Replay HTTP API Mocks',
      description: 'Homepage description for tests',
      path: '/',
    },
    '/getting-started': {
      title: 'Getting Started with Mockifyer | Mockifyer',
      description: 'Getting started description for tests',
      path: '/getting-started',
    },
    '/guides/mock-drift': {
      title: 'Stop Hand-Written API Mocks from Drifting | Mockifyer',
      description: 'Mock drift guide description for tests',
      path: '/guides/mock-drift',
    },
    '/guides/stable-react-native-e2e': {
      title: 'Stable React Native E2E Tests | Mockifyer',
      description: 'RN E2E guide description for tests',
      path: '/guides/stable-react-native-e2e',
    },
    '/features': {
      title: 'Mockifyer Features | Mockifyer',
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

  fs.writeFileSync(path.join(PUBLIC_DIR, 'assets/.keep'), '', 'utf-8');
}

describe('Prerendered SEO HTML', () => {
  let restoredFromBackup = false;

  beforeAll(() => {
    if (hasCompletePrerender()) {
      // Keep real build output; only refresh in-memory caches.
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

  it('unknown URLs return 404 with noindex and non-homepage canonical', async () => {
    const response = await request(app)
      .get('/this-page-should-not-exist-seo')
      .set('User-Agent', 'Googlebot');

    expect(response.status).toBe(404);
    expect(response.text).toMatch(/name="robots"\s+content="[^"]*noindex/i);
    expect(response.text).toMatch(/<h1[^>]*>[\s\S]*Page Not Found/i);
    expect(response.text).not.toMatch(/<link rel="canonical" href="https:\/\/mockifyer\.dev\/"/);
    expect(response.text).not.toContain('SoftwareApplication');
  });

  it('buildNotFoundHtml includes noindex', () => {
    const html = buildNotFoundHtml();
    expect(html).toMatch(/noindex/i);
    expect(html).toMatch(/<h1/i);
  });

  it('loadShellHtml returns empty #root', () => {
    const shell = loadShellHtml();
    expect(shell).toContain('<div id="root"></div>');
  });
});
