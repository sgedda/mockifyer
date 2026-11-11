import { test, expect } from '@playwright/test';

test.describe('Browser Guide Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/browser-guide');
  });

  test('should display browser guide heading', async ({ page }) => {
    await expect(page.getByText(/Run Mockifyer in the Browser.*Expo Web/i)).toBeVisible();
  });

  test('should show browser support status card', async ({ page }) => {
    await expect(page.getByText(/Browser Support Status/i)).toBeVisible();
    await expect(page.getByText(/@sgedda\/mockifyer-fetch@1\.8\.107\+/)).toBeVisible();
  });

  test('should have installation section', async ({ page }) => {
    await expect(page.getByText(/^Installation$/i)).toBeVisible();
    await expect(page.locator('text=npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch')).toBeVisible();
  });

  test('should have setup with memory provider section', async ({ page }) => {
    await expect(page.getByText(/Setup with Memory Provider/i)).toBeVisible();
    await expect(page.getByText(/Prepare Your Fixtures/i)).toBeVisible();
    await expect(page.getByText(/Initialize Mockifyer/i)).toBeVisible();
  });

  test('should show what works in browser', async ({ page }) => {
    await expect(page.getByText(/What Works in the Browser/i)).toBeVisible();
    await expect(page.getByText(/Memory provider with preloaded fixtures/i)).toBeVisible();
    await expect(page.getByText(/Global fetch patching/i)).toBeVisible();
    await expect(page.getByText(/Request matching/i)).toBeVisible();
  });

  test('should show browser limitations', async ({ page }) => {
    await expect(page.getByText(/Browser Limitations/i)).toBeVisible();
    await expect(page.getByText(/No recording mode/i)).toBeVisible();
    await expect(page.getByText(/Memory provider only/i)).toBeVisible();
  });

  test('should have run example locally section', async ({ page }) => {
    await expect(page.getByText(/Run the Example Locally/i)).toBeVisible();
    await expect(page.locator('text=example-projects/browser-vite')).toBeVisible();
  });

  test('should mention dashboard backend connectivity', async ({ page }) => {
    await expect(page.getByText(/Dashboard Backend Connectivity/i)).toBeVisible();
    await expect(page.getByText(/PR #500/i)).toBeVisible();
  });

  test('should have bundler configuration section', async ({ page }) => {
    await expect(page.getByText(/Bundler Configuration/i)).toBeVisible();
    await expect(page.getByText(/Vite/i)).toBeVisible();
    await expect(page.getByText(/Webpack 5/i)).toBeVisible();
    await expect(page.getByText(/Metro.*Expo.*React Native Web/i)).toBeVisible();
  });

  test('should have code examples', async ({ page }) => {
    const codeBlocks = page.locator('pre, code');
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have navigation links', async ({ page }) => {
    const gettingStartedLink = page.locator('a[href="/getting-started"]');
    const configRefLink = page.locator('a[href="/config-reference"]');
    
    await expect(gettingStartedLink).toBeVisible();
    await expect(configRefLink).toBeVisible();
  });
});
