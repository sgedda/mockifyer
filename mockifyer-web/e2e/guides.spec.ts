import { test, expect } from '@playwright/test';

test.describe('Guide Pages', () => {
  test('should load Mock at the Network Edge guide', async ({ page }) => {
    await page.goto('/guides/mock-at-the-network-edge');
    await expect(page.getByRole('heading', { name: /Mock at the Network Edge/i })).toBeVisible();
    await expect(page.getByText(/Your tests pass but bugs ship/i)).toBeVisible();
  });

  test('should load Reproduce Tester Bugs guide', async ({ page }) => {
    await page.goto('/guides/reproduce-tester-bugs');
    await expect(page.getByRole('heading', { name: /Reproduce Tester Bugs/i })).toBeVisible();
    // Use first() to avoid strict mode violation (appears multiple times in code examples)
    await expect(page.getByText(/x-mockifyer-request-id/i).first()).toBeVisible();
  });

  test('should load Stable React Native E2E guide', async ({ page }) => {
    await page.goto('/guides/stable-react-native-e2e');
    await expect(page.getByRole('heading', { name: /Stable React Native E2E/i })).toBeVisible();
    await expect(page.getByText(/Detox.*Appium.*Maestro/i)).toBeVisible();
  });

  test('should load Stop Mock Drift guide', async ({ page }) => {
    await page.goto('/guides/mock-drift');
    await expect(page.getByRole('heading', { name: /Catch API Drift Before Production/i })).toBeVisible();
    
    // Should have the demo button
    await expect(page.getByRole('button', { name: /Try Drift Detection Demo/i })).toBeVisible();
  });

  test('should load React Native guide', async ({ page }) => {
    await page.goto('/guides/react-native-without-msw');
    await expect(page.getByRole('heading', { name: /Handlers vs Recording/i })).toBeVisible();
    await expect(page.getByText(/MSW uses in-code handlers/i)).toBeVisible();
  });

  test('should load Atlas from Playwright guide', async ({ page }) => {
    await page.goto('/guides/atlas-from-playwright');
    await expect(page.getByRole('heading', { name: /Generate Atlas from Playwright E2E/i })).toBeVisible();
    await expect(page.getByText(/globalTeardown/i).first()).toBeVisible();
  });

  test('should load Streaming guide', async ({ page }) => {
    await page.goto('/guides/streaming');
    await expect(
      page.getByRole('heading', { name: /Mocking SSE and Streaming APIs/i })
    ).toBeVisible();
    await expect(page.getByText(/streamReplay/i).first()).toBeVisible();
  });

  test('all guides should have a back navigation link', async ({ page }) => {
    const guides = [
      '/guides/mock-at-the-network-edge',
      '/guides/reproduce-tester-bugs',
      '/guides/stable-react-native-e2e',
      '/guides/mock-drift',
      '/guides/react-native-without-msw',
      '/guides/atlas-from-playwright',
      '/guides/streaming',
    ];

    for (const guide of guides) {
      await page.goto(guide);
      const backButton = page.getByRole('link', { name: /Back to (Home|Guides)/i });
      await expect(backButton).toBeVisible();
    }
  });
});
