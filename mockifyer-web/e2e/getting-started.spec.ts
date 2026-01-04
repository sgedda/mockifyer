import { test, expect } from '@playwright/test';

test.describe('Getting Started Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/getting-started');
  });

  test('should display getting started content', async ({ page }) => {
    // Check main heading
    await expect(page.getByText(/Getting Started with Mockifyer/i)).toBeVisible();
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

  test('should have environment configuration section', async ({ page }) => {
    await expect(page.getByText(/Environment Configuration/i)).toBeVisible({ timeout: 5000 });
  });
});









