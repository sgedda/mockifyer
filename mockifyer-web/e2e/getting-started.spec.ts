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
    // Check for platform-specific sections
    const hasNodeSection = await page.getByText(/Node Service/i).isVisible().catch(() => false);
    const hasReactNativeSection = await page.getByText(/React Native/i).isVisible().catch(() => false);
    
    // At least one platform section should exist
    expect(hasNodeSection || hasReactNativeSection).toBeTruthy();
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
    // Check for WanderWeird example (use first() to avoid strict mode)
    await expect(page.getByText(/WanderWeird/i).first()).toBeVisible();
    
    // Check for link to GitHub
    const githubLinks = page.getByRole('link', { name: /View on GitHub/i });
    expect(await githubLinks.count()).toBeGreaterThan(0);
  });
});









