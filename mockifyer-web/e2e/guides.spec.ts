import { test, expect } from '@playwright/test';

test.describe('Guide Pages', () => {
  test('should load Mock at the Network Edge guide', async ({ page }) => {
    await page.goto('/guides/mock-at-the-network-edge');
    await expect(page.getByRole('heading', { name: /Mock at the Network Edge/i })).toBeVisible();
    await expect(page.getByText(/Why mock HTTP instead of hooks/i)).toBeVisible();
  });

  test('should load Reproduce Tester Bugs guide', async ({ page }) => {
    await page.goto('/guides/reproduce-tester-bugs');
    await expect(page.getByRole('heading', { name: /Reproduce Tester Bugs/i })).toBeVisible();
    await expect(page.getByText(/x-mockifyer-request-id/i)).toBeVisible();
  });

  test('should load Stable React Native E2E guide', async ({ page }) => {
    await page.goto('/guides/stable-react-native-e2e');
    await expect(page.getByRole('heading', { name: /Stable React Native E2E/i })).toBeVisible();
    await expect(page.getByText(/Detox.*Appium.*Maestro/i)).toBeVisible();
  });

  test('should load Stop Mock Drift guide', async ({ page }) => {
    await page.goto('/guides/mock-drift');
    await expect(page.getByRole('heading', { name: /Stop Mock Drift/i })).toBeVisible();
    
    // Should have the demo button
    await expect(page.getByRole('button', { name: /Try Drift Detection Demo/i })).toBeVisible();
  });

  test('should load Nuxt SSR Fixtures guide', async ({ page }) => {
    await page.goto('/guides/nuxt-ssr-fixtures');
    await expect(page.getByRole('heading', { name: /Nuxt SSR Fixtures/i })).toBeVisible();
    await expect(page.getByText(/Nuxt.*Nitro/i)).toBeVisible();
  });

  test('all guides should have back to home button', async ({ page }) => {
    const guides = [
      '/guides/mock-at-the-network-edge',
      '/guides/reproduce-tester-bugs',
      '/guides/stable-react-native-e2e',
      '/guides/mock-drift',
      '/guides/nuxt-ssr-fixtures',
    ];

    for (const guide of guides) {
      await page.goto(guide);
      const backButton = page.getByRole('link', { name: /Back to Home/i });
      await expect(backButton).toBeVisible();
    }
  });
});
