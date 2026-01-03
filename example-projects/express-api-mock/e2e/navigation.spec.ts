import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should display logo and navigation links', async ({ page }) => {
    await page.goto('/');
    
    // Check logo is visible (use first() since there are two logos - nav and main)
    const logo = page.getByRole('navigation').getByRole('link', { name: /mockifyer/i });
    await expect(logo).toBeVisible();
    
    // Check navigation links (use navigation role to avoid duplicates)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Getting Started' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Playground', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Request Flow', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });

  test('should navigate to Getting Started page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Getting Started' }).click();
    await expect(page).toHaveURL(/.*getting-started\.html/);
    await expect(page.getByText(/Getting Started with Mockifyer/i)).toBeVisible();
  });

  test('should navigate to Playground page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'Playground', exact: true }).click();
    await expect(page).toHaveURL(/.*playground\.html/);
    // Wait for page to load and check for Status Banner (reliable indicator)
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Mockifyer:/i)).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Request Flow page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'Request Flow', exact: true }).click();
    await expect(page).toHaveURL(/.*request-flow\.html/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Request Flow Visualization/i })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Settings page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/.*settings\.html/);
    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible();
  });

  test('should have logo link to home page', async ({ page }) => {
    await page.goto('/playground.html');
    const logo = page.getByRole('navigation').getByRole('link', { name: /mockifyer/i });
    await logo.click();
    await expect(page).toHaveURL('/');
  });

  test('should show mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // On mobile, navigation links might be in a hamburger menu or always visible
    // Check if there's a menu button (hamburger icon) - look for button with Menu icon
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    let menuButton = null;
    
    // Find button that might be the menu button (usually has an SVG icon)
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const hasSvg = await button.locator('svg').count() > 0;
      const isVisible = await button.isVisible().catch(() => false);
      if (hasSvg && isVisible) {
        menuButton = button;
        break;
      }
    }
    
    if (menuButton) {
      // Click menu button to open mobile menu
      await menuButton.click();
      await page.waitForTimeout(500); // Wait for menu animation
      
      // Check that navigation links are visible in mobile menu
      const gettingStartedLink = page.getByRole('link', { name: 'Getting Started' });
      const playgroundLink = page.getByRole('link', { name: 'Playground' });
      
      // At least one should be visible after clicking menu
      const hasGettingStarted = await gettingStartedLink.isVisible().catch(() => false);
      const hasPlayground = await playgroundLink.isVisible().catch(() => false);
      expect(hasGettingStarted || hasPlayground).toBeTruthy();
    } else {
      // On mobile, navigation might be always visible (responsive design)
      // Just verify navigation links are accessible
      const navLinks = page.getByRole('navigation').getByRole('link');
      const linkCount = await navLinks.count();
      expect(linkCount).toBeGreaterThan(0);
    }
  });
});

