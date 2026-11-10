import { test, expect } from '@playwright/test';

test.describe('Getting Started Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/getting-started');
  });

  test('should display getting started content', async ({ page }) => {
    // Check main heading
    await expect(page.getByRole('heading', { name: /Getting Started/i })).toBeVisible();
  });

  test('should have Quick Start section', async ({ page }) => {
    await expect(page.getByText(/Quick Start/i)).toBeVisible();
  });

  test('should have code examples', async ({ page }) => {
    // Check for code blocks (they should have syntax highlighting)
    const codeBlocks = page.locator('pre, code');
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have sections for different platforms', async ({ page }) => {
    // Check for platform tabs
    await expect(page.getByRole('tab', { name: 'Node Service' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'React Native' })).toBeVisible();
  });

  test('should have Next Steps section without Playground', async ({ page }) => {
    // Check Next Steps heading
    await expect(page.getByRole('heading', { name: /Next Steps/i })).toBeVisible();
    
    // Should have E2E Tutorial and Dashboard links (use first() to avoid strict mode)
    await expect(page.getByRole('link', { name: /E2E Tutorial/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Dashboard/i }).first()).toBeVisible();
    
    // Should NOT have Playground link
    const playgroundLink = page.getByRole('link', { name: /Playground/i });
    expect(await playgroundLink.count()).toBe(0);
  });

  test('should have Example Projects section', async ({ page }) => {
    // Check for Example Project heading
    await expect(page.getByRole('heading', { name: /Example Project/i })).toBeVisible();
    
    // Check for WanderWeird example (use first() to avoid strict mode)
    await expect(page.getByText(/WanderWeird Travel Demo/i)).toBeVisible();
  });
});









