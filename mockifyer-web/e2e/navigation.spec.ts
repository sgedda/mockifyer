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
    
    // Find and click the menu button
    const menuButton = page.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await page.waitForTimeout(500); // Wait for menu animation
    
    // Check that navigation links are visible in mobile menu
    const featuresLink = page.getByRole('link', { name: 'Features' });
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    
    // At least one should be visible after clicking menu
    const hasFeatures = await featuresLink.isVisible().catch(() => false);
    const hasDashboard = await dashboardLink.isVisible().catch(() => false);
    expect(hasFeatures || hasDashboard).toBeTruthy();
  });

  test('should have Guides dropdown with guide links', async ({ page }) => {
    await page.goto('/');
    
    // Click Guides button and wait for menu to appear
    const guidesButton = page.getByRole('button', { name: 'Guides' });
    await guidesButton.click();
    await page.waitForTimeout(300); // Wait for dropdown animation
    
    // Check guide links appear
    await expect(page.getByRole('link', { name: 'Mock at the Network Edge' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reproduce Tester Bugs' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stable React Native E2E' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stop Mock Drift' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuxt SSR Fixtures' })).toBeVisible();
  });

  test('should navigate to guide page from dropdown', async ({ page }) => {
    await page.goto('/');
    
    // Open Guides dropdown and wait for menu
    await page.getByRole('button', { name: 'Guides' }).click();
    await page.waitForTimeout(300); // Wait for dropdown animation
    
    // Click on a guide
    await page.getByRole('link', { name: 'Mock at the Network Edge' }).click();
    
    // Check we're on the guide page
    await expect(page).toHaveURL(/.*guides\/mock-at-the-network-edge/);
    await expect(page.getByRole('heading', { name: /Mock at the Network Edge/i })).toBeVisible();
  });
});

