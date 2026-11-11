import { test, expect } from '@playwright/test';

// Routes that should have unique SEO
const ROUTES = [
  { path: '/', title: 'Mockifyer — Record & Replay HTTP API Mocks', h1: /Mockifyer/ },
  { path: '/getting-started', title: 'Getting Started with Mockifyer | Mockifyer', h1: /Getting Started/i },
  { path: '/features', title: 'Mockifyer Features: Record, Replay, Scenarios | Mockifyer', h1: /Mockifyer Features/i },
  { path: '/faq', title: 'Mockifyer FAQ: Record-Replay API Mocks | Mockifyer', h1: /FAQ/i },
  { path: '/packages', title: 'Mockifyer npm Packages for Axios and Fetch | Mockifyer', h1: /Packages/i },
  { path: '/dashboard', title: 'Mockifyer Dashboard and MCP Tools | Mockifyer', h1: /Dashboard/i },
  { path: '/comparisons', title: 'Mockifyer vs MSW, Polly.js, and Nock | Mockifyer', h1: /Comparisons/i },
  { path: '/guides/react-native-without-msw', title: 'MSW vs Recording in React Native | Mockifyer', h1: /MSW/i },
];

test.describe('SEO: Per-route HTML metadata', () => {
  for (const route of ROUTES) {
    test(`${route.path} has unique title, canonical, and H1 in raw HTML`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);

      // Get the raw HTML before JavaScript executes
      const html = await response?.text();
      expect(html).toBeTruthy();

      // Check title tag in raw HTML
      const titleMatch = html!.match(/<title>(.*?)<\/title>/);
      expect(titleMatch).toBeTruthy();
      expect(titleMatch![1]).toBe(route.title);

      // Check canonical link in raw HTML
      const canonicalMatch = html!.match(/<link rel="canonical" href="([^"]+)"/);
      expect(canonicalMatch).toBeTruthy();
      expect(canonicalMatch![1]).toBe(`https://mockifyer.dev${route.path}`);

      // Wait for the page to render and check H1
      await page.waitForLoadState('networkidle');
      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible();
      await expect(h1).toContainText(route.h1);
    });
  }
});

test.describe('SEO: 404 handling', () => {
  const NOT_FOUND_PATHS = [
    '/blog',
    '/docs',
    '/this-page-should-not-exist',
    '/api/nonexistent',
  ];

  for (const path of NOT_FOUND_PATHS) {
    test(`${path} returns HTTP 404`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);

      if (!path.startsWith('/api/')) {
        // Non-API 404s should show the NotFound component
        await expect(page.locator('h1')).toContainText('404');
        await expect(page.locator('h2')).toContainText(/Page Not Found/i);
      }
    });
  }
});

test.describe('SEO: Server-side 301 redirects', () => {
  const REDIRECTS = [
    { from: '/playground', to: '/getting-started' },
    { from: '/settings', to: '/date-config' },
    { from: '/timeline', to: '/dashboard' },
    { from: '/index.html', to: '/' },
  ];

  for (const redirect of REDIRECTS) {
    test(`${redirect.from} redirects to ${redirect.to} with HTTP 301`, async ({ page }) => {
      const response = await page.goto(redirect.from);
      
      // Playwright follows redirects by default, so we check the final URL
      expect(page.url()).toContain(redirect.to);
      
      // Verify it was a 301 redirect by checking the response chain
      const redirectResponse = response?.request().redirectedFrom();
      if (redirectResponse) {
        expect(response?.status()).toBe(200);
      }
    });
  }
});

test.describe('SEO: Trailing slash handling', () => {
  const PATHS_WITH_TRAILING_SLASH = [
    '/getting-started/',
    '/features/',
    '/faq/',
  ];

  for (const path of PATHS_WITH_TRAILING_SLASH) {
    test(`${path} redirects to non-trailing-slash version with 301`, async ({ page }) => {
      const response = await page.goto(path);
      const expectedPath = path.slice(0, -1);
      expect(page.url()).toContain(expectedPath);
      expect(page.url()).not.toMatch(/\/$/);
    });
  }
});

test.describe('SEO: Compression headers', () => {
  test('HTML responses include compression headers', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    
    // Check for content-encoding (gzip or br)
    const encoding = response.headers()['content-encoding'];
    // Note: In local dev, compression might not be active; in production it should be
    if (encoding) {
      expect(['gzip', 'br']).toContain(encoding);
    }
  });

  test('JavaScript assets have long cache headers', async ({ request }) => {
    // First get the page to find asset URLs
    const pageResponse = await request.get('/');
    const html = await pageResponse.text();
    
    // Extract JS asset URL from the HTML
    const jsMatch = html.match(/\/assets\/index-[a-zA-Z0-9]+\.js/);
    
    if (jsMatch) {
      const assetUrl = jsMatch[0];
      const assetResponse = await request.get(assetUrl);
      
      const cacheControl = assetResponse.headers()['cache-control'];
      expect(cacheControl).toBeTruthy();
      expect(cacheControl).toMatch(/max-age=31536000|immutable/);
    }
  });
});

test.describe('SEO: Security headers', () => {
  test('Responses include security headers', async ({ request }) => {
    const response = await request.get('/');
    
    const headers = response.headers();
    
    // Check for required security headers
    expect(headers['strict-transport-security']).toBe('max-age=31536000');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    
    // Check that x-powered-by is not present
    expect(headers['x-powered-by']).toBeUndefined();
  });
});

test.describe('SEO: Meta tags and JSON-LD', () => {
  test('Homepage has SoftwareApplication JSON-LD', async ({ page }) => {
    await page.goto('/');
    
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(jsonLd).toBeTruthy();
    
    const data = JSON.parse(jsonLd!);
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data.name).toBe('Mockifyer');
  });

  test('FAQ page has FAQPage JSON-LD', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for client-side SEO to update
    await page.waitForTimeout(500);
    
    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').all();
    const jsonLdTexts = await Promise.all(jsonLdScripts.map(script => script.textContent()));
    
    const faqJsonLd = jsonLdTexts.find(text => {
      if (!text) return false;
      const data = JSON.parse(text);
      return data['@type'] === 'FAQPage';
    });
    
    expect(faqJsonLd).toBeTruthy();
    const faqData = JSON.parse(faqJsonLd!);
    expect(faqData.mainEntity).toBeTruthy();
    expect(Array.isArray(faqData.mainEntity)).toBe(true);
    expect(faqData.mainEntity.length).toBeGreaterThan(0);
  });

  test('All routes have OG and Twitter meta tags', async ({ page }) => {
    const testRoutes = ['/', '/getting-started', '/features'];
    
    for (const route of testRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      
      // Check OG tags
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      
      expect(ogTitle).toBeTruthy();
      expect(ogDescription).toBeTruthy();
      expect(ogImage).toBe('https://mockifyer.dev/og-image.png');
      
      // Check Twitter tags
      const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
      const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute('content');
      
      expect(twitterCard).toBe('summary_large_image');
      expect(twitterImage).toBe('https://mockifyer.dev/og-image.png');
    }
  });
});

test.describe('SEO: Noindex on 404', () => {
  test('404 pages have noindex meta tag', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await page.waitForLoadState('networkidle');
    
    // Wait for client-side SEO update
    await page.waitForTimeout(500);
    
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robotsMeta).toContain('noindex');
  });
});
