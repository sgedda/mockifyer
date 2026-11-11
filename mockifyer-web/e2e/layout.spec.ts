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
});
