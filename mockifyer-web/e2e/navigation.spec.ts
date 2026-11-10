import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should display logo and navigation links', async ({ page }) => {
    await page.goto('/');
    
    // Check logo is visible (use aria-label to avoid mobile menu duplicate)
    const logo = page.getByRole('link', { name: 'Mockifyer home' });
    await expect(logo).toBeVisible();
    
    // Check navigation links (use navigation role to avoid duplicates)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Features', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Packages', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'FAQ', exact: true })).toBeVisible();
    
    // Check Guides dropdown exists
    await expect(page.getByRole('button', { name: 'Guides' })).toBeVisible();
  });

  test('should navigate to Getting Started page', async ({ page }) => {
    await page.goto('/');
    // Use the Get Started nav link
    await page.getByRole('navigation').getByRole('link', { name: 'Get Started' }).click();
    await expect(page).toHaveURL(/.*getting-started/);
    await expect(page.getByRole('heading', { name: /Getting Started/i })).toBeVisible();
  });

  test('should navigate to Features page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'Features', exact: true }).click();
    await expect(page).toHaveURL(/.*features/);
    await expect(page.getByRole('heading', { name: /All Features/i })).toBeVisible();
  });

  test('should navigate to Dashboard page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: /Dashboard & Tooling/i })).toBeVisible();
  });

  test('should navigate to FAQ page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'FAQ', exact: true }).click();
    await expect(page).toHaveURL(/.*faq/);
    // Use first() to handle multiple h1 tags
    await expect(page.getByRole('heading', { name: /Frequently Asked Questions/i }).first()).toBeVisible();
  });

  test('should have logo link to home page', async ({ page }) => {
    await page.goto('/features');
    const logo = page.getByRole('link', { name: 'Mockifyer home' });
    await logo.click();
    await expect(page).toHaveURL('/');
  });

  test('should show mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find the menu button (should be visible on mobile)
    const menuButton = page.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();
    
    // Click to open mobile menu
    await menuButton.click();
    await page.waitForTimeout(500); // Wait for menu animation
    
    // After clicking, menu should have expanded (check for mobile nav links)
    // Mobile navigation shows links that are collapsed on desktop
    await expect(page.locator('nav.lg\\:hidden')).toBeVisible();
  });

  test('should have Guides dropdown with guide links', async ({ page }) => {
    await page.goto('/');
    
    // Click Guides button
    const guidesButton = page.getByRole('button', { name: 'Guides' });
    await guidesButton.click();
    
    // Wait for any guide link to appear (they're rendered on click)
    await page.waitForTimeout(500); // Allow dropdown to render
    
    // Check guide links appear (use menuitem role to target dropdown items specifically)
    const mockEdgeLink = page.getByRole('menuitem', { name: 'Mock at the Network Edge' });
    await expect(mockEdgeLink).toBeVisible({ timeout: 5000 });
    
    // Check other guide links exist (5 guides total)
    await expect(page.getByRole('menuitem', { name: 'Stop Mock Drift' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Reproduce Tester Bugs' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Stable React Native E2E' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'React Native: Handlers vs Recording' })).toBeVisible();
  });

  test('should navigate to guide page from dropdown', async ({ page }) => {
    await page.goto('/');
    
    // Open Guides dropdown
    await page.getByRole('button', { name: 'Guides' }).click();
    await page.waitForTimeout(500); // Allow dropdown to render
    
    // Click on a guide using menuitem role to target dropdown specifically
    await page.getByRole('menuitem', { name: 'Mock at the Network Edge' }).click();
    
    // Check we're on the guide page
    await expect(page).toHaveURL(/.*guides\/mock-at-the-network-edge/);
    await expect(page.getByRole('heading', { name: /Mock at the Network Edge/i })).toBeVisible();
  });
});

