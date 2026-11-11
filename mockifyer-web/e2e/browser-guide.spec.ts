import { test, expect } from '@playwright/test';

test.describe('Browser Guide Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/guides/browser-record-replay');
  });

  test('should display browser guide heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Record and Replay HTTP in the Browser/i })).toBeVisible();
  });

  test('should show browser support status card', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Browser Support Status/i })).toBeVisible();
    await expect(page.getByText(/next release/i).first()).toBeVisible();
  });

  test('should have installation section', async ({ page }) => {
    await expect(page.getByText(/^Installation$/i)).toBeVisible();
    await expect(page.locator('text=npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch')).toBeVisible();
  });

  test('should have setup with memory provider section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Setup with Memory Provider/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Prepare Your Fixtures/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Initialize Mockifyer/i })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Vite' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Webpack 5' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Metro/ })).toBeVisible();
  });

  test('should have code examples', async ({ page }) => {
    const codeBlocks = page.locator('pre, code');
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have navigation links', async ({ page }) => {
    const gettingStartedLink = page.locator('a[href="/getting-started"]').first();
    const configRefLink = page.locator('a[href="/config-reference"]').first();
    
    await expect(gettingStartedLink).toBeVisible();
    await expect(configRefLink).toBeVisible();
  });
});
