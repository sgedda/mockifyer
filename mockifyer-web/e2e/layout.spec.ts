import { test, expect } from '@playwright/test';

test.describe('Page Layout', () => {
  const docsPages = [
    '/config-reference',
    '/date-config',
    '/comparisons',
    '/contact',
    '/e2e-tutorial',
    '/packages',
    '/faq',
    '/features',
    '/dashboard',
    '/getting-started',
    '/guides/mock-at-the-network-edge',
    '/guides/reproduce-tester-bugs',
    '/guides/stable-react-native-e2e',
    '/guides/mock-drift',
    '/guides/react-native-without-msw',
  ];

  test('docs pages should have left margin at 1440px viewport', async ({ page }) => {
    // Set viewport to 1440px wide
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const path of docsPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Find the main content container (should have mx-auto or similar)
      const mainContent = page.locator('main > div').first();
      
      // Get the bounding box of the main content
      const box = await mainContent.boundingBox();
      
      // Verify there's a left margin (content doesn't start at x=0)
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThan(0);
      
      // Verify content has reasonable padding (at least 16px from edge)
      expect(box!.x).toBeGreaterThanOrEqual(16);
      
      // Log for debugging
      console.log(`${path}: left margin = ${box!.x}px`);
    }
  });

  test('tutorial and main content pages should have minimum width at 1440px viewport', async ({ page }) => {
    // Pages that should have wider content (max-w-[1200px] or similar)
    const wideContentPages = [
      '/e2e-tutorial',
      '/dashboard',
      '/features',
      '/faq',
      '/packages',
      '/getting-started',
    ];

    await page.setViewportSize({ width: 1440, height: 900 });

    for (const path of wideContentPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const mainContent = page.locator('main > div').first();
      const box = await mainContent.boundingBox();
      
      expect(box).not.toBeNull();
      
      // At 1440px viewport, content with max-w-[1200px] should be close to 1200px wide
      // With padding, expect at least 1100px content width
      expect(box!.width).toBeGreaterThanOrEqual(1100);
      
      console.log(`${path}: content width = ${Math.round(box!.width)}px`);
    }
  });
});
