import { test, expect } from '@playwright/test';

test.describe('Guides Dropdown After Scroll', () => {
  test('should keep header visible and open dropdown after scrolling on desktop', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/packages');
    await page.waitForLoadState('networkidle');
    
    // Scroll down the page
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300); // Allow scroll to settle
    
    // Get the navigation bar
    const nav = page.locator('nav.sticky');
    
    // Header should still be visible after scroll (sticky behavior)
    await expect(nav).toBeVisible();
    
    // Click Guides button
    const guidesButton = page.getByRole('button', { name: 'Guides' });
    await expect(guidesButton).toBeVisible();
    await guidesButton.click();
    
    // Wait for dropdown animation
    await page.waitForTimeout(500);
    
    // Header should STILL be visible after opening dropdown
    await expect(nav).toBeVisible();
    
    // Dropdown should be open with all guide items visible
    await expect(page.getByRole('menuitem', { name: 'Mock at the Network Edge' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Stop Mock Drift' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Reproduce Tester Bugs' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Stable React Native E2E' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'React Native: Handlers vs Recording' })).toBeVisible();
  });

  test('should keep header visible and open dropdown after scrolling on mobile', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/packages');
    await page.waitForLoadState('networkidle');
    
    // Scroll down the page
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(300); // Allow scroll to settle
    
    // Get the navigation bar
    const nav = page.locator('nav.sticky');
    
    // Header should still be visible after scroll (sticky behavior)
    await expect(nav).toBeVisible();
    
    // Open mobile menu first
    const menuButton = page.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await page.waitForTimeout(500);
    
    // Mobile navigation should be visible
    await expect(page.locator('nav.lg\\:hidden')).toBeVisible();
    
    // Header should STILL be visible
    await expect(nav).toBeVisible();
    
    // Check that Guides section and links are visible in mobile menu
    await expect(page.locator('nav.lg\\:hidden').getByText('Guides', { exact: true })).toBeVisible();
    
    // All guide items should be visible in the mobile menu
    const mobileNav = page.locator('nav.lg\\:hidden');
    await expect(mobileNav.getByRole('link', { name: 'Mock at the Network Edge' })).toBeVisible();
    await expect(mobileNav.getByRole('link', { name: 'Stop Mock Drift' })).toBeVisible();
  });
});
